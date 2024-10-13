/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { InstanceElement, ObjectType, ElemID, toChange } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { TRIGGER_TYPE_NAME, ZENDESK } from '../../src/constants'
import filterCreator from '../../src/filters/deploy_trigger_skills'
import { createFilterCreatorParams } from '../utils'

type FilterType = filterUtils.FilterWith<'preDeploy' | 'onDeploy'>

const triggerType = new ObjectType({ elemID: new ElemID(ZENDESK, TRIGGER_TYPE_NAME) })
const triggerInstance = new InstanceElement('instance', triggerType, {
  actions: [
    { field: 'set_skills', value: 'wakeBoarding', priority: 'required' },
    { field: 'no_skills_needed', value: 'breathing', priority: 'required' },
    { field: 'add_skills', value: 'tyingShoes', priority: 'optional' },
    { field: 'always_fun', value: 'livingWithoutPriority' },
  ],
})

describe('deploy trigger skills filter', () => {
  let instance: InstanceElement
  let filter: FilterType
  beforeEach(() => {
    instance = triggerInstance.clone()
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })
  describe('preDeploy', () => {
    it('should update the trigger actions to match the correct API calls', async () => {
      await filter.preDeploy([toChange({ before: instance })])

      expect(instance.value?.actions).toEqual([
        { field: 'set_skills', value: 'wakeBoarding#0' },
        { field: 'no_skills_needed', value: 'breathing', priority: 'required' },
        { field: 'add_skills', value: 'tyingShoes#1' },
        { field: 'always_fun', value: 'livingWithoutPriority' },
      ])
    })
  })
  describe('onDeploy', () => {
    it('should restore the trigger actions to the original format', async () => {
      await filter.preDeploy([toChange({ before: instance })])
      await filter.onDeploy([toChange({ before: instance })])

      expect(instance.value?.actions).toEqual(triggerInstance.value?.actions)
    })
  })
})
