module.exports = {
    env: {
        es6: true,
        jest: true,
        node: true,
    },

    extends: [
        'eslint:recommended',
        'airbnb',
        'plugin:@typescript-eslint/recommended',
        'plugin:import/errors',
        'plugin:import/warnings',
        'plugin:import/typescript',
        'plugin:jest/recommended',
        'plugin:prettier/recommended',
        'prettier/@typescript-eslint',
        'prettier/react',
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
        'lines-between-class-members': [1, 'always', {exceptAfterSingleLine: true}],
        '@typescript-eslint/no-parameter-properties': [0],
        '@typescript-eslint/explicit-function-return-type': [
            'error', {
                'allowTypedFunctionExpressions': true,
                'allowExpressions': true,
            }
        ],
        '@typescript-eslint/explicit-member-accessibility': [0],
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
        'no-param-reassign': [2, { 'props': false }],
    },
    overrides: [
        {
            files: ['*.ts', '*.tsx'],
            rules: {
                'no-useless-constructor': [0],
                'no-empty-function': [0],
                '@typescript-eslint/array-type': [0]
            }
        }
    ],
    settings: {
        'import/resolver': {
            node: {
                paths: ['./'],
            },
        },
    },
};
