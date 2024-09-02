/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { InstanceElement, ElemID, ObjectType } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { adapter } from '../../src/adapter_creator'
import { fixElementsFunc, getCustomReferences } from '../../src/custom_references/handlers'

describe('custom references handlers', () => {
  const elementsSource = buildElementsSourceFromElements([])

  describe('with no adapter configuration', () => {
    it('should define a custom references getter', async () => {
      expect(await getCustomReferences([])).toEqual([])
    })

    it('should define an elements fixer', async () => {
      expect(await fixElementsFunc({ elementsSource, config: {} })([])).toEqual({
        fixedElements: [],
        errors: [],
      })
    })
  })

  describe('with no configuration', () => {
    const config = {
      fetch: {
        data: {
          includeObjects: [],
          saltoIDSettings: { defaultIdFields: [] },
          customReferences: {
            profiles: true,
          },
          fixElements: {
            profiles: true,
          },
        },
      },
    }
    const adapterConfig = new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, config)
    it('should define a custom references getter', async () => {
      expect(await getCustomReferences([], adapterConfig)).toEqual([])
    })

    it('should define an elements fixer', async () => {
      expect(await fixElementsFunc({ elementsSource, config })([])).toEqual({
        fixedElements: [],
        errors: [],
      })
    })
  })
})
