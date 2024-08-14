/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { ZENDESK } from '../../src/constants'
import filterCreator from '../../src/filters/remove_definition_instances'
import { FilterResult } from '../../src/filter'
import { createFilterCreatorParams } from '../utils'

describe('remove definition instances', () => {
  type FilterType = filterUtils.FilterWith<'onFetch', FilterResult>
  let filter: FilterType
  const randomObjType = new ObjectType({ elemID: new ElemID(ZENDESK, 'obj') })
  const instanceRandomObj = new InstanceElement('test', randomObjType)
  const triggerDefinitionObjType = new ObjectType({ elemID: new ElemID(ZENDESK, 'trigger_definition') })
  const triggerDefinition = new InstanceElement('test', triggerDefinitionObjType)
  const macrosActionsObjType = new ObjectType({ elemID: new ElemID(ZENDESK, 'macros_actions') })
  const macrosActions = new InstanceElement('test', macrosActionsObjType)

  beforeEach(async () => {
    jest.clearAllMocks()
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })

  describe('onFetch', () => {
    it('should change the hidden value annotation of the relevant types', async () => {
      const elements = [
        randomObjType,
        instanceRandomObj,
        triggerDefinitionObjType,
        triggerDefinition,
        macrosActionsObjType,
        macrosActions,
      ]
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName())).toEqual([
        'zendesk.obj',
        'zendesk.obj.instance.test',
        'zendesk.trigger_definition',
        'zendesk.macros_actions',
      ])
    })
  })
})
