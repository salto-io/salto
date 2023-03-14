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
import { gzip } from 'pako'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { getFilterParams } from '../../utils'
import { isCompressedObject } from '../../../src/filters/script_runner/workflow_cloud'
import workflowFilter from '../../../src/filters/script_runner/workflow_filter'
import { WORKFLOW_TYPE_NAME } from '../../../src/constants'
import { getDefaultConfig } from '../../../src/config/config'
import { renameKey } from '../../../src/utils'

const SCRIPT_RUNNER_SEND_NOTIFICATIONS = 'com.adaptavist.sr.cloud.workflow.SendNotification'


const encode = (object: Value): Value => {
  const dataString = safeJsonStringify(object)
  const zipBuffer = Buffer.from(gzip(dataString))
  const compressedObject = {
    compressed: zipBuffer.toJSON().data,
  }
  return Buffer.from(safeJsonStringify(compressedObject)).toString('base64')
}

// done as the zip contains an OS byte that can differ between environments
const compareScripts = (script1: string, script2: string): void => {
  const compressedObject1 = JSON.parse(Buffer.from(script1, 'base64').toString('utf8'))
  expect(isCompressedObject(compressedObject1)).toBeTruthy()
  const zipBuffer1 = Buffer.from(compressedObject1.compressed)
  const compressedObject2 = JSON.parse(Buffer.from(script2, 'base64').toString('utf8'))
  expect(isCompressedObject(compressedObject2)).toBeTruthy()
  const zipBuffer2 = Buffer.from(compressedObject1.compressed)
  // 9 is the index of the operating system byte in the gzip buffer
  zipBuffer1[9] = 0
  zipBuffer2[9] = 0
  expect(zipBuffer1).toEqual(zipBuffer2)
}

describe('ScriptRunner cloud Workflow', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let filterOff: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let instance: InstanceElement

  const workflowType = new ObjectType({
    elemID: new ElemID('jira', WORKFLOW_TYPE_NAME),
  })
  beforeEach(() => {
    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    const configOff = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.enableScriptRunnerAddon = true
    filter = workflowFilter(getFilterParams({ config })) as filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
    filterOff = workflowFilter(getFilterParams({ config: configOff })) as filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  })
  describe('post functions', () => {
    const simpleObject = { a: 1 }
    const accountAndGroup = {
      className: SCRIPT_RUNNER_SEND_NOTIFICATIONS,
      accountIds: '1,2,3',
      groupName: '4,5,6',
    }
    const accountAndGroupArrayed = {
      className: SCRIPT_RUNNER_SEND_NOTIFICATIONS,
      accountIds: ['1', '2', '3'],
      groupName: ['4', '5', '6'],
    }
    const goodBase64 = encode(simpleObject)
    const AccountAndGroupB64 = encode(accountAndGroup)
    const wrongInnerStructure = 'eyJhIjoxfQ=='
    const notZippedBuffer = 'eyJjb21wcmVzc2VkIjpbMSwxLDEsMSwxLDFdfQ=='
    const scriptRunnerPostFunctionType = 'com.onresolve.jira.groovy.groovyrunner__script-postfunction'
    beforeEach(() => {
      instance = new InstanceElement(
        'instance',
        workflowType,
        {
          transitions: [
            {
              rules: {
                postFunctions: [
                  {
                    type: scriptRunnerPostFunctionType,
                    configuration: {
                      value: goodBase64,
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
      it('should change field name to scriptRunner', async () => {
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.scriptRunner).toBeDefined()
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.value).toBeUndefined()
      })
      it('should make array of accountIds and groups', async () => {
        instance.value.transitions[0].rules.postFunctions[0].configuration.value = AccountAndGroupB64
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.scriptRunner.accountIds).toEqual(['1', '2', '3'])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.scriptRunner.groupName).toEqual(['4', '5', '6'])
      })
      it('should not make an array of groups if wrong class', async () => {
        const noGroup = {
          className: 'other',
          groupName: '4,5,6',
        }
        const base64OfNoGroup = encode(noGroup)
        instance.value.transitions[0].rules.postFunctions[0].configuration.value = base64OfNoGroup
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.scriptRunner.groupName).toEqual('4,5,6')
      })
      it('should decode properly', async () => {
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.scriptRunner).toEqual({ a: 1 })
      })
      it('should not decode if not compressed', async () => {
        instance.value.transitions[0].rules.postFunctions[0].configuration.value = notZippedBuffer
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.scriptRunner).toEqual(notZippedBuffer)
      })
      it('should not decode if not base64', async () => {
        instance.value.transitions[0].rules.postFunctions[0].configuration.value = 'not base64'
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.scriptRunner).toEqual('not base64')
      })
      it('should not decode if not valid json', async () => {
        instance.value.transitions[0].rules.postFunctions[0].configuration.value = wrongInnerStructure
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.scriptRunner)
          .toEqual(wrongInnerStructure)
      })
      it('should not fail if no value', async () => {
        instance.value.transitions[0].rules.postFunctions[0].configuration.value = undefined
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.scriptRunner).toBeUndefined()
      })
      it('should not decode if script runner not supported', async () => {
        await filterOff.onFetch([instance])
        compareScripts(instance.value.transitions[0].rules.postFunctions[0].configuration.value, goodBase64)
      })
    })
    describe('pre deploy', () => {
      beforeEach(() => {
        renameKey(instance.value.transitions[0].rules.postFunctions[0].configuration, { from: 'value', to: 'scriptRunner' })
      })
      it('should change field name to value', async () => {
        await filter.preDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.scriptRunner).toBeUndefined()
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.value).toBeDefined()
      })
      it('should return an array of accountIds and groups to strings', async () => {
        instance.value.transitions[0].rules.postFunctions[0].configuration.scriptRunner = accountAndGroupArrayed
        await filter.preDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.value).toEqual(AccountAndGroupB64)
      })
      it('should not make an array of groups if wrong class', async () => {
        const noGroup = {
          className: 'other',
          groupName: '4,5,6',
        }
        const base64OfNoGroup = encode(noGroup)
        instance.value.transitions[0].rules.postFunctions[0].configuration.value = base64OfNoGroup
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.scriptRunner.groupName).toEqual('4,5,6')
      })
      it('should encode properly', async () => {
        instance.value.transitions[0].rules.postFunctions[0].configuration.scriptRunner = { a: 1 }
        await filter.preDeploy([toChange({ after: instance })])
        compareScripts(instance.value.transitions[0].rules.postFunctions[0].configuration.value, goodBase64)
      })
      it('should not decode if undefined', async () => {
        instance.value.transitions[0].rules.postFunctions[0].configuration.scriptRunner = undefined
        await filter.preDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.value).toBeUndefined()
      })
      it('should not encode if script runner not supported', async () => {
        renameKey(instance.value.transitions[0].rules.postFunctions[0].configuration, { from: 'scriptRunner', to: 'value' })
        instance.value.transitions[0].rules.postFunctions[0].configuration.value = { a: 1 }
        await filterOff.preDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.value).toEqual({ a: 1 })
      })
    })
    describe('on deploy', () => {
      it('should change field name to scriptRunner', async () => {
        await filter.onDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.scriptRunner).toBeDefined()
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.value).toBeUndefined()
      })
      it('should make array of accountIds and groups', async () => {
        instance.value.transitions[0].rules.postFunctions[0].configuration.value = accountAndGroupArrayed
        await filter.onDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.scriptRunner.accountIds).toEqual(['1', '2', '3'])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.scriptRunner.groupName).toEqual(['4', '5', '6'])
      })
      it('should decode properly', async () => {
        await filter.onDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.scriptRunner).toEqual({ a: 1 })
      })
      it('should not decode if script runner not supported', async () => {
        await filterOff.onDeploy([toChange({ after: instance })])
        compareScripts(instance.value.transitions[0].rules.postFunctions[0].configuration.value, goodBase64)
      })
    })
  })
  describe('validators', () => {
    const goodJsonObject = '{"a":1}'
    const wrongJsonObject = 'wrong'
    const scriptRunnerValidatorType = 'com.onresolve.jira.groovy.groovyrunner__script-workflow-validators'
    beforeEach(() => {
      instance = new InstanceElement(
        'instance',
        workflowType,
        {
          transitions: [
            {
              rules: {
                validators: [
                  {
                    type: scriptRunnerValidatorType,
                    configuration: {
                      value: goodJsonObject,
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
      it('should rename field name to scriptRunner', async () => {
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.validators[0].configuration.scriptRunner).toBeDefined()
        expect(instance.value.transitions[0].rules.validators[0].configuration.value).toBeUndefined()
      })
      it('should objectify properly', async () => {
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.validators[0].configuration.scriptRunner).toEqual({ a: 1 })
      })
      it('should not objectify if not json object', async () => {
        instance.value.transitions[0].rules.validators[0].configuration.value = wrongJsonObject
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.validators[0].configuration.scriptRunner).toEqual(wrongJsonObject)
      })
      it('should not fail if no value', async () => {
        instance.value.transitions[0].rules.validators[0].configuration.value = undefined
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.validators[0].configuration.scriptRunner).toBeUndefined()
      })
    })
    describe('pre deploy', () => {
      beforeEach(() => {
        renameKey(instance.value.transitions[0].rules.validators[0].configuration, { from: 'value', to: 'scriptRunner' })
      })
      it('should rename field name to value', async () => {
        await filter.preDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.validators[0].configuration.value).toBeDefined()
        expect(instance.value.transitions[0].rules.validators[0].configuration.scriptRunner).toBeUndefined()
      })
      it('should stringify properly', async () => {
        instance.value.transitions[0].rules.validators[0].configuration.scriptRunner = { a: 1 }
        await filter.preDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.validators[0].configuration.value).toEqual(goodJsonObject)
      })
      it('should not fail if undefined', async () => {
        instance.value.transitions[0].rules.validators[0].configuration.scriptRunner = undefined
        await filter.preDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.validators[0].configuration.value).toBeUndefined()
      })
    })
    describe('on deploy', () => {
      it('should rename field name to scriptRunner', async () => {
        await filter.onDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.validators[0].configuration.scriptRunner).toBeDefined()
        expect(instance.value.transitions[0].rules.validators[0].configuration.value).toBeUndefined()
      })
      it('should objectify properly', async () => {
        await filter.onDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.validators[0].configuration.scriptRunner).toEqual({ a: 1 })
      })
    })
  })
  describe('conditions', () => {
    const goodJsonObject = '{"b":1}'
    const wrongJsonObject = 'very wrong'
    const scriptRunnerConditionType = 'com.onresolve.jira.groovy.groovyrunner__script-workflow-conditions'
    beforeEach(() => {
      instance = new InstanceElement(
        'instance',
        workflowType,
        {
          transitions: [
            {
              rules: {
                conditions: [
                  {
                    type: scriptRunnerConditionType,
                    configuration: {
                      value: goodJsonObject,
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
      it('should rename field name to scriptRunner', async () => {
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.conditions[0].configuration.scriptRunner).toBeDefined()
        expect(instance.value.transitions[0].rules.conditions[0].configuration.value).toBeUndefined()
      })
      it('should objectify properly', async () => {
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.conditions[0].configuration.scriptRunner).toEqual({ b: 1 })
      })
      it('should not objectify if not json object', async () => {
        instance.value.transitions[0].rules.conditions[0].configuration.value = wrongJsonObject
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.conditions[0].configuration.scriptRunner).toEqual(wrongJsonObject)
      })
      it('should not fail if no value', async () => {
        instance.value.transitions[0].rules.conditions[0].configuration.value = undefined
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.conditions[0].configuration.scriptRunner).toBeUndefined()
      })
    })
    describe('pre deploy', () => {
      beforeEach(() => {
        renameKey(instance.value.transitions[0].rules.conditions[0].configuration, { from: 'value', to: 'scriptRunner' })
      })
      it('should rename field name to value', async () => {
        await filter.preDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.conditions[0].configuration.value).toBeDefined()
        expect(instance.value.transitions[0].rules.conditions[0].configuration.scriptRunner).toBeUndefined()
      })
      it('should stringify properly', async () => {
        instance.value.transitions[0].rules.conditions[0].configuration.scriptRunner = { b: 1 }
        await filter.preDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.conditions[0].configuration.value).toEqual(goodJsonObject)
      })
    })
    describe('on deploy', () => {
      it('should rename field name to scriptRunner', async () => {
        await filter.onDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.conditions[0].configuration.scriptRunner).toBeDefined()
        expect(instance.value.transitions[0].rules.conditions[0].configuration.value).toBeUndefined()
      })
      it('should objectify properly', async () => {
        await filter.onDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.conditions[0].configuration.scriptRunner).toEqual({ b: 1 })
      })
    })
  })
})
