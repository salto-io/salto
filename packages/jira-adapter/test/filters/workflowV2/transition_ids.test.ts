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
import { InstanceElement, toChange } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { FilterResult } from '../../../src/filter'
import transitionIdsFilter from '../../../src/filters/workflowV2/transition_ids'
import { createEmptyType, getFilterParams } from '../../utils'
import { WORKFLOW_CONFIGURATION_TYPE } from '../../../src/constants'

describe('transition ids filter', () => {
  let filter: filterUtils.FilterWith<'preDeploy', FilterResult>
  let instance: InstanceElement
  beforeEach(() => {
    filter = transitionIdsFilter(getFilterParams()) as filterUtils.FilterWith<'preDeploy', FilterResult>
    instance = new InstanceElement('instance', createEmptyType(WORKFLOW_CONFIGURATION_TYPE), {
      name: 'name',
      scope: {
        type: 'global',
      },
      statuses: [],
      transitions: {
        transition1: {
          type: 'DIRECTED',
          name: 'transition1',
        },
        transition2: {
          type: 'DIRECTED',
          name: 'transition2',
        },
        transition3: {
          type: 'DIRECTED',
          name: 'transition3',
        },
      },
    })
  })
  describe('pre deploy', () => {
    it('should add transitionIds correctly', async () => {
      await filter.preDeploy([toChange({ after: instance })])
      expect(instance.value.transitions.transition1.id).toBe('1')
      expect(instance.value.transitions.transition2.id).toBe('2')
      expect(instance.value.transitions.transition3.id).toBe('3')
    })

    it('should remain existing transition ids and add new ids correctly', async () => {
      instance.value.transitions.transition1.id = '18'
      instance.value.transitions.transition3.id = '20'
      await filter.preDeploy([toChange({ after: instance })])
      expect(instance.value.transitions.transition1.id).toBe('18')
      expect(instance.value.transitions.transition2.id).toBe('21')
      expect(instance.value.transitions.transition3.id).toBe('20')
    })

    it('should not fail if transitionId is invalid', async () => {
      instance.value.transitions.transition2.id = 'invalid'
      await filter.preDeploy([toChange({ after: instance })])
      expect(instance.value.transitions.transition1.id).toBe('1')
      expect(instance.value.transitions.transition2.id).toBe('invalid')
      expect(instance.value.transitions.transition3.id).toBe('2')
    })
  })
})
