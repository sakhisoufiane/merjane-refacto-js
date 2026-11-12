import process from 'node:process';
import {install as sourceMapSupport} from 'source-map-support';
import {CONFIG} from './configuration/index.js';
import {buildFastify} from './fastify.js';

const main = async (): Promise<void> => {
	const serverConfig = CONFIG.get('server');
	const appConfig = CONFIG.get('app');
	const debugConfig = CONFIG.get('debug');

	if (debugConfig.sourcemap) {
		sourceMapSupport();
	}

	const server = await buildFastify();

	try {
		await server.listen({host: '0.0.0.0', port: serverConfig.port});
		server.log.info({env: appConfig.env, port: serverConfig.port}, 'Server listening');
		server.log.info({routes: server.printRoutes()}, 'Available routes');
	} catch (error) {
		server.log.error(error);
		process.exitCode = 1;
		await server.close();
	}
};

await main();
