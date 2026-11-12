import {asClass, asValue} from 'awilix';
import {type FastifyBaseLogger, type FastifyInstance} from 'fastify';
import {type INotificationService} from '@/services/notifications.port.js';
import {NotificationService} from '@/services/impl/notification.service.js';
import {type Database} from '@/db/type.js';
import {OrderService} from '@/services/impl/order.service.js';
import {ProductService} from '@/services/impl/product.service.js';

declare module '@fastify/awilix' {

	interface Cradle { // eslint-disable-line @typescript-eslint/consistent-type-definitions
		logger: FastifyBaseLogger;
		database: Database;
		notificationService: INotificationService;
		productService: ProductService;
		orderService: OrderService;
	}
}

export async function configureDiContext(
	server: FastifyInstance,
): Promise<void> {
	server.diContainer.register({
		logger: asValue(server.log),
		database: asValue(server.database),
		notificationService: asClass(NotificationService),
		productService: asClass(ProductService),
		orderService: asClass(OrderService),
	});
}
