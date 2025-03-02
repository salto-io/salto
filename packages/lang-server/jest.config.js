/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
const deepMerge = require('../../build_utils/deep_merge')

module.exports = deepMerge(require('../../jest.base.config.js'), {
  displayName: 'salto-lang-server',
  rootDir: `${__dirname}`,
  collectCoverageFrom: [
    // This file is only used as a bridge with vsc. The overhead of mocking vsc has bad ROI.
    '!**/extension.*',
    '!**/adapters.*',
    '!**/providers.*',
    '!**/events.*',
    '!**/commands.*',
    '!**/output.*',
  ],
  coverageThreshold: {
    // Slowly start increasing here, never decrease!
    global: {
      branches: 16.0,
      functions: 35.65,
      lines: 42.72,
      statements: 41.55,
    },
  },
  setupFilesAfterEnv: ['@salto-io/adapter-api-test-utils/all'],
})
