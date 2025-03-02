/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
const deepMerge = require('../../build_utils/deep_merge')

module.exports = deepMerge(require('../../jest.base.config.js'), {
  displayName: 'salto-workspace',
  rootDir: `${__dirname}`,
  collectCoverageFrom: [
    '!**/hcl.ts', // Generated parser file
    '!<rootDir>/index.ts',
  ],
  coverageThreshold: {
    // Slowly start increasing here, never decrease!
    global: {
      branches: 83.22,
      functions: 87,
      lines: 85,
      statements: 90,
    },
  },
  setupFilesAfterEnv: ['@salto-io/adapter-api-test-utils/all'],
})
