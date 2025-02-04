/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { StaticFilesCache } from '../../src/workspace/static_files/cache'

export const mockStaticFilesCache = (): MockInterface<StaticFilesCache> => ({
  get: mockFunction<StaticFilesCache['get']>().mockResolvedValue(undefined),
  put: mockFunction<StaticFilesCache['put']>(),
  putMany: mockFunction<StaticFilesCache['putMany']>(),
  delete: mockFunction<StaticFilesCache['delete']>(),
  deleteMany: mockFunction<StaticFilesCache['deleteMany']>(),
  flush: mockFunction<StaticFilesCache['flush']>(),
  clear: mockFunction<StaticFilesCache['clear']>(),
  rename: mockFunction<StaticFilesCache['rename']>(),
  clone: mockFunction<StaticFilesCache['clone']>(),
  list: mockFunction<StaticFilesCache['list']>(),
})
