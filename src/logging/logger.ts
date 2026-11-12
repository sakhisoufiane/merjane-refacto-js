import process from 'node:process';
import {type FastifyBaseLogger} from 'fastify';
import {pino} from 'pino';
import {loadEnvironment} from '../configuration/load-env.js';

// Make env-file values (notably LOG_LEVEL) available before the logger is built.
loadEnvironment();

/**
 * Bootstrap logger usable before Fastify exists (config loading, tests).
 * Fastify adopts this same instance, so the whole app shares one level and destination.
 */
export const logger: FastifyBaseLogger = pino({
	level: process.env['LOG_LEVEL'] ?? 'warn',
});
