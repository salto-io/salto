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
    plugins: ['react', 'import', 'jest', '@typescript-eslint'],
    rules: {
        'linebreak-style': ['error', 'unix'],
        quotes: [
            'error',
            'single',
            { avoidEscape: true, allowTemplateLiterals: false },
        ],
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
        indent: ['error'],
        '@typescript-eslint/indent': 'off',
        semi: ['error', 'never'],
        'no-param-reassign': [2, { 'props': false }],
        '@typescript-eslint/no-unused-vars': [1, { argsIgnorePattern: '^_' }],
        'no-constant-condition': ['error', { checkLoops: false }],
        'generator-star-spacing': ["error", { "before": true, "after": false }],
        'arrow-parens': ['error', 'as-needed'],
        'comma-dangle': ['error', {
            functions: 'ignore',
            arrays: 'always-multiline',
            objects: 'always-multiline',
            imports: 'always-multiline',
            exports: 'always-multiline',
        }],
        'implicit-arrow-linebreak': ['off'],
    },
    overrides: [
        {
            files: ['*.ts', '*.tsx'],
            rules: {
                'no-useless-constructor': [0],
                'no-empty-function': [0],
                '@typescript-eslint/array-type': [0],
                '@typescript-eslint/member-delimiter-style': ['error', {multiline: {delimiter: 'none'}}]
            }
        },
    ],
    settings: {
        'import/resolver': {
            node: {
                paths: ['./'],
            },
        },
    },
}
