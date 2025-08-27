// .eslintrc.js
module.exports = {
    env: {
        browser: true,
        commonjs: true,
        es2021: true,
        node: true,
        jest: true
    },
    extends: [
        'standard'
    ],
    parserOptions: {
        ecmaVersion: 'latest'
    },
    rules: {
        // IDENTAÇÃO: 4 espaços em vez de 2
        'indent': ['error', 4, {
            'SwitchCase': 1,
            'VariableDeclarator': 1,
            'outerIIFEBody': 1,
            'MemberExpression': 1,
            'FunctionDeclaration': { 'parameters': 1, 'body': 1 },
            'FunctionExpression': { 'parameters': 1, 'body': 1 },
            'CallExpression': { 'arguments': 1 },
            'ArrayExpression': 1,
            'ObjectExpression': 1,
            'ImportDeclaration': 1,
            'flatTernaryExpressions': false,
            'ignoreComments': false
        }],

        // Outras regras de estilo
        'semi': ['error', 'always'],
        'quotes': ['error', 'single'],
        'comma-dangle': ['error', 'never'],
        'space-before-function-paren': ['error', {
            'anonymous': 'always',
            'named': 'never',
            'asyncArrow': 'always'
        }],
        'brace-style': ['error', '1tbs', { 'allowSingleLine': true }],
        'object-curly-spacing': ['error', 'always'],
        'array-bracket-spacing': ['error', 'never'],
        'keyword-spacing': ['error', { 'before': true, 'after': true }],
        'space-infix-ops': 'error',
        'space-unary-ops': ['error', { 'words': true, 'nonwords': false }],
        'no-trailing-spaces': 'error',
        'eol-last': ['error', 'always'],
        'no-multiple-empty-lines': ['error', { 'max': 2, 'maxBOF': 0, 'maxEOF': 1 }],

        // Regras específicas do Node.js
        'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
        'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'warn',

        // Regras de qualidade de código
        'no-unused-vars': ['error', {
            'vars': 'all',
            'args': 'after-used',
            'ignoreRestSiblings': false
        }],
        'no-undef': 'error',
        'prefer-const': 'error',
        'no-var': 'error'
    },
    overrides: [
        {
            // Configurações específicas para arquivos de teste
            files: ['**/*.test.js', '**/*.spec.js', '**/tests/**/*.js'],
            rules: {
                'no-unused-expressions': 'off' // Para chai expectations
            }
        }
    ]
};

// ============================================================================

// // .eslintrc.json (alternativa em JSON)
// {
//     "env": {
//         "browser": true,
//         "commonjs": true,
//         "es2021": true,
//         "node": true,
//         "jest": true
//     },
//     "extends": ["standard"],
//     "parserOptions": {
//         "ecmaVersion": "latest"
//     },
//     "rules": {
//         "indent": ["error", 4, {
//             "SwitchCase": 1,
//             "VariableDeclarator": 1,
//             "outerIIFEBody": 1,
//             "MemberExpression": 1,
//             "FunctionDeclaration": { "parameters": 1, "body": 1 },
//             "FunctionExpression": { "parameters": 1, "body": 1 },
//             "CallExpression": { "arguments": 1 },
//             "ArrayExpression": 1,
//             "ObjectExpression": 1,
//             "ImportDeclaration": 1,
//             "flatTernaryExpressions": false,
//             "ignoreComments": false
//         }],
//         "semi": ["error", "always"],
//         "quotes": ["error", "single"],
//         "comma-dangle": ["error", "never"],
//         "space-before-function-paren": ["error", {
//             "anonymous": "always",
//             "named": "never",
//             "asyncArrow": "always"
//         }],
//         "no-console": "off",
//         "no-unused-vars": ["error", { 
//             "vars": "all", 
//             "args": "after-used" 
//         }]
//     }
// }

// // ============================================================================

// // package.json atualizado
// {
//     "name": "strava-activity-reader",
//     "version": "2.0.0",
//     "description": "Strava Activity Reader with Video Synchronization - SOLID Architecture",
//     "main": "server.js",
//     "scripts": {
//         "start": "node server.js",
//         "dev": "NODE_ENV=development nodemon server.js",
//         "test": "jest",
//         "test:watch": "jest --watch",
//         "test:coverage": "jest --coverage",
//         "lint": "eslint src/ tests/ --ext .js",
//         "lint:fix": "eslint src/ tests/ --ext .js --fix",
//         "lint:check": "eslint src/ tests/ --ext .js --max-warnings 0",
//         "format": "eslint src/ tests/ --ext .js --fix",
//         "validate": "npm run lint:check && npm run test",
//         "precommit": "npm run lint:fix && npm run test"
//     },
//     "devDependencies": {
//         "nodemon": "^3.0.1",
//         "jest": "^29.7.0",
//         "supertest": "^6.3.3",
//         "eslint": "^8.57.0",
//         "eslint-config-standard": "^17.1.0",
//         "eslint-plugin-import": "^2.29.0",
//         "eslint-plugin-n": "^16.6.0",
//         "eslint-plugin-promise": "^6.1.0"
//     },
//     "eslintConfig": {
//         "extends": ["standard"],
//         "rules": {
//             "indent": ["error", 4],
//             "semi": ["error", "always"],
//             "quotes": ["error", "single"]
//         }
//     }
// }

// // ============================================================================

// .editorconfig (configuração do editor)
// root = true

// [*]
// charset = utf-8
// end_of_line = lf
// insert_final_newline = true
// trim_trailing_whitespace = true

// [*.js]
// indent_style = space
// indent_size = 4

// [*.json]
// indent_style = space
// indent_size = 4

// [*.md]
// trim_trailing_whitespace = false

// [*.{yml,yaml}]
// indent_style = space
// indent_size = 2

// ============================================================================

// .prettierrc (se usar Prettier junto com ESLint)
// {
//     "semi": true,
//     "trailingComma": "none",
//     "singleQuote": true,
//     "printWidth": 100,
//     "tabWidth": 4,
//     "useTabs": false,
//     "bracketSpacing": true,
//     "bracketSameLine": false,
//     "arrowParens": "avoid",
//     "endOfLine": "lf"
// }

// ============================================================================

// VS Code settings.json (configuração específica do projeto)
// {
//     "editor.tabSize": 4,
//     "editor.insertSpaces": true,
//     "editor.detectIndentation": false,
//     "editor.formatOnSave": true,
//     "editor.codeActionsOnSave": {
//         "source.fixAll.eslint": true
//     },
//     "eslint.validate": [
//         "javascript",
//         "javascriptreact"
//     ],
//     "eslint.format.enable": true,
//     "javascript.preferences.quoteStyle": "single",
//     "typescript.preferences.quoteStyle": "single"
// }