module.exports = [
    {
        files: ['**/*.js'],
        languageOptions: {
            sourceType: 'module',
            ecmaVersion: 'latest',
        },
        rules: {
            'array-callback-return': 'error',
            'object-shorthand': ['error', 'always'],
            'no-unused-vars': ['error', { args: 'none' }],
            'quotes': 'off'
        }
    }
];
