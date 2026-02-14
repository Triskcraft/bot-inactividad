import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import json from '@eslint/json'
import { defineConfig } from 'eslint/config'
import prettier from 'eslint-config-prettier'
import importPlugin from 'eslint-plugin-import'

export default defineConfig([
    {
        files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
        plugins: { js },
        extends: ['js/recommended'],
        languageOptions: { globals: globals.node },
    },
    tseslint.configs.recommended,
    {
        files: ['**/*.json'],
        ignores: ['package-lock.json', 'tsconfig.json'],
        plugins: { json },
        language: 'json/json',
        rules: json.configs.recommended.rules,
    },
    {
        files: ['**/*.jsonc'],
        plugins: { json },
        language: 'json/jsonc',
        rules: json.configs.recommended.rules,
    },
    prettier,
    {
        plugins: {
            import: importPlugin,
        },
        rules: {
            'import/extensions': [
                'error',
                'ignorePackages',
                {
                    js: 'never',
                    ts: 'always',
                    tsx: 'never',
                },
            ],
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                },
            ],
        },
    },
    {
        files: ['src/api/**/*.ts'],
        rules: {
            'no-restricted-syntax': [
                'error',
                {
                    selector: "CallExpression[callee.property.name='send']",
                    message: 'Usa res.json() en lugar de res.send()',
                },
            ],
        },
    },
])
