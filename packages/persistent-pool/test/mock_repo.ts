/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { mockFunction } from '@salto-io/test-utils'
import { Pool, LeaseWithStatus } from '../src/types'

export const createMockPool = <T>(): jest.Mocked<Pool<T>> => ({
  [Symbol.asyncIterator]: jest.fn<AsyncIterator<LeaseWithStatus<T>>, []>(),
  register: mockFunction<Pool<T>['register']>(),
  unregister: mockFunction<Pool<T>['unregister']>(),
  suspend: mockFunction<Pool<T>['suspend']>(),
  lease: mockFunction<Pool<T>['lease']>(),
  waitForLease: mockFunction<Pool<T>['waitForLease']>(),
  updateTimeout: mockFunction<Pool<T>['updateTimeout']>(),
  return: mockFunction<Pool<T>['return']>(),
  clear: mockFunction<Pool<T>['clear']>(),
})
