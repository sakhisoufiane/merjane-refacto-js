import {type Cradle} from '@fastify/awilix';
import {
	and, eq, gt, sql,
} from 'drizzle-orm';
import {type INotificationService} from '../notifications.port.js';
import {products, type Product} from '@/db/schema.js';
import {type Database} from '@/db/type.js';
import {assertExpiryDate, assertSeasonDates} from '@/utils/product-dates.js';

export class ProductService {
	private readonly ns: INotificationService;
	private readonly db: Database;

	public constructor({ns, db}: Pick<Cradle, 'ns' | 'db'>) {
		this.ns = ns;
		this.db = db;
	}

	/**
	 * Atomically decrements `available` only when stock is still > 0.
	 * Returns `true` when a row was updated, `false` when the product is out of stock.
	 * Must be called inside a transaction to make the check-and-decrement race-free.
	 */
	public decrementAvailableIfInStock(product: Product, tx: Database = this.db): boolean {
		const result = tx
			.update(products)
			.set({available: sql`${products.available} - 1`})
			.where(and(eq(products.id, product.id), gt(products.available, 0)))
			.run();

		return result.changes > 0;
	}

	public notifyDelay(leadTime: number, product: Product, tx: Database = this.db): void {
		tx.update(products).set({leadTime}).where(eq(products.id, product.id)).run();
		this.ns.sendDelayNotification(leadTime, product.name);
	}

	public handleSeasonalProduct(product: Product, tx: Database = this.db): void {
		assertSeasonDates(product);
		const currentDate = new Date();
		const oneDayInMs = 1000 * 60 * 60 * 24;

		if (new Date(currentDate.getTime() + (product.leadTime * oneDayInMs)) > product.seasonEndDate) {
			this.ns.sendOutOfStockNotification(product.name);
			tx.update(products).set({available: 0}).where(eq(products.id, product.id)).run();
		} else if (product.seasonStartDate > currentDate) {
			this.ns.sendOutOfStockNotification(product.name);
		} else {
			this.notifyDelay(product.leadTime, product, tx);
		}
	}

	public handleExpiredProduct(product: Product, tx: Database = this.db): void {
		assertExpiryDate(product);
		this.ns.sendExpirationNotification(product.name, product.expiryDate);
		tx.update(products).set({available: 0}).where(eq(products.id, product.id)).run();
	}
}
