import { fixupConfigRules, fixupPluginRules } from "@eslint/compat";
import react from "eslint-plugin-react";
import _import from "eslint-plugin-import";
import jest from "eslint-plugin-jest";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
// TODO: switch back to the upstream plugin once they fix https://github.com/Stuk/eslint-plugin-header/issues/57
import header from "@tony.ganchev/eslint-plugin-header";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [{
    ignores: [
        "dist",
        "**/*.d.ts",
        "**/*.config.js",
        "**/coverage",
        "src/tools/",
        "src/generated",
        "package_native.js",
        "**/eslint.config.mjs",
    ],
}, ...fixupConfigRules(compat.extends(
    "eslint:recommended",
    "airbnb",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "plugin:jest/recommended",
    "prettier",
)), {
    plugins: {
        react: fixupPluginRules(react),
        import: fixupPluginRules(_import),
        jest: fixupPluginRules(jest),
        "@typescript-eslint": fixupPluginRules(typescriptEslint),
        header,
    },

    languageOptions: {
        globals: {
            ...globals.jest,
            ...globals.node,
            Atomics: "readonly",
            SharedArrayBuffer: "readonly",
        },

        parser: tsParser,
        ecmaVersion: 2019,
        sourceType: "module",

        parserOptions: {
            ecmaFeatures: {
                jsx: true,
            },
            useJSXTextNode: true,
        },
    },

    settings: {
        "import/resolver": {
            node: {
                paths: ["./"],
            },
        },

        react: {
            version: "16.9",
        },
    },

    rules: {
        "header/header": [2, "block", [
            "",
            " *                      Copyright 2024 Salto Labs Ltd.",
            " *",
            " * Licensed under the Apache License, Version 2.0 (the \"License\");",
            " * you may not use this file except in compliance with",
            " * the License.  You may obtain a copy of the License at",
            " *",
            " *     http://www.apache.org/licenses/LICENSE-2.0",
            " *",
            " * Unless required by applicable law or agreed to in writing, software",
            " * distributed under the License is distributed on an \"AS IS\" BASIS,",
            " * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.",
            " * See the License for the specific language governing permissions and",
            " * limitations under the License.",
            " ",
        ]],

        quotes: ["error", "single", {
            avoidEscape: true,
            allowTemplateLiterals: false,
        }],

        "react/jsx-filename-extension": [1, {
            extensions: [".tsx", ".jsx"],
        }],

        "lines-between-class-members": [1, "always", {
            exceptAfterSingleLine: true,
        }],

        "@typescript-eslint/no-parameter-properties": [0],

        "@typescript-eslint/explicit-function-return-type": ["error", {
            allowTypedFunctionExpressions: true,
            allowExpressions: true,
        }],

        "@typescript-eslint/explicit-member-accessibility": [0],
        "jsx-a11y/anchor-is-valid": [0],
        "@typescript-eslint/indent": "off",

        "no-param-reassign": [2, {
            props: false,
        }],

        "@typescript-eslint/no-unused-vars": [1, {
            argsIgnorePattern: "^_",
        }],

        "no-constant-condition": ["error", {
            checkLoops: false,
        }],

        "implicit-arrow-linebreak": ["off"],
        "import/prefer-default-export": ["off"],

        "import/no-extraneous-dependencies": ["error", {
            devDependencies: ["!test/**/*"],
        }],

        "no-shadow": ["off"],
        "@typescript-eslint/no-shadow": ["error"],

        "@typescript-eslint/ban-types": ["error", {
            extendDefaults: true,

            types: {
                "{}": false,
                object: false,
            },
        }],

        "@typescript-eslint/explicit-module-boundary-types": ["off"],
        "@typescript-eslint/return-await": ["error", "in-try-catch"],
        "@typescript-eslint/no-floating-promises": ["error"],

        "@typescript-eslint/no-misused-promises": ["error", {
            checksVoidReturn: false,
        }],

        "jest/valid-describe": ["off"],

        "import/extensions": ["error", "never", {
            json: "always",
        }],

        "no-restricted-imports": ["error", {
            patterns: ["**/dist/**", "src/*"],
        }],

        "no-restricted-syntax": ["error", {
            selector: "ForInStatement",
            message: "for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.",
        }, {
            selector: "LabeledStatement",
            message: "Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.",
        }, {
            selector: "WithStatement",
            message: "`with` is disallowed in strict mode because it makes code impossible to predict and optimize.",
        }],

        "no-unused-expressions": "off",
        "@typescript-eslint/no-unused-expressions": ["error"],
        "@typescript-eslint/await-thenable": ["error"],
    },
}, {
    files: ["**/*.ts", "**/*.tsx"],

    rules: {
        "no-useless-constructor": [0],
        "no-empty-function": [0],
        "@typescript-eslint/array-type": [0],
        "@typescript-eslint/ban-ts-ignore": [0],
        "max-classes-per-file": [0],
        "import/no-unresolved": [0],
        "import/no-cycle": [0],
        "import/default": [0],
        "import/named": [0],
    },
}];