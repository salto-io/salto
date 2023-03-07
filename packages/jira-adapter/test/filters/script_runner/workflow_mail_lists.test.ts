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
import orFilter, { MAIL_LISTS_FIELDS } from '../../../src/filters/script_runner/workflow_lists_parsing'
import { WORKFLOW_TYPE_NAME } from '../../../src/constants'
import { getDefaultConfig } from '../../../src/config/config'


describe('ScriptRunner mail lists in DC', () => {
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
    it('should replace all mail fields to arrays', async () => {
      MAIL_LISTS_FIELDS.forEach(field => {
        instance.value.transitions[0].rules.postFunctions[0].configuration[field] = 'assignee reporter'
      })
      await filter.onFetch([instance])
      MAIL_LISTS_FIELDS.forEach(field => {
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration[field]).toEqual({ field: ['assignee', 'reporter'] })
      })
    })
    it('should sort the order of the fields', async () => {
      instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_TO_USER_FIELDS = 'reporter assignee'
      await filter.onFetch([instance])
      expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_TO_USER_FIELDS).toEqual({ field: ['assignee', 'reporter'] })
    })
    it('should replace all mail fields in complicated environments', async () => {
      MAIL_LISTS_FIELDS.forEach(field => {
        instance.value.transitions[0].rules.postFunctions[0].configuration[field] = 'assignee reporter group:abc role:ecd group:"space included" role:"more spaces" peers'
      })
      await filter.onFetch([instance])
      MAIL_LISTS_FIELDS.forEach(field => {
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration[field]).toEqual({
          field: ['assignee', 'peers', 'reporter'],
          group: ['abc', 'space included'],
          role: ['ecd', 'more spaces'],
        })
      })
    })
    it('should not replace mail lists on non mail lists fields', async () => {
      instance.value.transitions[0].rules.postFunctions[0].configuration.a = 'reporter assignee'
      await filter.onFetch([instance])
      expect(instance.value.transitions[0].rules.postFunctions[0].configuration.a).toEqual('reporter assignee')
    })
    it('should not replace if wrong type', async () => {
      instance.value.transitions[0].rules.postFunctions[1] = {
        type: 'other',
        configuration: {
          FIELD_TO_USER_FIELDS: 'reporter assignee',
        },
      }
      await filter.onFetch([instance])
      expect(instance.value.transitions[0].rules.postFunctions[1].configuration.FIELD_TO_USER_FIELDS).toEqual('reporter assignee')
    })
  })
  describe('pre deploy', () => {
    it('should replace objects to mail lists', async () => {
      MAIL_LISTS_FIELDS.forEach(field => {
        instance.value.transitions[0].rules.postFunctions[0].configuration[field] = { field: ['assignee', 'reporter'] }
      })
      await filter.preDeploy([toChange({ after: instance })])
      MAIL_LISTS_FIELDS.forEach(field => {
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration[field]).toEqual('assignee reporter')
      })
    })
    it('should replace complex objects to mail lists', async () => {
      MAIL_LISTS_FIELDS.forEach(field => {
        instance.value.transitions[0].rules.postFunctions[0].configuration[field] = {
          field: ['assignee', 'peers', 'reporter'],
          group: ['abc', 'space included'],
          role: ['ecd', 'more spaces'],
        }
      })
      await filter.preDeploy([toChange({ after: instance })])
      MAIL_LISTS_FIELDS.forEach(field => {
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration[field]).toEqual('group:abc group:"space included" role:ecd role:"more spaces" assignee peers reporter')
      })
    })
  })
  describe('on deploy', () => {
    it('should replace mail lists to arrays', async () => {
      instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_TO_USER_FIELDS = 'reporter assignee'
      await filter.onDeploy([toChange({ after: instance })])
      expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_TO_USER_FIELDS).toEqual({ field: ['assignee', 'reporter'] })
    })
  })
  describe('error flows', () => {
    it('should not fail when field is empty', async () => {
      instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_TO_USER_FIELDS = undefined
      await filter.onFetch([instance])
      expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_TO_USER_FIELDS).toEqual(undefined)
    })
    it('should not fail when object is empty', async () => {
      instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_TO_USER_FIELDS = undefined
      await filter.preDeploy([toChange({ after: instance })])
      expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_TO_USER_FIELDS).toEqual('')
    })
    it('should not throw when no transitions', async () => {
      instance = new InstanceElement(
        'instance',
        workflowType,
        {
        }
      )
      await filter.onFetch([instance])
    })
  })
})
