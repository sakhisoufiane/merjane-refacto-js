import {type Cradle} from '@fastify/awilix';
import {
	and, eq, gt, sql,
} from 'drizzle-orm';
import {type FastifyBaseLogger} from 'fastify';
import {type INotificationService} from '../notifications.port.js';
import {products, type Product} from '@/db/schema.js';
import {type Database} from '@/db/type.js';
import {assertExpiryDate, assertSeasonDates} from '@/utils/product-dates.js';

export class ProductService {
	private readonly notificationService: INotificationService;
	private readonly database: Database;
	private readonly logger: FastifyBaseLogger;

	public constructor({notificationService, database, logger}: Pick<Cradle, 'notificationService' | 'database' | 'logger'>) {
		this.notificationService = notificationService;
		this.database = database;
		this.logger = logger;
	}

	/**
	 * Atomically decrements `available` only when stock is still > 0.
	 * Returns `true` when a row was updated, `false` when the product is out of stock.
	 * Must be called inside a transaction to make the check-and-decrement race-free.
	 */
	public decrementAvailableIfInStock(product: Product, tx: Database = this.database): boolean {
		const result = tx
			.update(products)
			.set({available: sql`${products.available} - 1`})
			.where(and(eq(products.id, product.id), gt(products.available, 0)))
			.run();

		const decremented = result.changes > 0;
		this.logger.debug({productId: product.id, productName: product.name, decremented}, 'Stock decrement attempted');

		return decremented;
	}

	public notifyDelay(leadTime: number, product: Product, tx: Database = this.database): void {
		tx.update(products).set({leadTime}).where(eq(products.id, product.id)).run();
		this.notificationService.sendDelayNotification(leadTime, product.name);
		this.logger.info({productId: product.id, productName: product.name, leadTime}, 'Delay notification sent');
	}

	public handleSeasonalProduct(product: Product, tx: Database = this.database): void {
		assertSeasonDates(product);
		const currentDate = new Date();
		const oneDayInMs = 1000 * 60 * 60 * 24;

		if (new Date(currentDate.getTime() + (product.leadTime * oneDayInMs)) > product.seasonEndDate) {
			this.notificationService.sendOutOfStockNotification(product.name);
			tx.update(products).set({available: 0}).where(eq(products.id, product.id)).run();
			this.logger.warn(
				{
					productId: product.id, productName: product.name, seasonEndDate: product.seasonEndDate, leadTime: product.leadTime,
				},
				'Seasonal product unavailable: season ends within lead time',
			);
		} else if (product.seasonStartDate > currentDate) {
			this.notificationService.sendOutOfStockNotification(product.name);
			this.logger.warn({productId: product.id, productName: product.name, seasonStartDate: product.seasonStartDate}, 'Seasonal product unavailable: season has not started');
		} else {
			this.notifyDelay(product.leadTime, product, tx);
		}
	}

	public handleExpiredProduct(product: Product, tx: Database = this.database): void {
		assertExpiryDate(product);
		this.notificationService.sendExpirationNotification(product.name, product.expiryDate);
		tx.update(products).set({available: 0}).where(eq(products.id, product.id)).run();
		this.logger.warn({productId: product.id, productName: product.name, expiryDate: product.expiryDate}, 'Product expired');
	}
}
