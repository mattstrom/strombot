import { defineConfig } from 'oxlint';

export default defineConfig({
	options: {
		typeAware: true,
		typeCheck: true,
	},
	categories: {
		correctness: 'warn',
	},
	jsPlugins: ['@stylistic/eslint-plugin'],
	rules: {
		'eslint/no-unused-vars': 'error',
		'@stylistic/block-spacing': 'error',
		'@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: false }],
		'@stylistic/padding-line-between-statements': [
			'error',
			{ blankLine: 'always', prev: '*', next: 'return' },
		],
		curly: 'error',
	},
});
