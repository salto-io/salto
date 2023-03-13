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
import { filterUtils } from '@salto-io/adapter-components'
import { InstanceElement, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { createEmptyType, getFilterParams, mockClient } from '../../utils'
import orFilter, { OR_FIELDS } from '../../../src/filters/script_runner/workflow_lists_parsing'
import { WORKFLOW_TYPE_NAME } from '../../../src/constants'
import { getDefaultConfig } from '../../../src/config/config'

const REDUCED_OR_FIELDS = OR_FIELDS.filter(field => field !== 'FIELD_LINK_DIRECTION')
describe('ScriptRunner ors in DC', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let filterOff: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let filterCloud: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let instance: InstanceElement

  const workflowType = createEmptyType(WORKFLOW_TYPE_NAME)

  beforeEach(() => {
    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: true }))
    const configOff = _.cloneDeep(getDefaultConfig({ isDataCenter: true }))
    const { client } = mockClient(true)
    const { client: clientCloud } = mockClient()
    config.fetch.enableScriptRunnerAddon = true
    filter = orFilter(getFilterParams({ client, config })) as filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
    filterOff = orFilter(getFilterParams({ client, config: configOff })) as filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
    filterCloud = orFilter(getFilterParams({ client: clientCloud, config })) as filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
    instance = new InstanceElement(
      'instance',
      workflowType,
      {
        transitions: [
          {
            rules: {
              postFunctions: [
                {
                  type: 'com.onresolve.jira.groovy.GroovyFunctionPlugin',
                  configuration: {
                  },
                },
              ],
              conditions: [
                {
                  type: 'com.onresolve.jira.groovy.GroovyCondition',
                  configuration: {
                  },
                },
              ],
              validators: [
                {
                  type: 'com.onresolve.jira.groovy.GroovyValidator',
                  configuration: {
                  },
                },
              ],
            },
          },
        ],
      }
    )
  })
  describe('fetch', () => {
    it('should replace all field ors to arrays', async () => {
      REDUCED_OR_FIELDS.forEach(field => {
        instance.value.transitions[0].rules.postFunctions[0].configuration[field] = 'assignee|||reporter'
      })
      await filter.onFetch([instance])
      REDUCED_OR_FIELDS.forEach(field => {
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration[field]).toEqual(['assignee', 'reporter'])
      })
    })
    it('should sort the order of the fields', async () => {
      instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_SELECTED_FIELDS = 'reporter|||assignee'
      await filter.onFetch([instance])
      expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_SELECTED_FIELDS).toEqual(['assignee', 'reporter'])
    })
    it('should insert single value to array', async () => {
      instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_SELECTED_FIELDS = 'reporter'
      await filter.onFetch([instance])
      expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_SELECTED_FIELDS).toEqual(['reporter'])
    })
    it('should not replace ors on non Or fields', async () => {
      instance.value.transitions[0].rules.postFunctions[0].configuration.a = 'reporter|||assignee'
      await filter.onFetch([instance])
      expect(instance.value.transitions[0].rules.postFunctions[0].configuration.a).toEqual('reporter|||assignee')
    })
    it('should not replace if script runner not supported', async () => {
      instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_SELECTED_FIELDS = 'reporter|||assignee'
      await filterOff.onFetch([instance])
      expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_SELECTED_FIELDS).toEqual('reporter|||assignee')
    })
    it('should not replace if not data center', async () => {
      instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_SELECTED_FIELDS = 'reporter|||assignee'
      await filterCloud.onFetch([instance])
      expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_SELECTED_FIELDS).toEqual('reporter|||assignee')
    })
    it('should not replace if wrong type', async () => {
      instance.value.transitions[0].rules.postFunctions[1] = {
        type: 'other',
        configuration: {
          FIELD_SELECTED_FIELDS: 'reporter|||assignee',
        },
      }
      await filter.onFetch([instance])
      expect(instance.value.transitions[0].rules.postFunctions[1].configuration.FIELD_SELECTED_FIELDS).toEqual('reporter|||assignee')
    })
  })
  describe('pre deploy', () => {
    it('should replace arrays to ors', async () => {
      REDUCED_OR_FIELDS.forEach(field => {
        instance.value.transitions[0].rules.postFunctions[0].configuration[field] = ['reporter', 'assignee']
      })
      await filter.preDeploy([toChange({ after: instance })])
      REDUCED_OR_FIELDS.forEach(field => {
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration[field]).toEqual('reporter|||assignee')
      })
    })
  })
  describe('on deploy', () => {
    it('should replace ors to arrays', async () => {
      instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_SELECTED_FIELDS = 'reporter|||assignee'
      await filter.onDeploy([toChange({ after: instance })])
      expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_SELECTED_FIELDS).toEqual(['assignee', 'reporter'])
    })
  })
})
