import convict from 'convict';
import convict_format_with_validator from 'convict-format-with-validator';
import {logger} from '../logging/logger.js';
import {dotenvPath} from './load-env.js';

convict.addFormats(convict_format_with_validator);

if (dotenvPath) {
	logger.info({dotenvPath}, 'Loading env variables');
} else {
	logger.debug('No env file configured, using process environment');
}

export {default as dotEnvConvict} from 'convict';
