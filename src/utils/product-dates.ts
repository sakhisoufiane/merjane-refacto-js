import {type Product} from '@/db/schema.js';
import {InvalidProductDataError} from '@/errors.js';

export function assertExpiryDate(
	product: Product,
): asserts product is Product & {expiryDate: Date} {
	if (!product.expiryDate) {
		throw new InvalidProductDataError(product.id, product.type, 'expiryDate');
	}
}

export function assertSeasonDates(
	product: Product,
): asserts product is Product & {seasonStartDate: Date; seasonEndDate: Date} {
	if (!product.seasonStartDate) {
		throw new InvalidProductDataError(product.id, product.type, 'seasonStartDate');
	}

	if (!product.seasonEndDate) {
		throw new InvalidProductDataError(product.id, product.type, 'seasonEndDate');
	}
}
