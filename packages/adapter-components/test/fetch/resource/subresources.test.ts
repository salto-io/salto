/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { recurseIntoSubresources } from '../../../src/fetch/resource/subresources'
import { FetchResourceDefinition } from '../../../src/definitions/system/fetch/resource'
import { TypeFetcherCreator } from '../../../src/fetch/types'

describe('subresources', () => {
  describe('recurseIntoSubresources', () => {
    const typeFetcherCreator: TypeFetcherCreator = jest.fn().mockImplementation(() => ({
      fetch: jest.fn().mockResolvedValue({ success: true }),
      done: jest.fn().mockReturnValue(true),
      getItems: jest.fn().mockReturnValue([{ typeName: 'mySubType', value: { test: 'test' }, context: {} }]),
    }))

    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should extract request arg from field using fromField', async () => {
      const def: Record<string, FetchResourceDefinition> = {
        myType: {
          directFetch: false,
          recurseInto: {
            mySubType: {
              typeName: 'mySubType',
              context: { args: { id: { fromField: 'id' }, name: { fromField: 'name' } } },
            },
          },
        },
        mySubType: { directFetch: false },
      }

      const recurseIntoFunc = recurseIntoSubresources({
        def: def.myType,
        typeFetcherCreator,
        contextResources: {},
      })
      const myTypeValue = { id: '123', name: 'parent' }
      await recurseIntoFunc({ typeName: 'myType', value: myTypeValue, context: {} })
      expect(typeFetcherCreator).toHaveBeenCalledWith({ typeName: 'mySubType', context: { id: '123', name: 'parent' } })
    })
    it('should extract request arg from using recurseInto transformation', async () => {
      const def: Record<string, FetchResourceDefinition> = {
        myType: {
          directFetch: false,
          recurseInto: {
            mySubType: {
              typeName: 'mySubType',
              context: { args: { id: { transformation: { root: 'nested', pick: ['id', 'nestedId'] } } } },
            },
          },
        },
        mySubType: { directFetch: false },
      }

      const recurseIntoFunc = recurseIntoSubresources({
        def: def.myType,
        typeFetcherCreator,
        contextResources: {},
      })
      const myTypeValueA = { id: '123', nested: { id: '234', nestedId: '345' } }
      await recurseIntoFunc({ typeName: 'myType', value: myTypeValueA, context: {} })
      expect(typeFetcherCreator).toHaveBeenNthCalledWith(1, { typeName: 'mySubType', context: { id: ['234', '345'] } })

      const myTypeValueB = { id: '123', nested: { id: ['234', '456'], nestedId: '345' } }
      await recurseIntoFunc({ typeName: 'myType', value: myTypeValueB, context: {} })
      expect(typeFetcherCreator).toHaveBeenNthCalledWith(2, {
        typeName: 'mySubType',
        context: { id: ['234', '456', '345'] },
      })
    })
    it('should extract request arg from using recurseInto transformation with adjust function', async () => {
      const def: Record<string, FetchResourceDefinition> = {
        myType: {
          directFetch: false,
          recurseInto: {
            mySubType: {
              typeName: 'mySubType',
              context: {
                args: {
                  id: { transformation: { adjust: () => ({ value: ['custom'] }) } },
                  name: { fromField: 'name' },
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
      })

      const myTypeValue = { id: '123', name: 'foo' }
      await recurseIntoFunc({ typeName: 'myType', value: myTypeValue, context: {} })
      expect(typeFetcherCreator).toHaveBeenNthCalledWith(1, {
        typeName: 'mySubType',
        context: { id: ['custom'], name: 'foo' },
      })
    })
  })
})
