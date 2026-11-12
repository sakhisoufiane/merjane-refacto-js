import createError from '@fastify/error';

export class OrderNotFoundError extends createError(
	'ERR_ORDER_NOT_FOUND',
	'Order with id %s not found',
	404,
) {}
