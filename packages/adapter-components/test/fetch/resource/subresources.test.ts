/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { recurseIntoSubresources } from '../../../src/fetch/resource/subresources'
import { FetchResourceDefinition } from '../../../src/definitions/system/fetch/resource'
import { TypeFetcherCreator } from '../../../src/fetch/types'

describe('subresources', () => {
  describe('recurseIntoSubresources', () => {
    const mockHandleError = jest.fn()
    const mockFetch = jest.fn()
    const typeFetcherCreator: TypeFetcherCreator = jest.fn().mockImplementation(() => ({
      fetch: mockFetch,
      done: jest.fn().mockReturnValue(true),
      getItems: jest.fn().mockReturnValue([{ typeName: 'mySubType', value: { test: 'test' }, context: {} }]),
    }))

    const def: Record<string, FetchResourceDefinition> = {
      myType: {
        directFetch: false,
        recurseInto: {
          mySubType: {
            typeName: 'mySubType',
            context: {
              args: {
                id: { root: 'id' },
                domain: { adjust: async () => ({ value: ['custom'] }) },
                context: { root: 'nested', pick: ['nestedId'], single: true },
              },
            },
          },
        },
      },
      mySubType: { directFetch: false },
    }

    const recurseIntoFunc = recurseIntoSubresources({
      def: def.myType,
      typeFetcherCreator,
      contextResources: {},
      handleError: mockHandleError,
    })

    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should extract request args properly', async () => {
      mockFetch.mockResolvedValue({ success: true })
      const myTypeValue = { id: '123', nested: { id: '234', nestedId: '345' } }
      await recurseIntoFunc({ typeName: 'myType', value: myTypeValue, context: {} })
      expect(typeFetcherCreator).toHaveBeenCalledWith({
        typeName: 'mySubType',
        context: { id: ['123'], domain: [['custom']], context: { nestedId: '345' } },
      })
    })

    it('should call handle error when fetch fails', async () => {
      mockFetch.mockResolvedValue({ success: false, error: new Error('failed') })
      const myTypeValue = { id: '123', nested: { id: '234', nestedId: '345' } }
      await recurseIntoFunc({ typeName: 'myType', value: myTypeValue, context: {} })
      expect(mockHandleError).toHaveBeenCalledWith({ typeName: 'mySubType', error: new Error('failed') })
    })
  })
})
