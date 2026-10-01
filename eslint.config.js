import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Module boundaries (see docs/architecture.md):
 * - src/core   headless, deterministic Game core: no DOM, no clock, no unseeded randomness,
 *              imports nothing outside src/core.
 * - src/render pure renderer: view -> pixels. May import core types, never platform code.
 * - src/platform browser adapters (shell, input, storage, audio). May import core and render.
 */
const nondeterministicGlobals = [
  { name: 'window', message: 'The Game core is headless: no DOM.' },
  { name: 'document', message: 'The Game core is headless: no DOM.' },
  { name: 'navigator', message: 'The Game core is headless: no DOM.' },
  { name: 'localStorage', message: 'Use the StoragePort passed to createGame.' },
  { name: 'performance', message: 'The Game core has no clock: advance it with tick().' },
  { name: 'Date', message: 'The Game core has no clock: advance it with tick().' },
  { name: 'setTimeout', message: 'The Game core has no clock: advance it with tick().' },
  { name: 'setInterval', message: 'The Game core has no clock: advance it with tick().' },
  { name: 'requestAnimationFrame', message: 'The Game core has no clock.' },
  { name: 'crypto', message: 'Use the seeded Rng.' },
];

const headlessRules = {
  'no-restricted-globals': ['error', ...nondeterministicGlobals],
  'no-restricted-properties': [
    'error',
    { object: 'Math', property: 'random', message: 'Use the seeded Rng.' },
  ],
};

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'test-results', 'playwright-report', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      ...headlessRules,
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/render', '**/render/**', '**/platform', '**/platform/**'],
              message: 'src/core must not depend on the renderer or platform adapters.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/render/**/*.ts'],
    rules: {
      ...headlessRules,
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/platform', '**/platform/**'],
              message: 'src/render must not depend on platform adapters.',
            },
            {
              group: ['**/core/*', '!**/core/index'],
              message: 'Import the Game core through its public entry point (src/core).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/platform/**/*.ts', 'src/main.ts', 'tests/**/*.ts', 'e2e/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/core/*', '!**/core/index'],
              message: 'Import the Game core through its public entry point (src/core).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/platform/**/*.ts', 'src/main.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['tests/**/*.ts', 'e2e/**/*.ts', '*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
);
