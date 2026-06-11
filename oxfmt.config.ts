import { defineConfig } from 'oxfmt';

export default defineConfig({
	singleQuote: true,
	jsxSingleQuote: false,
	printWidth: 100,
	semi: true,
	sortImports: true,
	ignorePatterns: ['**/*.hbs', '.nx/self-healing', 'build', 'coverage', 'charts', 'schema.gql'],
});
