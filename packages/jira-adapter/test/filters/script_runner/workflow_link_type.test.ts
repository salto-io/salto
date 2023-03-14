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
import orFilter from '../../../src/filters/script_runner/workflow_lists_parsing'
import { WORKFLOW_TYPE_NAME } from '../../../src/constants'
import { getDefaultConfig } from '../../../src/config/config'

describe('ScriptRunner linkTypes in DC', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let instance: InstanceElement

  const workflowType = createEmptyType(WORKFLOW_TYPE_NAME)

  beforeEach(() => {
    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: true }))
    const { client } = mockClient(true)
    config.fetch.enableScriptRunnerAddon = true
    filter = orFilter(getFilterParams({ client, config })) as filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
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
            },
          },
        ],
      }
    )
  })
  describe('fetch', () => {
    it('should replace FIELD_LINK_DIRECTION', async () => {
      instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_LINK_DIRECTION = '10001-inward|||10003-outward'
      await filter.onFetch([instance])
      expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_LINK_DIRECTION).toEqual(
        [{ linkType: '10001', direction: 'inward' },
          { linkType: '10003', direction: 'outward' },
        ]
      )
    })
    it('should not replace FIELD_LINK_DIRECTION if wrong format', async () => {
      instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_LINK_DIRECTION = '10001 inward|||10003-outward-wow'
      await filter.onFetch([instance])
      expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_LINK_DIRECTION).toEqual(['10001 inward', '10003-outward-wow'])
    })
    it('should replace FIELD_LINK_TYPE', async () => {
      instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_LINK_TYPE = '10002 inward'
      await filter.onFetch([instance])
      expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_LINK_TYPE).toEqual(
        { linkType: '10002', direction: 'inward' }
      )
    })
    it('should not replace FIELD_LINK_TYPE if wrong format', async () => {
      instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_LINK_TYPE = '10001-inward'
      await filter.onFetch([instance])
      expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_LINK_TYPE).toEqual('10001-inward')
      instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_LINK_TYPE = '10001 inward wow'
      await filter.onFetch([instance])
      expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_LINK_TYPE).toEqual('10001 inward wow')
    })
  })
  describe('pre deploy', () => {
    it('should replace object to string in FIELD_LINK_DIRECTION', async () => {
      instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_LINK_DIRECTION = [
        { linkType: '10001', direction: 'inward' },
        { linkType: '10003', direction: 'outward' },
      ]
      await filter.preDeploy([toChange({ after: instance })])
      expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_LINK_DIRECTION).toEqual('10001-inward|||10003-outward')
    })
    it('should replace object to string in FIELD_LINK_TYPE', async () => {
      instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_LINK_TYPE = { linkType: '10001', direction: 'inward' }
      await filter.preDeploy([toChange({ after: instance })])
      expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_LINK_TYPE).toEqual('10001 inward')
    })
  })
  describe('on deploy', () => {
    it('should replace FIELD_LINK_DIRECTION', async () => {
      instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_LINK_DIRECTION = '10001-inward|||10003-outward'
      await filter.onDeploy([toChange({ after: instance })])
      expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_LINK_DIRECTION).toEqual(
        [{ linkType: '10001', direction: 'inward' },
          { linkType: '10003', direction: 'outward' },
        ]
      )
    })
    it('should not replace FIELD_LINK_DIRECTION if wrong format', async () => {
      instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_LINK_DIRECTION = '10001 inward|||10003-outward-wow'
      await filter.onDeploy([toChange({ after: instance })])
      expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_LINK_DIRECTION).toEqual(['10001 inward', '10003-outward-wow'])
    })
  })
})
