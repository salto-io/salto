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
import { getFilterParams } from '../../utils'
import workflowPostFunctionsFilter from '../../../src/filters/script_runner/workflow_scripts'
import { WORKFLOW_TYPE_NAME } from '../../../src/constants'

describe('Workflow post functions', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let instance: InstanceElement

  const workflowType = new ObjectType({
    elemID: new ElemID('jira', WORKFLOW_TYPE_NAME),
  })
  beforeEach(() => {
    filter = workflowPostFunctionsFilter(getFilterParams()) as filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  })
  describe('post functions', () => {
    const goodBase64 = 'eyJjb21wcmVzc2VkIjpbMzEsMTM5LDgsMCwwLDAsMCwwLDAsMTksMTcxLDg2LDc0LDg0LDE3OCw1MCwxNzIsNSwwLDE3NSwxNzIsMjcsODYsNywwLDAsMF19'
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
      it('should decode properly', async () => {
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.value).toEqual({ a: 1 })
      })
      it('should not decode if not compressed', async () => {
        instance.value.transitions[0].rules.postFunctions[0].configuration.value = notZippedBuffer
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.value).toEqual(notZippedBuffer)
      })
      it('should not decode if not base64', async () => {
        instance.value.transitions[0].rules.postFunctions[0].configuration.value = 'not base64'
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.value).toEqual('not base64')
      })
      it('should not decode if not valid json', async () => {
        instance.value.transitions[0].rules.postFunctions[0].configuration.value = wrongInnerStructure
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.value).toEqual(wrongInnerStructure)
      })
      it('should not fail if no value', async () => {
        instance.value.transitions[0].rules.postFunctions[0].configuration.value = undefined
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.value).toBeUndefined()
      })
    })
    describe('pre deploy', () => {
      it('should encode properly', async () => {
        instance.value.transitions[0].rules.postFunctions[0].configuration.value = { a: 1 }
        await filter.preDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.value).toEqual(goodBase64)
      })
      it('should not fail if undefined', async () => {
        instance.value.transitions[0].rules.postFunctions[0].configuration.value = undefined
        await filter.preDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.value).toBeUndefined()
      })
    })
    describe('on deploy', () => {
      it('should decode properly', async () => {
        await filter.onDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.postFunctions[0].configuration.value).toEqual({ a: 1 })
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
      it('should objectify properly', async () => {
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.validators[0].configuration.value).toEqual({ a: 1 })
      })
      it('should not objectify if not json object', async () => {
        instance.value.transitions[0].rules.validators[0].configuration.value = wrongJsonObject
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.validators[0].configuration.value).toEqual(wrongJsonObject)
      })
      it('should not fail if no value', async () => {
        instance.value.transitions[0].rules.validators[0].configuration.value = undefined
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.validators[0].configuration.value).toBeUndefined()
      })
    })
    describe('pre deploy', () => {
      it('should stringify properly', async () => {
        instance.value.transitions[0].rules.validators[0].configuration.value = { a: 1 }
        await filter.preDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.validators[0].configuration.value).toEqual(goodJsonObject)
      })
      it('should not fail if undefined', async () => {
        instance.value.transitions[0].rules.validators[0].configuration.value = undefined
        await filter.preDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.validators[0].configuration.value).toBeUndefined()
      })
    })
    describe('on deploy', () => {
      it('should objectify properly', async () => {
        await filter.onDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.validators[0].configuration.value).toEqual({ a: 1 })
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
      it('should objectify properly', async () => {
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.conditions[0].configuration.value).toEqual({ b: 1 })
      })
      it('should not objectify if not json object', async () => {
        instance.value.transitions[0].rules.conditions[0].configuration.value = wrongJsonObject
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.conditions[0].configuration.value).toEqual(wrongJsonObject)
      })
      it('should not fail if no value', async () => {
        instance.value.transitions[0].rules.conditions[0].configuration.value = undefined
        await filter.onFetch([instance])
        expect(instance.value.transitions[0].rules.conditions[0].configuration.value).toBeUndefined()
      })
    })
    describe('pre deploy', () => {
      it('should stringify properly', async () => {
        instance.value.transitions[0].rules.conditions[0].configuration.value = { b: 1 }
        await filter.preDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.conditions[0].configuration.value).toEqual(goodJsonObject)
      })
    })
    describe('on deploy', () => {
      it('should objectify properly', async () => {
        await filter.onDeploy([toChange({ after: instance })])
        expect(instance.value.transitions[0].rules.conditions[0].configuration.value).toEqual({ b: 1 })
      })
    })
  })
})
