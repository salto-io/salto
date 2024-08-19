/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { filterUtils } from '@salto-io/adapter-components'
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/macro'

import { MACRO_TYPE_NAME, ZENDESK } from '../../src/constants'
import { createFilterCreatorParams } from '../utils'

describe('macro filter', () => {
  type FilterType = filterUtils.FilterWith<'preDeploy' | 'onDeploy'>
  let filter: FilterType

  const macroType = new ObjectType({ elemID: new ElemID(ZENDESK, MACRO_TYPE_NAME) })

  const macroNoRestrictionInstance = new InstanceElement('no restriction', macroType, {})
  const macroRestrictionInstance = new InstanceElement('restriction', macroType, {
    restriction: {
      type: 'User',
      id: 1234,
    },
  })

  beforeEach(async () => {
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })

  describe('preDeploy', () => {
    it('should add restriction as null for macro with no restriction deploy', async () => {
      const macroNoRestrictionInstanceCopy = macroNoRestrictionInstance.clone()
      await filter.preDeploy([
        toChange({ before: macroNoRestrictionInstanceCopy, after: macroNoRestrictionInstanceCopy }),
        toChange({ after: macroRestrictionInstance }),
      ])
      expect(macroNoRestrictionInstanceCopy.value.restriction).toBeDefined()
      expect(macroNoRestrictionInstanceCopy.value.restriction).toEqual(null)
      expect(macroRestrictionInstance.value.restriction).toEqual({ type: 'User', id: 1234 })
    })
  })

  describe('onDeploy', () => {
    const macroNullRestrictionInstance = new InstanceElement('restriction', macroType, {
      restriction: null,
    })
    it('should omit restriction if it is equal null', async () => {
      await filter.onDeploy([
        toChange({ after: macroNullRestrictionInstance }),
        toChange({ after: macroRestrictionInstance }),
        toChange({ after: macroNoRestrictionInstance }),
      ])
      expect(macroNullRestrictionInstance.value.restriction).not.toBeDefined()
      expect(macroNoRestrictionInstance.value.restriction).not.toBeDefined()
      expect(macroRestrictionInstance.value.restriction).toEqual({ type: 'User', id: 1234 })
    })
  })
})
