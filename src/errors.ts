import createError from '@fastify/error';

export class OrderNotFoundError extends createError(
	'ERR_ORDER_NOT_FOUND',
	'Order with id %s not found',
	404,
) {}

export class InvalidProductDataError extends createError(
	'ERR_INVALID_PRODUCT_DATA',
	'Product %s of type %s is missing required field "%s"',
	500,
) {}
