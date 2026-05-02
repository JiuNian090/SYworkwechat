const wechatGlobals = {
  wx: 'readonly',
  App: 'readonly',
  Page: 'readonly',
  getApp: 'readonly',
  getCurrentPages: 'readonly',
  Component: 'readonly',
  Behavior: 'readonly'
};

const nodeGlobals = {
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  setImmediate: 'readonly',
  clearImmediate: 'readonly',
  require: 'readonly',
  module: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  exports: 'writable',
  process: 'readonly',
  Buffer: 'readonly',
  Promise: 'readonly',
  global: 'readonly',
  URL: 'readonly',
  Map: 'readonly',
  Set: 'readonly',
  WeakMap: 'readonly',
  WeakSet: 'readonly',
  Symbol: 'readonly',
  Reflect: 'readonly',
  Proxy: 'readonly',
  Int8Array: 'readonly',
  Uint8Array: 'readonly',
  Uint8ClampedArray: 'readonly',
  Int16Array: 'readonly',
  Uint16Array: 'readonly',
  Int32Array: 'readonly',
  Uint32Array: 'readonly',
  Float32Array: 'readonly',
  Float64Array: 'readonly',
  BigInt64Array: 'readonly',
  BigUint64Array: 'readonly',
  BigInt: 'readonly',
  DataView: 'readonly',
  ArrayBuffer: 'readonly',
  SharedArrayBuffer: 'readonly',
  Atomics: 'readonly',
  Error: 'readonly',
  TypeError: 'readonly',
  RangeError: 'readonly',
  SyntaxError: 'readonly',
  ReferenceError: 'readonly',
  EvalError: 'readonly',
  URIError: 'readonly',
  JSON: 'readonly',
  Math: 'readonly',
  Date: 'readonly',
  RegExp: 'readonly',
  parseInt: 'readonly',
  parseFloat: 'readonly',
  isNaN: 'readonly',
  isFinite: 'readonly',
  decodeURI: 'readonly',
  encodeURI: 'readonly',
  decodeURIComponent: 'readonly',
  encodeURIComponent: 'readonly',
  NaN: 'readonly',
  Infinity: 'readonly',
  undefined: 'readonly'
};

const commonRules = {
  'no-var': 'warn',
  'prefer-const': 'warn',
  'no-undef': 'error',
  'no-unused-vars': ['warn', { args: 'none' }],
  'no-extra-semi': 'error',
  'no-irregular-whitespace': 'error',
  'no-trailing-spaces': 'warn',
  'eol-last': ['warn', 'always'],
  'semi': ['warn', 'always'],
  'quotes': ['warn', 'single', { avoidEscape: true }],
  'comma-dangle': ['warn', 'never'],
  'no-cond-assign': ['error', 'always'],
  'no-dupe-keys': 'error',
  'no-duplicate-case': 'error',
  'no-empty': ['error', { allowEmptyCatch: true }],
  'no-func-assign': 'error',
  'no-obj-calls': 'error',
  'no-sparse-arrays': 'error',
  'no-unreachable': 'error',
  'valid-typeof': 'error',
  'no-redeclare': 'error',
  'no-inner-declarations': ['error', 'both'],
  'no-shadow-restricted-names': 'error',
  'array-callback-return': 'warn',
  'eqeqeq': ['warn', 'always', { null: 'ignore' }],
  'no-caller': 'error',
  'no-eval': 'error',
  'no-extend-native': 'error',
  'no-implied-eval': 'error',
  'no-labels': 'error',
  'no-loop-func': 'warn',
  'no-new-wrappers': 'error',
  'no-proto': 'error',
  'no-return-assign': 'warn',
  'no-script-url': 'error',
  'no-self-compare': 'warn',
  'no-sequences': 'error',
  'no-throw-literal': 'error',
  'no-useless-call': 'warn',
  'no-useless-return': 'warn',
  'no-with': 'error',
  'radix': 'warn',
  'no-delete-var': 'error',
  'no-label-var': 'error',
  'handle-callback-err': 'warn',
  'no-mixed-requires': 'warn',
  'no-new-require': 'error',
  'no-path-concat': 'error',
  'no-process-exit': 'off'
};

const tsRules = {
  '@typescript-eslint/no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
  '@typescript-eslint/no-explicit-any': 'off',
  '@typescript-eslint/explicit-function-return-type': 'off',
  '@typescript-eslint/no-require-imports': 'off',
  '@typescript-eslint/no-var-requires': 'off',
  '@typescript-eslint/no-non-null-assertion': 'off',
  '@typescript-eslint/ban-ts-comment': 'off'
};

module.exports = [
  {
    ignores: ['**/node_modules/**', '**/miniprogram_npm/**', '**/vendor/**', '**/.trae/**', '**/miniprogram_dist/**']
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: {
        ...nodeGlobals,
        ...wechatGlobals
      }
    },
    rules: commonRules
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: {
        ...nodeGlobals,
        ...wechatGlobals
      },
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        project: './tsconfig.json',
        ecmaFeatures: {
          impliedStrict: true
        }
      }
    },
    plugins: {
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin')
    },
    rules: {
      ...commonRules,
      ...tsRules,
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-redeclare': 'off'
    }
  },
  {
    files: ['cloudfunctions/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: {
        ...nodeGlobals,
        wx: 'readonly'
      }
    },
    rules: commonRules
  },
  {
    files: ['version-manager.js', 'sync_changelog.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: {
        ...nodeGlobals
      }
    },
    rules: commonRules
  }
];
