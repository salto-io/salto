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
import { ElemID, InstanceElement, ObjectType, toChange, Value } from '@salto-io/adapter-api'
import _ from 'lodash'

import { getFilterParams, mockClient } from '../../utils'
import workflowFilter from '../../../src/filters/script_runner/workflow_filter'
import { CONDITION_CONFIGURATION, JIRA, POST_FUNCTION_CONFIGURATION, WORKFLOW_TYPE_NAME } from '../../../src/constants'
import { getDefaultConfig } from '../../../src/config/config'


const compareScriptObjectsBase64 = (obj1: string, obj2: string): void => {
  const toObject = (obj: string): Value => JSON.parse(Buffer.from(obj.substring(4), 'base64').toString())
  expect(toObject(obj1)).toEqual(toObject(obj2))
}

describe('Scriptrunner DC Workflow', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let filterOff: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let instance: InstanceElement

  const workflowType = new ObjectType({
    elemID: new ElemID('jira', WORKFLOW_TYPE_NAME),
  })
  const goodBase64 = 'YCFgZGVtbyBzdHJpbmc=' // YCFg followed by base64 of 'demo string'
  const objectNoNullsBase64 = 'YCFgeyJhIjoxfQ==' // YCFg followed by base64 of '{"a":1}'
  const objectScriptOnlyBase64 = 'YCFgeyJzY3JpcHQiOjEsInNjcmlwdFBhdGgiOm51bGx9' // YCFg followed by base64 of '{"script":1,"scriptPath":null}'
  const objectPathOnlyBase64 = 'YCFgeyJzY3JpcHQiOm51bGwsInNjcmlwdFBhdGgiOjF9'
  const FIELD_NAMES_STRINGS = ['FIELD_NOTES', 'FIELD_MESSAGE', 'FIELD_INCLUDE_ATTACHMENTS_CALLBACK', 'FIELD_EMAIL_TEMPLATE', 'FIELD_EMAIL_SUBJECT_TEMPLATE']
  const FIELD_NAMES_OBJECTS = ['FIELD_CONDITION', 'FIELD_ADDITIONAL_SCRIPT', 'FIELD_SCRIPT_FILE_OR_SCRIPT']


  beforeEach(() => {
    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: true }))
    const configOff = _.cloneDeep(getDefaultConfig({ isDataCenter: true }))
    const { client } = mockClient(true)
    config.fetch.enableScriptRunnerAddon = true
    filter = workflowFilter(getFilterParams({ client, config })) as filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
    filterOff = workflowFilter(getFilterParams({ client, config: configOff })) as filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
    instance = new InstanceElement(
      'instance',
      workflowType,
      {
        transitions: [
          {
            rules: {
              postFunctions: [
                {
                  configuration: {
                    doNotDecode: goodBase64,
                    FIELD_COMMENT: goodBase64,
                  },
                },
              ],
              conditions: [
                {
                  configuration: {
                  },
                },
              ],
              validators: [
                {
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
  describe('post functions', () => {
    const scriptRunnerPostFunctionType = 'com.onresolve.jira.groovy.GroovyFunctionPlugin'
    const CANNED_SCRIPT = 'canned-script'
    const FIELD_COMMENT_TYPE = 'com.onresolve.scriptrunner.canned.jira.workflow.postfunctions.CommentIssue'
    beforeEach(() => {
      instance.value.transitions[0].rules.postFunctions[0].type = scriptRunnerPostFunctionType
    })
    describe('fetch', () => {
      beforeEach(() => {
        instance.value.transitions[0].rules.postFunctions[0].configuration[CANNED_SCRIPT] = FIELD_COMMENT_TYPE
        FIELD_NAMES_STRINGS.forEach(fieldName => {
          instance.value.transitions[0].rules.postFunctions[0].configuration[fieldName] = goodBase64
        })
        FIELD_NAMES_OBJECTS.forEach(fieldName => {
          instance.value.transitions[0].rules.postFunctions[0].configuration[fieldName] = objectScriptOnlyBase64
        })
      })
      it('should decode properly string fields', async () => {
        await filter.onFetch([instance])
        FIELD_NAMES_STRINGS.forEach(fieldName => {
          expect(instance.value.transitions[0].rules.postFunctions[0].configuration[fieldName]).toEqual('demo string')
        })
        FIELD_NAMES_OBJECTS.forEach(fieldName => {
          expect(instance.value.transitions[0].rules.postFunctions[0].configuration[fieldName]).toEqual(
            { script: 1 }
          )
        })
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_COMMENT).toEqual('demo string')
      })
      it('should decode properly different object field formations', async () => {
        instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_CONDITION = objectPathOnlyBase64
        instance.value.transitions[0].rules.postFunctions[0].configuration
          .FIELD_SCRIPT_FILE_OR_SCRIPT = objectNoNullsBase64
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_CONDITION).toEqual(
          { scriptPath: 1 }
        )
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_SCRIPT_FILE_OR_SCRIPT).toEqual(
          { a: 1 }
        )
      })
      it('should not decode if does not start with prefix', async () => {
        instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_NOTES = 'ZGVtbyBzdHJpbmc='
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_NOTES).toEqual('ZGVtbyBzdHJpbmc=')
      })
      it('should not decode if not in the declared fields', async () => {
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.doNotDecode).toEqual(goodBase64)
      })
      it('should not decode if not base64', async () => {
        instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_NOTES = 'not base64'
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_NOTES).toEqual('not base64')
      })
      it('should not decode if comment field did not match conditions', async () => {
        instance.value.transitions[0].rules.postFunctions[0].configuration[CANNED_SCRIPT] = 'other.condition'
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_COMMENT).toEqual(goodBase64)
      })
      it('should not fail if no value', async () => {
        instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_NOTES = undefined
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_NOTES).toBeUndefined()
      })
      it('should not decode if script runner not supported', async () => {
        await filterOff.onFetch([instance])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_NOTES).toEqual(goodBase64)
      })
      it('should fail if script not in json format', async () => {
        instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_CONDITION = goodBase64
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_CONDITION).toEqual(goodBase64)
      })
      it('should delete empty fields', async () => {
        instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_NOTES = ''
        instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_SCRIPT_FILE_OR_SCRIPT = ''
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_NOTES).toBeUndefined()
        expect(instance.value.transitions[0].rules.postFunctions[0]
          .configuration.FIELD_SCRIPT_FILE_OR_SCRIPT).toBeUndefined()
      })
    })
    describe('pre deploy', () => {
      it('should encode properly', async () => {
        instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_NOTES = 'demo string'
        instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_CONDITION = { scriptPath: 1 }
        instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_SCRIPT_FILE_OR_SCRIPT = { script: 1 }
        await filter.preDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_NOTES).toEqual(goodBase64)
        compareScriptObjectsBase64(
          instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_CONDITION,
          objectPathOnlyBase64
        )
        compareScriptObjectsBase64(
          instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_SCRIPT_FILE_OR_SCRIPT,
          objectScriptOnlyBase64
        )
      })
      it('should not encode if script runner not supported', async () => {
        instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_NOTES = 'demo string'
        await filterOff.preDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_NOTES).toEqual('demo string')
      })
    })
    describe('on deploy', () => {
      it('should decode properly', async () => {
        instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_NOTES = goodBase64
        await filter.onDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_NOTES).toEqual('demo string')
      })
      it('should not decode if script runner not supported', async () => {
        instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_NOTES = goodBase64
        await filterOff.onDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.FIELD_NOTES).toEqual(goodBase64)
      })
    })
  })
  describe('validators', () => {
    const scriptRunnerValidatorType = 'com.onresolve.jira.groovy.GroovyValidator'
    beforeEach(() => {
      instance.value.transitions[0].rules.validators[0].type = scriptRunnerValidatorType
    })
    describe('fetch', () => {
      it('should decode properly', async () => {
        FIELD_NAMES_STRINGS.forEach(fieldName => {
          instance.value.transitions[0].rules.validators[0].configuration[fieldName] = goodBase64
        })
        instance.value.transitions[0].rules.validators[0].configuration.FIELD_CONDITION = objectPathOnlyBase64
        instance.value.transitions[0].rules.validators[0].configuration
          .FIELD_SCRIPT_FILE_OR_SCRIPT = objectScriptOnlyBase64
        await filter.onFetch([instance])
        FIELD_NAMES_STRINGS.forEach(fieldName => {
          expect(instance.value.transitions[0].rules.validators[0].configuration[fieldName]).toEqual('demo string')
        })
        expect(instance.value.transitions[0].rules.validators[0].configuration.FIELD_CONDITION).toEqual({
          scriptPath: 1,
        })
        expect(instance.value.transitions[0].rules.validators[0].configuration.FIELD_SCRIPT_FILE_OR_SCRIPT).toEqual({
          script: 1,
        })
      })
      it('should not fail if no value', async () => {
        instance.value.transitions[0].rules.validators[0].configuration.FIELD_NOTES = undefined
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.validators[0].configuration.FIELD_NOTES).toBeUndefined()
      })
    })
    describe('pre deploy', () => {
      it('should encode properly', async () => {
        instance.value.transitions[0].rules.validators[0].configuration.FIELD_NOTES = 'demo string'
        instance.value.transitions[0].rules.validators[0].configuration.FIELD_CONDITION = { scriptPath: 1 }
        instance.value.transitions[0].rules.validators[0].configuration.FIELD_SCRIPT_FILE_OR_SCRIPT = { script: 1 }
        await filter.preDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.validators[0].configuration.FIELD_NOTES).toEqual(goodBase64)
        compareScriptObjectsBase64(
          instance.value.transitions[0].rules.validators[0].configuration.FIELD_CONDITION,
          objectPathOnlyBase64
        )
        compareScriptObjectsBase64(
          instance.value.transitions[0].rules.validators[0].configuration.FIELD_SCRIPT_FILE_OR_SCRIPT,
          objectScriptOnlyBase64
        )
      })
      it('should not fail if undefined', async () => {
        instance.value.transitions[0].rules.validators[0].configuration.FIELD_NOTES = undefined
        await filter.preDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.validators[0].configuration.FIELD_NOTES).toBeUndefined()
      })
    })
    describe('on deploy', () => {
      it('should decode properly', async () => {
        instance.value.transitions[0].rules.validators[0].configuration.FIELD_NOTES = goodBase64
        await filter.onDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.validators[0].configuration.FIELD_NOTES).toEqual('demo string')
      })
    })
  })
  describe('conditions', () => {
    const scriptRunnerConditionType = 'com.onresolve.jira.groovy.GroovyCondition'
    beforeEach(() => {
      instance.value.transitions[0].rules.conditions[0].type = scriptRunnerConditionType
      FIELD_NAMES_STRINGS.forEach(fieldName => {
        instance.value.transitions[0].rules.conditions[0].configuration[fieldName] = goodBase64
      })
    })
    describe('fetch', () => {
      it('should decode properly', async () => {
        await filter.onFetch([instance])
        FIELD_NAMES_STRINGS.forEach(fieldName => {
          expect(instance.value.transitions[0].rules.conditions[0].configuration[fieldName]).toEqual('demo string')
        })
      })
      it('should not fail if no value', async () => {
        instance.value.transitions[0].rules.conditions[0].configuration.FIELD_NOTES = undefined
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.conditions[0].configuration.FIELD_NOTES).toBeUndefined()
      })
    })
    describe('pre deploy', () => {
      it('should encode properly', async () => {
        instance.value.transitions[0].rules.conditions[0].configuration.FIELD_NOTES = 'demo string'
        await filter.preDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.conditions[0].configuration.FIELD_NOTES).toEqual(goodBase64)
      })
    })
    describe('on deploy', () => {
      it('should decode properly', async () => {
        instance.value.transitions[0].rules.conditions[0].configuration.FIELD_NOTES = goodBase64
        await filter.onDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.conditions[0].configuration.FIELD_NOTES).toEqual('demo string')
      })
    })
  })
  describe('adding object types', () => {
    it('should add post function fields', async () => {
      const postFunctionConfigurationType = new ObjectType({
        elemID: new ElemID(JIRA, POST_FUNCTION_CONFIGURATION),
      })
      const elementsList = [postFunctionConfigurationType]
      await filter.onFetch(elementsList)
      expect(postFunctionConfigurationType.fields.FIELD_LINK_DIRECTION).toBeDefined()
      expect(postFunctionConfigurationType.fields.FIELD_LINK_TYPE).toBeDefined()
      expect(postFunctionConfigurationType.fields.FIELD_TO_USER_FIELDS).toBeDefined()
      expect(postFunctionConfigurationType.fields.FIELD_CC_USER_FIELDS).toBeDefined()
      expect(elementsList.length).toEqual(3)
    })
    it('should add condition fields', async () => {
      const postFunctionConfigurationType = new ObjectType({
        elemID: new ElemID(JIRA, CONDITION_CONFIGURATION),
      })
      const elementsList = [postFunctionConfigurationType]
      await filter.onFetch(elementsList)
      expect(postFunctionConfigurationType.fields.FIELD_LINK_DIRECTION).toBeDefined()
    })
  })
})
