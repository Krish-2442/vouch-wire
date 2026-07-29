import js from '@eslint/js';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.node,
            },
        },
        rules: {
            'no-console': 'error',
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            'prefer-const': 'error',
            'no-var': 'error',
        },
    },
    {
        ignores: ['node_modules/', 'coverage/'],
    },
];
