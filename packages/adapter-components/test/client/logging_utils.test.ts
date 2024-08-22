/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { createResponseLogFilter } from '../../src/client/logging_utils'

describe('logging_utils', () => {
  describe('createResponseLogFilter', () => {
    it('should return "full" for small responses when no config is provided', async () => {
      expect(createResponseLogFilter()({ responseText: 'aaa', url: 'aaa' })).toEqual('full')
      expect(createResponseLogFilter({ responseStrategies: [] })({ responseText: 'aaa', url: 'aaa' })).toEqual('full')
    })
    it('should return "truncate" for large responses when no config is provided', async () => {
      expect(createResponseLogFilter()({ responseText: _.repeat('a', 10 * 1000 + 1), url: '' })).toEqual('truncate')
    })

    it('should choose matching strategy by url', async () => {
      const filter = createResponseLogFilter({
        responseStrategies: [
          { pattern: 'permissions$', strategy: 'omit' },
          { pattern: '\\/a\\/b', strategy: 'truncate' },
        ],
      })
      expect(filter({ responseText: 'aaa', url: '/permissions/somethingelse' })).toEqual('full')
      expect(filter({ responseText: 'aaa', url: '/x/permissions' })).toEqual('omit')
      expect(filter({ responseText: 'aaa', url: '/a/b' })).toEqual('truncate')
    })

    it('should choose matching strategy by size', async () => {
      const filter = createResponseLogFilter({
        responseStrategies: [
          { size: 5, strategy: 'truncate' },
          { size: 2, strategy: 'omit' },
        ],
      })
      expect(filter({ responseText: '1', url: '' })).toEqual('full')
      expect(filter({ responseText: '123', url: '' })).toEqual('omit')
      expect(filter({ responseText: '123456', url: '' })).toEqual('truncate')
    })

    it('should choose matching strategy by numItems and choose the first matching strategy', async () => {
      const filter1 = createResponseLogFilter({
        responseStrategies: [
          { numItems: 1, strategy: 'omit' },
          { numItems: 3, strategy: 'truncate' },
        ],
      })
      expect(filter1({ responseText: 'aaa', url: '' })).toEqual('full')
      expect(filter1({ responseText: 'aaa', url: '' })).toEqual('omit')
      expect(filter1({ responseText: 'aaa', url: '' })).toEqual('omit')
      expect(filter1({ responseText: 'aaa', url: '' })).toEqual('omit')

      const filter2 = createResponseLogFilter({
        responseStrategies: [
          { numItems: 3, strategy: 'truncate' },
          { numItems: 1, strategy: 'omit' },
        ],
      })
      expect(filter2({ responseText: 'aaa', url: '' })).toEqual('full')
      expect(filter2({ responseText: 'aaa', url: '' })).toEqual('omit')
      expect(filter2({ responseText: 'aaa', url: '' })).toEqual('omit')
      expect(filter2({ responseText: 'aaa', url: '' })).toEqual('truncate')
    })

    it('should count by pattern when provided and choose the first matching startegy', async () => {
      const filter = createResponseLogFilter({
        responseStrategies: [
          { numItems: 3, strategy: 'truncate' },
          { numItems: 1, pattern: 'permissions', strategy: 'omit' },
        ],
      })
      expect(filter({ responseText: 'aaa', url: '/permissions' })).toEqual('full')
      expect(filter({ responseText: 'aaa', url: '/permissions' })).toEqual('omit')
      expect(filter({ responseText: 'aaa', url: '/somethingelse' })).toEqual('full')
      expect(filter({ responseText: 'aaa', url: '/somethingelse' })).toEqual('truncate')
      expect(filter({ responseText: 'aaa', url: '/permissions' })).toEqual('truncate')
    })

    it('should allow complex conditions', async () => {
      const filter = createResponseLogFilter({
        responseStrategies: [
          { numItems: 5, strategy: 'omit' },
          { size: 20, strategy: 'truncate' },
          { pattern: 'permissions', size: 2, strategy: 'truncate' },
          { numItems: 3, pattern: '\\/a\\/b', strategy: 'truncate' },
        ],
      })
      expect(filter({ responseText: 'aaa', url: '/permissions' })).toEqual('truncate')
      expect(filter({ responseText: 'aaa', url: '/a/b' })).toEqual('full')
      expect(filter({ responseText: 'aaa', url: '/a/b' })).toEqual('full')
      expect(filter({ responseText: _.repeat('a', 20), url: '/a/b' })).toEqual('truncate')
      expect(filter({ responseText: 'aaa', url: '/permissions' })).toEqual('truncate')
      expect(filter({ responseText: 'aaa', url: '/a/b' })).toEqual('omit')
      expect(filter({ responseText: 'aaa', url: '/permissions' })).toEqual('omit')
    })
  })
})
