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
import { filterUtils } from '@salto-io/adapter-components'
import { InstanceElement, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import referencesFilter from '../../../src/filters/script_runner/script_template_expressions'
import { createEmptyType, getFilterParams, mockClient } from '../../utils'
import { getDefaultConfig } from '../../../src/config/config'
import { WORKFLOW_CONFIGURATION_TYPE } from '../../../src/constants'

type FilterType = filterUtils.FilterWith<'onFetch' | 'onDeploy' | 'preDeploy'>

const checkValuesV1NoReference = (element: InstanceElement): void => {
  const postFunction = element.value.transitions.tran1.rules.postFunctions[0].configuration.scriptRunner
  const { conditions } = element.value.transitions.tran1.rules.conditions
  expect(postFunction.field).toEqual(1)
  expect(postFunction.field2).toEqual('no fields')
  expect(postFunction.expression).toEqual('test customfield_1 test2')
  expect(postFunction.additionalCode).toEqual('customfield_2')
  expect(postFunction.emailCode).toEqual('customfield_3 test customfield_4')
  expect(postFunction.condition).toEqual('customfield_5')
  expect(element.value.transitions.tran1.rules.validators[0].configuration.scriptRunner.expression).toEqual(
    'test customfield_1 test2',
  )
  expect(conditions[0].configuration.scriptRunner.expression).toEqual('test customfield_1 test2')
  expect(conditions[1].configuration.scriptRunner.expression).toEqual('test customfield_2 test2')
}

const checkValuesV2NoReference = (element: InstanceElement): void => {
  const postFunction = element.value.transitions.tran1.actions[0].parameters.scriptRunner
  const { conditions } = element.value.transitions.tran1.conditions
  expect(postFunction.field).toEqual(1)
  expect(postFunction.field2).toEqual('no fields')
  expect(postFunction.expression).toEqual('test customfield_1 test2')
  expect(postFunction.additionalCode).toEqual('customfield_2')
  expect(postFunction.emailCode).toEqual('customfield_3 test customfield_4')
  expect(postFunction.condition).toEqual('customfield_5')
  expect(element.value.transitions.tran1.validators[0].parameters.scriptRunner.expression).toEqual(
    'test customfield_1 test2',
  )
  expect(conditions[0].parameters.scriptRunner.expression).toEqual('test customfield_1 test2')
  expect(conditions[1].parameters.scriptRunner.expression).toEqual('test customfield_2 test2')
}

const checkValuesV2 = (element: InstanceElement): void => {
  const postFunction = element.value.transitions.tran1.actions[0].parameters.scriptRunner
  const { conditions } = element.value.transitions.tran1.conditions
  expect(postFunction.field).toEqual(1)
  expect(postFunction.field2).toEqual('no fields')
  expect(postFunction.expression.parts[1].elemID.getFullName()).toEqual('jira.Field.instance.field_1')
  expect(postFunction.additionalCode.parts[0].elemID.getFullName()).toEqual('jira.Field.instance.field_2')
  expect(postFunction.emailCode.parts[0].elemID.getFullName()).toEqual('jira.Field.instance.field_3')
  expect(postFunction.emailCode.parts[2].elemID.getFullName()).toEqual('jira.Field.instance.field_4')
  expect(postFunction.condition.parts[0].elemID.getFullName()).toEqual('jira.Field.instance.field_5')
  expect(
    element.value.transitions.tran1.validators[0].parameters.scriptRunner.expression.parts[1].elemID.getFullName(),
  ).toEqual('jira.Field.instance.field_1')
  expect(conditions[0].parameters.scriptRunner.expression.parts[1].elemID.getFullName()).toEqual(
    'jira.Field.instance.field_1',
  )
  expect(conditions[1].parameters.scriptRunner.expression.parts[1].elemID.getFullName()).toEqual(
    'jira.Field.instance.field_2',
  )
}

const checkValuesV1 = (element: InstanceElement): void => {
  const postFunction = element.value.transitions.tran1.rules.postFunctions[0].configuration.scriptRunner
  const { conditions } = element.value.transitions.tran1.rules.conditions
  expect(postFunction.field).toEqual(1)
  expect(postFunction.field2).toEqual('no fields')
  expect(postFunction.expression.parts[1].elemID.getFullName()).toEqual('jira.Field.instance.field_1')
  expect(postFunction.additionalCode.parts[0].elemID.getFullName()).toEqual('jira.Field.instance.field_2')
  expect(postFunction.emailCode.parts[0].elemID.getFullName()).toEqual('jira.Field.instance.field_3')
  expect(postFunction.emailCode.parts[2].elemID.getFullName()).toEqual('jira.Field.instance.field_4')
  expect(postFunction.condition.parts[0].elemID.getFullName()).toEqual('jira.Field.instance.field_5')
  expect(
    element.value.transitions.tran1.rules.validators[0].configuration.scriptRunner.expression.parts[1].elemID.getFullName(),
  ).toEqual('jira.Field.instance.field_1')
  expect(conditions[0].configuration.scriptRunner.expression.parts[1].elemID.getFullName()).toEqual(
    'jira.Field.instance.field_1',
  )
  expect(conditions[1].configuration.scriptRunner.expression.parts[1].elemID.getFullName()).toEqual(
    'jira.Field.instance.field_2',
  )
}

const checkDcValuesNoReference = (element: InstanceElement): void => {
  const postFunction = element.value.transitions.tran1.rules.postFunctions[0].configuration
  const { conditions } = element.value.transitions.tran1.rules.conditions
  expect(postFunction.field).toEqual(1)
  expect(postFunction.field2.script).toEqual('no fields')
  expect(postFunction.FIELD_CONDITION.script).toEqual('test customfield_1 test2')
  expect(postFunction.FIELD_ADDITIONAL_SCRIPT.script).toEqual('customfield_2')
  expect(postFunction.FIELD_SCRIPT_FILE_OR_SCRIPT.script).toEqual('customfield_3 test customfield_4')
  expect(element.value.transitions.tran1.rules.validators[0].configuration.FIELD_CONDITION.script).toEqual(
    'test customfield_1 test2',
  )
  expect(conditions[0].configuration.FIELD_SCRIPT_FILE_OR_SCRIPT.script).toEqual('test customfield_1 test2')
  expect(conditions[1].configuration.FIELD_SCRIPT_FILE_OR_SCRIPT.script).toEqual('test customfield_2 test2')
}

const checkDcValues = (element: InstanceElement): void => {
  const postFunction = element.value.transitions.tran1.rules.postFunctions[0].configuration
  const { conditions } = element.value.transitions.tran1.rules.conditions
  expect(postFunction.field).toEqual(1)
  expect(postFunction.field2.script).toEqual('no fields')
  expect(postFunction.FIELD_CONDITION.script.parts[1].elemID.getFullName()).toEqual('jira.Field.instance.field_1')
  expect(postFunction.FIELD_ADDITIONAL_SCRIPT.script.parts[0].elemID.getFullName()).toEqual(
    'jira.Field.instance.field_2',
  )
  expect(postFunction.FIELD_SCRIPT_FILE_OR_SCRIPT.script.parts[0].elemID.getFullName()).toEqual(
    'jira.Field.instance.field_3',
  )
  expect(postFunction.FIELD_SCRIPT_FILE_OR_SCRIPT.script.parts[2].elemID.getFullName()).toEqual(
    'jira.Field.instance.field_4',
  )
  expect(
    element.value.transitions.tran1.rules.validators[0].configuration.FIELD_CONDITION.script.parts[1].elemID.getFullName(),
  ).toEqual('jira.Field.instance.field_1')
  expect(conditions[0].configuration.FIELD_SCRIPT_FILE_OR_SCRIPT.script.parts[1].elemID.getFullName()).toEqual(
    'jira.Field.instance.field_1',
  )
  expect(conditions[1].configuration.FIELD_SCRIPT_FILE_OR_SCRIPT.script.parts[1].elemID.getFullName()).toEqual(
    'jira.Field.instance.field_2',
  )
}

describe('workflow_script_references', () => {
  const fields: InstanceElement[] = []
  _.range(5).forEach(index => {
    fields[index] = new InstanceElement(`field_${index + 1}`, createEmptyType('Field'), {
      id: `customfield_${index + 1}`,
    })
  })
  describe('cloud', () => {
    let filter: FilterType
    let filterOff: FilterType
    let instance: InstanceElement
    beforeEach(() => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      const configOff = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableScriptRunnerAddon = true
      filter = referencesFilter(getFilterParams({ config })) as FilterType
      filterOff = referencesFilter(getFilterParams({ config: configOff })) as FilterType
    })
    describe('WORKFLOW_V1', () => {
      beforeEach(() => {
        instance = new InstanceElement('instance', createEmptyType('Workflow'), {
          transitions: {
            tran1: {
              name: 'tran1',
              rules: {
                undefined, // to test cases of undefined fields
                postFunctions: [
                  {
                    type: 'com.onresolve.jira.groovy.groovyrunner__script-postfunction',
                    configuration: {
                      scriptRunner: {
                        field: 1,
                        field2: 'no fields',
                        expression: 'test customfield_1 test2',
                        additionalCode: 'customfield_2',
                        emailCode: 'customfield_3 test customfield_4',
                        condition: 'customfield_5',
                      },
                    },
                  },
                ],
                validators: [
                  {
                    type: 'com.onresolve.jira.groovy.groovyrunner__script-workflow-validators',
                    configuration: {
                      scriptRunner: {
                        expression: 'test customfield_1 test2',
                      },
                    },
                  },
                ],
                conditions: {
                  operator: 'AND',
                  conditions: [
                    {
                      type: 'com.onresolve.jira.groovy.groovyrunner__script-workflow-conditions',
                      configuration: {
                        scriptRunner: {
                          expression: 'test customfield_1 test2',
                        },
                      },
                    },
                    {
                      type: 'com.onresolve.jira.groovy.groovyrunner__script-workflow-conditions',
                      configuration: {
                        scriptRunner: {
                          expression: 'test customfield_2 test2',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        })
      })
      it('fetch should not add references when script runner is disabled', async () => {
        const elements = [instance, ...fields]
        await filterOff.onFetch(elements)
        checkValuesV1NoReference(elements[0])
      })
      it('fetch should add references when script runner is enabled', async () => {
        const elements = [instance, ...fields]
        await filter.onFetch(elements)
        checkValuesV1(elements[0])
      })
      it('fetch should not fail if a script is null', async () => {
        const elements = [instance, ...fields]
        elements[0].value.transitions.tran1.rules.postFunctions[0].configuration.scriptRunner.expression = null
        await filter.onFetch(elements)
        expect(
          elements[0].value.transitions.tran1.rules.postFunctions[0].configuration.scriptRunner.expression,
        ).toBeNull()
      })
      it('fetch should not fail if a scriptRunner object is null', async () => {
        const elements = [instance, ...fields]
        elements[0].value.transitions.tran1.rules.postFunctions[0].configuration.scriptRunner = null
        await filter.onFetch(elements)
        expect(elements[0].value.transitions.tran1.rules.postFunctions[0].configuration.scriptRunner).toBeNull()
      })
      it('pre-deploy should not remove references when script runner is disabled', async () => {
        await filter.onFetch([instance, ...fields])
        await filterOff.preDeploy([toChange({ after: instance })])
        checkValuesV1(instance)
      })
      it('pre-deploy should remove references when script runner is enabled', async () => {
        await filter.onFetch([instance, ...fields])
        await filter.preDeploy([toChange({ after: instance })])
        checkValuesV1NoReference(instance)
      })
      it('onDeploy should not restore references when script runner is disabled', async () => {
        // just for coverage
        await filterOff.onDeploy([toChange({ after: instance })])
        // another for coverage
        const emptyInstance = new InstanceElement('instance', createEmptyType('Workflow'), {
          transitions: [{}],
        })
        await filter.onDeploy([toChange({ after: emptyInstance })])
      })
      it('onDeploy should restore references when script runner is enabled', async () => {
        await filter.onFetch([instance, ...fields])
        await filter.preDeploy([toChange({ after: instance })])
        await filter.onDeploy([toChange({ after: instance })])
        checkValuesV1(instance)
      })
    })
    describe('WORKFLOW_V2', () => {
      beforeEach(() => {
        instance = new InstanceElement('instance', createEmptyType(WORKFLOW_CONFIGURATION_TYPE), {
          name: 'workflowV2',
          scope: {
            type: 'global',
          },
          statuses: [],
          transitions: {
            tran1: {
              name: 'tran1',
              type: 'DIRECTED',
              actions: [
                {
                  ruleKey: 'ruleKey',
                  parameters: {
                    appKey: 'com.onresolve.jira.groovy.groovyrunner__script-postfunction',
                    scriptRunner: {
                      field: 1,
                      field2: 'no fields',
                      expression: 'test customfield_1 test2',
                      additionalCode: 'customfield_2',
                      emailCode: 'customfield_3 test customfield_4',
                      condition: 'customfield_5',
                    },
                  },
                },
              ],
              validators: [
                {
                  ruleKey: 'ruleKey',
                  parameters: {
                    appKey: 'com.onresolve.jira.groovy.groovyrunner__script-workflow-validators',
                    scriptRunner: {
                      expression: 'test customfield_1 test2',
                    },
                  },
                },
              ],
              conditions: {
                operation: 'AND',
                conditions: [
                  {
                    ruleKey: 'ruleKey',
                    parameters: {
                      appKey: 'com.onresolve.jira.groovy.groovyrunner__script-workflow-conditions',
                      scriptRunner: {
                        expression: 'test customfield_1 test2',
                      },
                    },
                  },
                  {
                    ruleKey: 'ruleKey',
                    parameters: {
                      appKey: 'com.onresolve.jira.groovy.groovyrunner__script-workflow-conditions',
                      scriptRunner: {
                        expression: 'test customfield_2 test2',
                      },
                    },
                  },
                ],
              },
            },
          },
        })
      })
      it('fetch should not add references when script runner is disabled', async () => {
        const elements = [instance, ...fields]
        await filterOff.onFetch(elements)
        checkValuesV2NoReference(elements[0])
      })
      it('fetch should add references when script runner is enabled', async () => {
        const elements = [instance, ...fields]
        await filter.onFetch(elements)
        checkValuesV2(elements[0])
      })
      it('fetch should not fail if a script is null', async () => {
        const elements = [instance, ...fields]
        elements[0].value.transitions.tran1.actions[0].parameters.scriptRunner.expression = null
        await filter.onFetch(elements)
        expect(elements[0].value.transitions.tran1.actions[0].parameters.scriptRunner.expression).toBeNull()
      })
      it('fetch should not fail if a scriptRunner object is null', async () => {
        const elements = [instance, ...fields]
        elements[0].value.transitions.tran1.actions[0].parameters.scriptRunner = null
        await filter.onFetch(elements)
        expect(elements[0].value.transitions.tran1.actions[0].parameters.scriptRunner).toBeNull()
      })
      it('pre-deploy should not remove references when script runner is disabled', async () => {
        await filter.onFetch([instance, ...fields])
        await filterOff.preDeploy([toChange({ after: instance })])
        checkValuesV2(instance)
      })
      it('pre-deploy should remove references when script runner is enabled', async () => {
        await filter.onFetch([instance, ...fields])
        await filter.preDeploy([toChange({ after: instance })])
        checkValuesV2NoReference(instance)
      })
      it('onDeploy should not restore references when script runner is disabled', async () => {
        // just for coverage
        await filterOff.onDeploy([toChange({ after: instance })])
        // another for coverage
        const emptyInstance = new InstanceElement('instance', createEmptyType(WORKFLOW_CONFIGURATION_TYPE), {
          transitions: [{}],
        })
        await filter.onDeploy([toChange({ after: emptyInstance })])
      })
      it('onDeploy should restore references when script runner is enabled', async () => {
        await filter.onFetch([instance, ...fields])
        await filter.preDeploy([toChange({ after: instance })])
        await filter.onDeploy([toChange({ after: instance })])
        checkValuesV2(instance)
      })
    })
  })
  describe('DC', () => {
    let filter: FilterType
    let filterOff: FilterType
    let instance: InstanceElement
    beforeEach(() => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: true }))
      const configOff = _.cloneDeep(getDefaultConfig({ isDataCenter: true }))
      const { client } = mockClient(true)
      config.fetch.enableScriptRunnerAddon = true
      filter = referencesFilter(getFilterParams({ config, client })) as FilterType
      filterOff = referencesFilter(getFilterParams({ config: configOff, client })) as FilterType

      const workflowType = createEmptyType('Workflow')
      instance = new InstanceElement('instance', workflowType, {
        transitions: {
          tran1: {
            name: 'tran1',
            rules: {
              undefined, // to test cases of undefined fields
              postFunctions: [
                {
                  type: 'com.onresolve.jira.groovy.GroovyFunctionPlugin',
                  configuration: {
                    field: 1,
                    field2: {
                      script: 'no fields',
                    },
                    FIELD_CONDITION: {
                      script: 'test customfield_1 test2',
                    },
                    FIELD_ADDITIONAL_SCRIPT: {
                      script: 'customfield_2',
                    },
                    FIELD_SCRIPT_FILE_OR_SCRIPT: {
                      script: 'customfield_3 test customfield_4',
                    },
                  },
                },
              ],
              validators: [
                {
                  type: 'com.onresolve.jira.groovy.GroovyValidator',
                  configuration: {
                    FIELD_CONDITION: {
                      script: 'test customfield_1 test2',
                    },
                  },
                },
              ],
              conditions: {
                operator: 'AND',
                conditions: [
                  {
                    type: 'com.onresolve.jira.groovy.GroovyCondition',
                    configuration: {
                      FIELD_SCRIPT_FILE_OR_SCRIPT: {
                        script: 'test customfield_1 test2',
                      },
                    },
                  },
                  {
                    type: 'com.onresolve.jira.groovy.GroovyCondition',
                    configuration: {
                      FIELD_SCRIPT_FILE_OR_SCRIPT: {
                        script: 'test customfield_2 test2',
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      })
    })
    it('fetch should not add references when script runner is disabled', async () => {
      const elements = [instance, ...fields]
      await filterOff.onFetch(elements)
      checkDcValuesNoReference(elements[0])
    })
    it('fetch should add references when script runner is enabled', async () => {
      const elements = [instance, ...fields]
      await filter.onFetch(elements)
      checkDcValues(elements[0])
    })
    it('fetch should not fail if a script is null', async () => {
      const elements = [instance, ...fields]
      elements[0].value.transitions.tran1.rules.postFunctions[0].configuration.FIELD_CONDITION = null
      await filter.onFetch(elements)
      expect(elements[0].value.transitions.tran1.rules.postFunctions[0].configuration.FIELD_CONDITION).toBeNull()
    })
    it('fetch should not fail if a scriptRunner object is null', async () => {
      const elements = [instance, ...fields]
      elements[0].value.transitions.tran1.rules.postFunctions[0].configuration = null
      await filter.onFetch(elements)
      expect(elements[0].value.transitions.tran1.rules.postFunctions[0].configuration).toBeNull()
    })
    it('pre-deploy should not remove references when script runner is disabled', async () => {
      await filter.onFetch([instance, ...fields])
      await filterOff.preDeploy([toChange({ after: instance })])
      checkDcValues(instance)
    })
    it('pre-deploy should remove references when script runner is enabled', async () => {
      await filter.onFetch([instance, ...fields])
      await filter.preDeploy([toChange({ after: instance })])
      checkDcValuesNoReference(instance)
    })
    it('onDeploy should not restore references when script runner is disabled', async () => {
      // just for coverage
      await filterOff.onDeploy([toChange({ after: instance })])
    })
    it('onDeploy should restore references when script runner is enabled', async () => {
      await filter.onFetch([instance, ...fields])
      await filter.preDeploy([toChange({ after: instance })])
      await filter.onDeploy([toChange({ after: instance })])
      checkDcValues(instance)
    })
  })
})
