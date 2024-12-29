/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Adapter, ElemID, GetCustomReferencesFunc, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { mockFunction } from '@salto-io/test-utils'
import { getCustomReferences } from '../../src/local-workspace/workspace'
import { adapterCreators } from '../../src/core/adapters'
import { mockAdaptersConfigSource } from '../common/workspace'

describe('local workspace', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('getCustomReferences', () => {
    let instance: InstanceElement
    const adaptersConfigSource = mockAdaptersConfigSource()

    beforeEach(() => {
      const type = new ObjectType({
        elemID: new ElemID('test2', 'type'),
      })
      instance = new InstanceElement('instance', type, {
        field: 'val',
      })

      const mockTestAdapter = {
        getCustomReferences: mockFunction<GetCustomReferencesFunc>().mockResolvedValue([
          {
            source: new ElemID('test2', 'type', 'instance', 'inst1'),
            target: new ElemID('test2', 'type', 'instance', 'inst2'),
            type: 'strong',
          },
        ]),
      }

      const mockTest2Adapter = {
        getCustomReferences: mockFunction<GetCustomReferencesFunc>().mockResolvedValue([
          {
            source: new ElemID('test2', 'type', 'instance', 'inst3'),
            target: new ElemID('test2', 'type', 'instance', 'inst4'),
            type: 'strong',
          },
        ]),
      }

      adapterCreators.test = mockTestAdapter as unknown as Adapter
      adapterCreators.test2 = mockTest2Adapter as unknown as Adapter
    })
    it('Should call the right adapter getCustomReferences', async () => {
      const AdapterConfigType = new ObjectType({
        elemID: new ElemID('adapter'),
        isSettings: true,
      })
      const adapterConfig = new InstanceElement(ElemID.CONFIG_NAME, AdapterConfigType)
      await adaptersConfigSource.setAdapter('test2', 'test', adapterConfig)
      const references = await getCustomReferences([instance], { test2: 'test' }, adaptersConfigSource)
      expect(references).toEqual([
        {
          source: new ElemID('test2', 'type', 'instance', 'inst1'),
          target: new ElemID('test2', 'type', 'instance', 'inst2'),
          type: 'strong',
        },
      ])
    })

    it('Should use the adapter name when it is not present in the account to service name mapping', async () => {
      const references = await getCustomReferences([instance], {}, adaptersConfigSource)
      expect(references).toEqual([
        {
          source: new ElemID('test2', 'type', 'instance', 'inst3'),
          target: new ElemID('test2', 'type', 'instance', 'inst4'),
          type: 'strong',
        },
      ])
    })

    it('Should return empty array if adapter does not have getCustomReferences func', async () => {
      adapterCreators.test = {} as unknown as Adapter
      const references = await getCustomReferences([instance], { test2: 'test' }, adaptersConfigSource)
      expect(references).toEqual([])
    })

    it('Should not access the adapter config if adapter does not have getCustomReferences func', async () => {
      adapterCreators.test = {} as unknown as Adapter
      const references = await getCustomReferences([instance], { test2: 'test' }, adaptersConfigSource)
      expect(adaptersConfigSource.getAdapter).not.toHaveBeenCalled()
      expect(references).toEqual([])
    })

    it('Should return empty array if adapter getCustomReferences throws an error', async () => {
      adapterCreators.test = {
        getCustomReferences: mockFunction<GetCustomReferencesFunc>().mockRejectedValue(new Error('aaa')),
      } as unknown as Adapter
      const references = await getCustomReferences([instance], { test2: 'test' }, adaptersConfigSource)
      expect(references).toEqual([])
    })
  })
})
