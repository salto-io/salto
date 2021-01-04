/*
*                      Copyright 2021 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
const isWindows = process.platform === 'win32'

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
        ecmaVersion: 2019,
        sourceType: 'module',
        useJSXTextNode: true,
        project: './tsconfig.json',
        tsconfigRootDir: './',
    },
    plugins: ['react', 'import', 'jest', '@typescript-eslint', 'header'],
    rules: {
        'header/header': [2, "block",
            [
                "",
                "*                      Copyright 2021 Salto Labs Ltd.",
                "*",
                "* Licensed under the Apache License, Version 2.0 (the \"License\");",
                "* you may not use this file except in compliance with",
                "* the License.  You may obtain a copy of the License at",
                "*",
                "*     http://www.apache.org/licenses/LICENSE-2.0",
                "*",
                "* Unless required by applicable law or agreed to in writing, software",
                "* distributed under the License is distributed on an \"AS IS\" BASIS,",
                "* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.",
                "* See the License for the specific language governing permissions and",
                "* limitations under the License.",
                ""
            ]
        ],
        'linebreak-style': ['error', isWindows ? 'windows' : 'unix'],
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
        'import/prefer-default-export': ['off'],
        'object-curly-newline': ['error', { consistent: true }],
        '@typescript-eslint/member-delimiter-style': ['error', {
            multiline: { delimiter: 'none', requireLast: undefined },
            singleline: { delimiter: 'semi', requireLast: undefined },
        }],
        'import/no-extraneous-dependencies': ['error', {
            devDependencies: ['!test/**/*'],
        }],
        'jest/valid-describe': ['off'],
        'import/extensions': [ 'error', 'never', {
            'json': 'always',
        }],
        'no-restricted-imports': ['error', { patterns: ['**/dist/**', 'src/*'] } ],
        // copied from https://github.com/airbnb/javascript/blob/master/packages/eslint-config-airbnb-base/rules/style.js#L334
        // removed rule about generators/iterators since es2019 natively supports them
        'no-restricted-syntax': [
            'error',
            {
                selector: 'ForInStatement',
                message: 'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
            },
            {
                selector: 'LabeledStatement',
                message: 'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
            },
            {
                selector: 'WithStatement',
                message: '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
            },
        ],
    },
    overrides: [
        {
            files: ['*.ts', '*.tsx'],
            rules: {
                'no-useless-constructor': [0],
                'no-empty-function': [0],
                '@typescript-eslint/array-type': [0],
                '@typescript-eslint/ban-ts-ignore': [0],
                'max-classes-per-file': [0],
                'import/no-unresolved': [0], // unable to read paths from tsconfig.json
            }
        },
    ],
    settings: {
        'import/resolver': {
            node: {
                paths: ['./'],
            },
        },
        react: {
            version: '16.9' // not using react now, set to disable warning
        }
    },
}

