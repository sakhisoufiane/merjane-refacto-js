import process from 'node:process';
import {type FastifyPluginAsync} from 'fastify';

const shutdownPlugin: FastifyPluginAsync = async server => {
	const shutdown = (signal: NodeJS.Signals): void => {
		server.log.info({signal}, 'Shutting down');
		server.close()
			.then(() => {
				server.log.info({signal}, 'Shutdown complete');
			})
			.catch((error: unknown) => {
				server.log.error({err: error, signal}, 'Shutdown failed');
				process.exitCode = 1;
			});
	};

	process.on('SIGINT', () => {
		shutdown('SIGINT');
	});
	process.on('SIGTERM', () => {
		shutdown('SIGTERM');
	});
};

export default shutdownPlugin;
