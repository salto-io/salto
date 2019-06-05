module.exports = {
    env: {
        es6: true,
        jest: true,
        node: true,
    },

    extends: [
        'eslint:recommended',
        'airbnb',
        'prettier',
        'plugin:prettier/recommended',
        'prettier/react',
        'prettier/@typescript-eslint',
        'plugin:@typescript-eslint/recommended',
        'plugin:import/errors',
        'plugin:import/warnings',
        'plugin:import/typescript',
        'plugin:jest/recommended',
    ],

    globals: {
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly',
    },
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaFeatures: {
            jsx: true,
        },
        ecmaVersion: 2018,
        sourceType: 'module',
        useJSXTextNode: true,
        project: './tsconfig.json',
        tsconfigRootDir: './',
    },
    plugins: ['react', 'prettier', 'import', 'jest', '@typescript-eslint'],
    rules: {
        'linebreak-style': ['error', 'unix'],
        quotes: [
            'error',
            'single',
            { avoidEscape: true, allowTemplateLiterals: false },
        ],
        'react/jsx-one-expression-per-line': [0],
        'react/destructuring-assignment': [0],
        'react/prefer-stateless-function': [0],
        'react/jsx-filename-extension': [1, { extensions: ['.tsx', '.jsx'] }],
        'import/no-extraneous-dependencies': [0],
        '@typescript-eslint/explicit-function-return-type': [0],
        'jsx-a11y/anchor-is-valid': [0],
        'prettier/prettier': [
            'error',
            {},
            {
                usePrettierrc: true,
            },
        ],
        indent: 'off',
        '@typescript-eslint/indent': 'off',
    },
    settings: {
        'import/resolver': {
            node: {
                paths: ['./'],
            },
        },
    },
};
