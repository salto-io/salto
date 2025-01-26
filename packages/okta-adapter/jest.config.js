/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
const deepMerge = require('../../build_utils/deep_merge')

module.exports = deepMerge(require('../../jest.base.config.js'), {
  displayName: 'okta-adapter',
  rootDir: `${__dirname}`,
  testEnvironment: process.env.RUN_E2E_TESTS ? '@salto-io/okta-adapter/dist/e2e_test/jest_environment' : undefined,
  collectCoverageFrom: ['!<rootDir>/index.ts'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 92,
      lines: 92,
      statements: 92,
    },
  },
  setupFilesAfterEnv: ['@salto-io/jest-extended/all', '@salto-io/element-test-utils/all'],
  moduleNameMapper: {
    // Force CommonJS build for http adapter to be available.
    // via https://github.com/axios/axios/issues/5101#issuecomment-1276572468
    '^axios$': require.resolve('axios'),
  },
})
