/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
const deepMerge = require('../../build_utils/deep_merge')

module.exports = deepMerge(require('../../jest.base.config.js'), {
  displayName: 'cli',
  rootDir: `${__dirname}`,
  collectCoverageFrom: [
    '!<rootDir>/src/callbacks.ts',
    '!<rootDir>/index.ts',
    '!<rootDir>/package_native.ts',
    '!<rootDir>/bundle.ts',
  ],
  testEnvironment: process.env.RUN_E2E_TESTS ? '@salto-io/cli/dist/e2e_test/jest_environment' : undefined,
  coverageThreshold: {
    // Slowly start increasing here, never decrease!
    global: {
      branches: 81.09,
      functions: 89.75,
      lines: 94.7,
      statements: 94.75,
    },
  },
  setupFilesAfterEnv: ['@salto-io/adapter-api-test-utils/all'],
})
