/*
*                      Copyright 2023 Salto Labs Ltd.
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
import _ from 'lodash'
import { InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { FilterResult } from '../../../src/filter'
import conditionReferenceFilter from '../../../src/filters/workflowV2/transition_parameters_filter'
import { createEmptyType, getFilterParams } from '../../utils'
import { getDefaultConfig } from '../../../src/config/config'
import { JIRA_WORKFLOW_TYPE } from '../../../src/constants'

describe('workflowTransitionReferenceFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch', FilterResult>
  let workflowType: ObjectType
  let instance: InstanceElement
  beforeEach(async () => {
    workflowType = createEmptyType(JIRA_WORKFLOW_TYPE)
    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.enableNewWorkflowAPI = true
    filter = conditionReferenceFilter(getFilterParams({
      config,
    })) as typeof filter
  })

  describe('onFetch', () => {
    beforeEach(async () => {
      instance = new InstanceElement('instance', workflowType, {
        transitions: [
          {
            conditions: {
              conditions: [
                {
                  parameters: {
                    roleIds: '1,2',
                    groupIds: '3',
                    statusIds: '',
                    anotherField: '4,5',
                  },
                },
              ],
            },
            validators: [{
              parameters: {
                statusIds: '1,2',
                groupsExemptFromValidation: '3',
                fieldsRequired: '',
                anotherField: '4,5',
              },
            }],
          },
        ],
      })
    })
    it('should convert the relevant string fields to list', async () => {
      await filter.onFetch([instance])
      const { parameters: conditionParameters } = instance.value.transitions[0].conditions.conditions[0]
      const { parameters: validatorParameters } = instance.value.transitions[0].validators[0]
      expect(conditionParameters.roleIds).toEqual(
        ['1', '2'],
      )
      expect(conditionParameters.groupIds).toEqual(
        ['3'],
      )
      expect(validatorParameters.statusIds).toEqual(
        ['1', '2'],
      )
      expect(validatorParameters.groupsExemptFromValidation).toEqual(
        ['3'],
      )
    })
    it('should remain fields with empty string', async () => {
      await filter.onFetch([instance])
      const { parameters: conditionParameters } = instance.value.transitions[0].conditions.conditions[0]
      const { parameters: validatorParameters } = instance.value.transitions[0].validators[0]
      expect(conditionParameters.statusIds).toEqual('')
      expect(validatorParameters.fieldsRequired).toEqual('')
    })
    it('should not convert fields that not in the relevant field list', async () => {
      await filter.onFetch([instance])
      const { parameters: conditionParameters } = instance.value.transitions[0].conditions.conditions[0]
      const { parameters: validatorParameters } = instance.value.transitions[0].validators[0]
      expect(conditionParameters.anotherField).toEqual('4,5')
      expect(validatorParameters.anotherField).toEqual('4,5')
    })
    it('should do nothing if parameters is undefined', async () => {
      instance.value.transitions[0].validators[0].parameters = undefined
      instance.value.transitions[0].conditions.conditions[0].parameters = undefined
      await filter.onFetch([instance])
      const { parameters: validatorsParameters } = instance.value.transitions[0].validators[0]
      const { parameters: conditionsParameters } = instance.value.transitions[0].conditions.conditions[0]
      expect(validatorsParameters).toBeUndefined()
      expect(conditionsParameters).toBeUndefined()
    })
    it('should do nothing if there is no condition list', async () => {
      instance.value.transitions[0].conditions.conditions = undefined
      await filter.onFetch([instance])
      const { conditions } = instance.value.transitions[0].conditions
      expect(conditions).toBeUndefined()
    })
    it('should do nothing if there is no conditions nor validators', async () => {
      instance.value.transitions[0].conditions = undefined
      instance.value.transitions[0].validators = undefined
      await filter.onFetch([instance])
      const { conditions } = instance.value.transitions[0]
      const { validators } = instance.value.transitions[0]
      expect(conditions).toBeUndefined()
      expect(validators).toBeUndefined()
    })
  })
})
