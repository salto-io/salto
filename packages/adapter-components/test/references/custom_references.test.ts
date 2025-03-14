/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, GetCustomReferencesFunc, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { combineCustomReferenceGetters } from '../../src/references/custom_references'

describe('combineCustomReferenceGetters', () => {
  const adapterConfigType = new ObjectType({
    elemID: new ElemID('adapter'),
    isSettings: true,
  })
  const customRefsGetters: Record<string, GetCustomReferencesFunc> = {
    strong: async () => [
      {
        source: new ElemID('adapter', 'type1', 'instance', 'inst1'),
        target: new ElemID('adapter', 'type1', 'instance', 'inst2'),
        type: 'strong',
      },
      {
        source: new ElemID('adapter', 'type2', 'instance', 'inst1'),
        target: new ElemID('adapter', 'type2', 'instance', 'inst2'),
        type: 'strong',
      },
    ],
    weak: async () => [
      {
        source: new ElemID('adapter', 'type1', 'instance', 'inst1'),
        target: new ElemID('adapter', 'type1', 'instance', 'inst2'),
        type: 'weak',
      },
    ],
  }
  const getCustomRefsAdapterConfigValue = (config: InstanceElement): Record<string, boolean> => config.value.customRefs
  let adapterConfig: InstanceElement

  describe('When there is no config related to custom references', () => {
    beforeEach(() => {
      adapterConfig = new InstanceElement(ElemID.CONFIG_NAME, adapterConfigType)
    })
    it('should run all the custom reference getters', async () => {
      const getCustomReferencesFunc = combineCustomReferenceGetters(customRefsGetters)

      const refs = await getCustomReferencesFunc([], adapterConfig)

      expect(refs).toEqual([
        {
          source: new ElemID('adapter', 'type1', 'instance', 'inst1'),
          target: new ElemID('adapter', 'type1', 'instance', 'inst2'),
          type: 'weak',
        },
        {
          source: new ElemID('adapter', 'type2', 'instance', 'inst1'),
          target: new ElemID('adapter', 'type2', 'instance', 'inst2'),
          type: 'strong',
        },
      ])
    })
  })
  describe('When there is no config related to one type of custom references', () => {
    beforeEach(() => {
      adapterConfig = new InstanceElement(ElemID.CONFIG_NAME, adapterConfigType, {
        strong: true,
      })
    })
    it('should run all the custom reference getters', async () => {
      const getCustomReferencesFunc = combineCustomReferenceGetters(customRefsGetters)

      const refs = await getCustomReferencesFunc([], adapterConfig)

      expect(refs).toEqual([
        {
          source: new ElemID('adapter', 'type1', 'instance', 'inst1'),
          target: new ElemID('adapter', 'type1', 'instance', 'inst2'),
          type: 'weak',
        },
        {
          source: new ElemID('adapter', 'type2', 'instance', 'inst1'),
          target: new ElemID('adapter', 'type2', 'instance', 'inst2'),
          type: 'strong',
        },
      ])
    })
  })
  describe('When the config enables custom references', () => {
    beforeEach(() => {
      adapterConfig = new InstanceElement(ElemID.CONFIG_NAME, adapterConfigType, {
        customRefs: {
          strong: true,
          weak: true,
        },
      })
    })
    it('Should create custom references', async () => {
      const getCustomReferencesFunc = combineCustomReferenceGetters(customRefsGetters, getCustomRefsAdapterConfigValue)

      const refs = await getCustomReferencesFunc([], adapterConfig)

      expect(refs).toEqual([
        {
          source: new ElemID('adapter', 'type1', 'instance', 'inst1'),
          target: new ElemID('adapter', 'type1', 'instance', 'inst2'),
          type: 'weak',
        },
        {
          source: new ElemID('adapter', 'type2', 'instance', 'inst1'),
          target: new ElemID('adapter', 'type2', 'instance', 'inst2'),
          type: 'strong',
        },
      ])
    })
  })
  describe('When the config disables all custom references', () => {
    beforeEach(() => {
      adapterConfig = new InstanceElement(ElemID.CONFIG_NAME, adapterConfigType, {
        customRefs: {
          strong: false,
          weak: false,
        },
      })
    })
    it('Should not create custom references', async () => {
      const getCustomReferencesFunc = combineCustomReferenceGetters(customRefsGetters, getCustomRefsAdapterConfigValue)

      const refs = await getCustomReferencesFunc([], adapterConfig)

      expect(refs).toHaveLength(0)
    })
  })
  describe('When the config disables some custom references', () => {
    beforeEach(() => {
      adapterConfig = new InstanceElement(ElemID.CONFIG_NAME, adapterConfigType, {
        customRefs: {
          weak: false,
        },
      })
    })
    it('Should only create the configured references', async () => {
      const getCustomReferencesFunc = combineCustomReferenceGetters(customRefsGetters, getCustomRefsAdapterConfigValue)

      const refs = await getCustomReferencesFunc([], adapterConfig)

      expect(refs).toEqual([
        {
          source: new ElemID('adapter', 'type1', 'instance', 'inst1'),
          target: new ElemID('adapter', 'type1', 'instance', 'inst2'),
          type: 'strong',
        },
        {
          source: new ElemID('adapter', 'type2', 'instance', 'inst1'),
          target: new ElemID('adapter', 'type2', 'instance', 'inst2'),
          type: 'strong',
        },
      ])
    })
  })
})
