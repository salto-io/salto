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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { getFilterParams, mockClient } from '../../utils'
import orFilter from '../../../src/filters/script_runner/workflow_ors'
import { WORKFLOW_TYPE_NAME } from '../../../src/constants'
import { getDefaultConfig } from '../../../src/config/config'


describe('ScriptRunner ors in DC', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let filterOff: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let filterCloud: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let instance: InstanceElement

  const workflowType = new ObjectType({
    elemID: new ElemID('jira', WORKFLOW_TYPE_NAME),
  })

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
    it('should replace ors to arrays', async () => {
      instance.value.transitions[0].rules.postFunctions[0].configuration.a = 'reporter|||assignee'
      instance.value.transitions[0].rules.postFunctions[0].configuration.a2 = 'reporter|||assignee'
      instance.value.transitions[0].rules.conditions[0].configuration.b = 'reporter|||assignee'
      instance.value.transitions[0].rules.validators[0].configuration.c = 'reporter|||assignee'
      await filter.onFetch([instance])
      expect(instance.value.transitions[0].rules.postFunctions[0].configuration.a).toEqual(['reporter', 'assignee'])
      expect(instance.value.transitions[0].rules.postFunctions[0].configuration.a2).toEqual(['reporter', 'assignee'])
      expect(instance.value.transitions[0].rules.conditions[0].configuration.b).toEqual(['reporter', 'assignee'])
      expect(instance.value.transitions[0].rules.validators[0].configuration.c).toEqual(['reporter', 'assignee'])
    })
    it('should not decode if script runner not supported', async () => {
      instance.value.transitions[0].rules.postFunctions[0].configuration.a = 'reporter|||assignee'
      await filterOff.onFetch([instance])
      expect(instance.value.transitions[0].rules.postFunctions[0].configuration.a).toEqual('reporter|||assignee')
    })
    it('should not decode if not data center', async () => {
      instance.value.transitions[0].rules.postFunctions[0].configuration.a = 'reporter|||assignee'
      await filterCloud.onFetch([instance])
      expect(instance.value.transitions[0].rules.postFunctions[0].configuration.a).toEqual('reporter|||assignee')
    })
    it('should not decode if wrong type', async () => {
      instance.value.transitions[0].rules.postFunctions[1] = {
        type: 'other',
        configuration: {
          a: 'reporter|||assignee',
        },
      }
      await filter.onFetch([instance])
      expect(instance.value.transitions[0].rules.postFunctions[1].configuration.a).toEqual('reporter|||assignee')
    })
  })
  describe('pre deploy', () => {
    it('should replace arrays to ors', async () => {
      instance.value.transitions[0].rules.postFunctions[0].configuration.a = ['reporter', 'assignee']
      instance.value.transitions[0].rules.postFunctions[0].configuration.a2 = ['reporter', 'assignee']
      instance.value.transitions[0].rules.conditions[0].configuration.b = ['reporter', 'assignee']
      instance.value.transitions[0].rules.validators[0].configuration.c = ['reporter', 'assignee']
      await filter.preDeploy([toChange({ after: instance })])
      expect(instance.value.transitions[0].rules.postFunctions[0].configuration.a).toEqual('reporter|||assignee')
      expect(instance.value.transitions[0].rules.postFunctions[0].configuration.a2).toEqual('reporter|||assignee')
      expect(instance.value.transitions[0].rules.conditions[0].configuration.b).toEqual('reporter|||assignee')
      expect(instance.value.transitions[0].rules.validators[0].configuration.c).toEqual('reporter|||assignee')
    })
  })
  describe('on deploy', () => {
    it('should replace ors to arrays', async () => {
      instance.value.transitions[0].rules.postFunctions[0].configuration.a = 'reporter|||assignee'
      await filter.onDeploy([toChange({ after: instance })])
      expect(instance.value.transitions[0].rules.postFunctions[0].configuration.a).toEqual(['reporter', 'assignee'])
    })
  })
})
