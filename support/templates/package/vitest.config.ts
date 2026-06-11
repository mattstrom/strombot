import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [],
	test: {
		setupFiles: ['./support/setup.ts'],
	},
});
