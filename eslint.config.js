import globals from 'globals';

export default [
	{
		ignores: [ 'node_modules/**', 'vendor/**' ],
	},
	{
		files: [ 'src/**/*.js' ],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			globals: {
				...globals.browser,
				...globals.es2021,
			},
		},
		rules: {
			'no-unused-vars': [ 'warn', { args: 'none' } ],
			'no-undef': 'warn',
			'no-console': 'off',
		},
	},
];