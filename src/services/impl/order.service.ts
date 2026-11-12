import {type Cradle} from '@fastify/awilix';
import {eq} from 'drizzle-orm';
import {type ProductService} from './product.service.js';
import {orders, type Product} from '@/db/schema.js';
import {type Database} from '@/db/type.js';
import {OrderNotFoundError} from '@/errors.js';
import {assertExpiryDate, assertSeasonDates} from '@/utils/product-dates.js';

export class OrderService {
	private readonly database: Database;
	private readonly productService: ProductService;

	public constructor({database, productService}: Pick<Cradle, 'database' | 'productService'>) {
		this.database = database;
		this.productService = productService;
	}

	public async processOrder(orderId: number): Promise<number> {
		const order = await this.database.query.orders.findFirst({
			where: eq(orders.id, orderId),
			with: {
				products: {
					columns: {},
					with: {
						product: true,
					},
				},
			},
		});

		if (!order) {
			throw new OrderNotFoundError(orderId);
		}

		this.database.transaction(tx => {
			for (const {product} of order.products) {
				this.processProduct(product, tx);
			}
		});

		return order.id;
	}

	private processProduct(product: Product, tx: Database): void {
		switch (product.type) {
			case 'NORMAL': {
				const decremented = this.productService.decrementAvailableIfInStock(product, tx);
				if (!decremented && product.leadTime > 0) {
					this.productService.notifyDelay(product.leadTime, product, tx);
				}

				break;
			}

			case 'SEASONAL': {
				assertSeasonDates(product);
				const currentDate = new Date();
				const isInSeason = currentDate > product.seasonStartDate && currentDate < product.seasonEndDate;
				if (!isInSeason || !this.productService.decrementAvailableIfInStock(product, tx)) {
					this.productService.handleSeasonalProduct(product, tx);
				}

				break;
			}

			case 'EXPIRABLE': {
				assertExpiryDate(product);
				const isExpired = product.expiryDate <= new Date();
				if (isExpired || !this.productService.decrementAvailableIfInStock(product, tx)) {
					this.productService.handleExpiredProduct(product, tx);
				}

				break;
			}
		}
	}
}
