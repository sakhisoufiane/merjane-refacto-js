import {
	describe, it, expect, beforeEach,
	afterEach,
} from 'vitest';
import {eq} from 'drizzle-orm';
import {mockDeep, type DeepMockProxy} from 'vitest-mock-extended';
import {type INotificationService} from '../notifications.port.js';
import {createDatabaseMock, cleanUp} from '../../utils/test-utils/database-tools.ts.js';
import {ProductService} from './product.service.js';
import {products, type Product} from '@/db/schema.js';
import {type Database} from '@/db/type.js';
import {InvalidProductDataError} from '@/errors.js';

describe('ProductService Tests', () => {
	let notificationServiceMock: DeepMockProxy<INotificationService>;
	let productService: ProductService;
	let databaseMock: Database;
	let databaseName: string;
	let closeDatabase: () => void;

	beforeEach(async () => {
		({databaseMock, databaseName, close: closeDatabase} = await createDatabaseMock());
		notificationServiceMock = mockDeep<INotificationService>();
		productService = new ProductService({
			notificationService: notificationServiceMock,
			database: databaseMock,
		});
	});

	afterEach(async () => {
		closeDatabase();
		await cleanUp(databaseName);
	});

	it('should handle delay notification correctly', async () => {
		// GIVEN
		const product: Product = {
			id: 1,
			leadTime: 15,
			available: 0,
			type: 'NORMAL',
			name: 'RJ45 Cable',
			expiryDate: null,
			seasonStartDate: null,
			seasonEndDate: null,
		};
		await databaseMock.insert(products).values(product);

		// WHEN
		productService.notifyDelay(product.leadTime, product);

		// THEN
		expect(product.available).toBe(0);
		expect(product.leadTime).toBe(15);
		expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(product.leadTime, product.name);
		const result = await databaseMock.query.products.findFirst({
			where: eq(products.id, product.id),
		});
		expect(result).toEqual(product);
	});

	it('should atomically decrement available only while stock is positive', async () => {
		// GIVEN
		const product: Product = {
			id: 2,
			leadTime: 15,
			available: 1,
			type: 'NORMAL',
			name: 'USB Cable',
			expiryDate: null,
			seasonStartDate: null,
			seasonEndDate: null,
		};
		databaseMock.insert(products).values(product).run();

		// WHEN / THEN
		expect(productService.decrementAvailableIfInStock(product)).toBe(true);
		expect(productService.decrementAvailableIfInStock(product)).toBe(false);

		const result = await databaseMock.query.products.findFirst({
			where: eq(products.id, product.id),
		});
		expect(result?.available).toBe(0);
	});

	it('should throw when an expirable product has no expiry date', async () => {
		// GIVEN
		const product: Product = {
			id: 3,
			leadTime: 10,
			available: 5,
			type: 'EXPIRABLE',
			name: 'Milk',
			expiryDate: null,
			seasonStartDate: null,
			seasonEndDate: null,
		};

		// WHEN / THEN
		expect(() => {
			productService.handleExpiredProduct(product);
		}).toThrow(InvalidProductDataError);
	});

	it('should throw when a seasonal product is missing season dates', async () => {
		// GIVEN
		const product: Product = {
			id: 4,
			leadTime: 10,
			available: 5,
			type: 'SEASONAL',
			name: 'Watermelon',
			expiryDate: null,
			seasonStartDate: null,
			seasonEndDate: null,
		};

		// WHEN / THEN
		expect(() => {
			productService.handleSeasonalProduct(product);
		}).toThrow(InvalidProductDataError);
	});
});

