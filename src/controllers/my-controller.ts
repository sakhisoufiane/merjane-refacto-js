/* eslint-disable max-depth */
/* eslint-disable no-await-in-loop */
import {eq} from 'drizzle-orm';
import fastifyPlugin from 'fastify-plugin';
import {serializerCompiler, validatorCompiler, type ZodTypeProvider} from 'fastify-type-provider-zod';
import {z} from 'zod';
import {orders, products} from '@/db/schema.js';
import {OrderNotFoundError} from '@/errors.js';
import {assertExpiryDate, assertSeasonDates} from '@/utils/product-dates.js';

export const myController = fastifyPlugin(async server => {
	// Add schema validator and serializer
	server.setValidatorCompiler(validatorCompiler);
	server.setSerializerCompiler(serializerCompiler);

	server.withTypeProvider<ZodTypeProvider>().post('/orders/:orderId/processOrder', {
		schema: {
			params: z.object({
				orderId: z.coerce.number(),
			}),
		},
	}, async (request, reply) => {
		const dbse = server.diContainer.resolve('db');
		const ps = server.diContainer.resolve('ps');
		const order = await dbse.query.orders
			.findFirst({
				where: eq(orders.id, request.params.orderId),
				with: {
					products: {
						columns: {},
						with: {
							product: true,
						},
					},
				},
			});

		// Throw an error when no order matches the provided ID.
		if (!order) {
			throw new OrderNotFoundError(request.params.orderId);
		}

		console.log(order);

		const {products: productList} = order;

		if (productList) {
			for (const {product: p} of productList) {
				// The switch is now exhaustive by design through the PRODUCT_TYPES type in the schema.
				switch (p.type) {
					case 'NORMAL': {
						if (p.available > 0) {
							p.available -= 1;
							await dbse.update(products).set(p).where(eq(products.id, p.id));
						} else {
							const {leadTime} = p;
							if (leadTime > 0) {
								await ps.notifyDelay(leadTime, p);
							}
						}

						break;
					}

					case 'SEASONAL': {
						assertSeasonDates(p);
						const currentDate = new Date();
						if (currentDate > p.seasonStartDate && currentDate < p.seasonEndDate && p.available > 0) {
							p.available -= 1;
							await dbse.update(products).set(p).where(eq(products.id, p.id));
						} else {
							await ps.handleSeasonalProduct(p);
						}

						break;
					}

					case 'EXPIRABLE': {
						assertExpiryDate(p);
						const currentDate = new Date();
						if (p.available > 0 && p.expiryDate > currentDate) {
							p.available -= 1;
							await dbse.update(products).set(p).where(eq(products.id, p.id));
						} else {
							await ps.handleExpiredProduct(p);
						}

						break;
					}
				}
			}
		}

		await reply.send({orderId: order.id});
	});
});

