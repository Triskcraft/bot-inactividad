import globals from 'globals'
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default [
    {
        files: ['**/*.{js,mjs,cjs,ts}'],
    },

    js.configs.recommended,

    ...tseslint.configs.recommended,

    {
        languageOptions: {
            globals: globals.node,
        },
    },

    prettier,

    {
        rules: {
            'no-unused-expressions': 'off',

            '@typescript-eslint/no-unused-expressions': [
                'error',
                {
                    allowShortCircuit: true,
                    allowTernary: true,
                    allowTaggedTemplates: true,
                },
            ],
        },
    },
]
