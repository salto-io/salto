/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
const deepMerge = require('../../build_utils/deep_merge')

module.exports = deepMerge(require('../../jest.base.config.js'), {
  displayName: 'microsoft-security-adapter-e2e',
  rootDir: `${__dirname}`,
  collectCoverageFrom: ['!<rootDir>/index.ts'],
  testEnvironment: process.env.RUN_E2E_TESTS
    ? '@salto-io/microsoft-security-adapter-e2e/dist/e2e_test/jest_environment'
    : undefined,
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  setupFilesAfterEnv: ['@salto-io/element-test-utils/all'],
})
