import type { NodePlopAPI } from 'plop';

export default async function (plop: NodePlopAPI) {
	plop.setGenerator('package', {
		description: 'Create a new package',
		prompts: [
			{
				type: 'input',
				name: 'name',
				message: 'Package name',
			},
		],
		actions: [
			{
				type: 'addMany',
				templateFiles: 'support/templates/package/**',
				base: 'support/templates/package',
				destination: 'packages/{{name}}',
			},
		],
	});
}
