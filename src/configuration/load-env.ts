import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

export const dotenvPath = process.env['CONFIG_PATH']
	? path.resolve(process.cwd(), process.env['CONFIG_PATH'])
	: undefined;

export function loadEnvironment(): void {
	dotenv.config(dotenvPath ? {path: dotenvPath} : undefined);
}
