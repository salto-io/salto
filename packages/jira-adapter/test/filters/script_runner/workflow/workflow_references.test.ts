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
import { ElemID, InstanceElement, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { createEmptyType, getFilterParams, mockClient } from '../../../utils'
import referencesFilter from '../../../../src/filters/script_runner/workflow/workflow_references'
import { WORKFLOW_TYPE_NAME } from '../../../../src/constants'
import { getDefaultConfig } from '../../../../src/config/config'
import { SCRIPT_RUNNER_POST_FUNCTION_TYPE } from '../../../../src/filters/script_runner/workflow/workflow_cloud'

const resolvedInstance = new InstanceElement(
  'instance',
  createEmptyType(WORKFLOW_TYPE_NAME),
  {
    transitions: {
      tran1: {
        name: 'tran1',
        rules: {
          postFunctions: [
            {
              configuration: {
                field: 1,
              },
            },
          ],
        },
      },
    },
  }
)

const restoredInstance = new InstanceElement(
  'instance',
  createEmptyType(WORKFLOW_TYPE_NAME),
  {
    transitions: {
      tran1: {
        name: 'tran1',
        rules: {
          postFunctions: [
            {
              configuration: {
                field: 2,
              },
            },
          ],
        },
      },
    },
  }
)

const resolveValuesMock = jest.fn().mockReturnValue(resolvedInstance)
const restoreValuesMock = jest.fn().mockReturnValue(restoredInstance)
jest.mock('@salto-io/adapter-utils', () => ({
  ...jest.requireActual<{}>('@salto-io/adapter-utils'),
  resolveValues: jest.fn().mockImplementation((...args) => resolveValuesMock(args)),
  restoreValues: jest.fn().mockImplementation((...args) => restoreValuesMock(args)),
}))

describe('Scriptrunner references', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let filterOff: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let filterCloud: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let instance: InstanceElement
  let reference: ReferenceExpression
  const workflowType = createEmptyType(WORKFLOW_TYPE_NAME)


  beforeEach(() => {
    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: true }))
    const configOff = _.cloneDeep(getDefaultConfig({ isDataCenter: true }))
    const { client } = mockClient(true)
    config.fetch.enableScriptRunnerAddon = true
    filter = referencesFilter(getFilterParams({ client, config })) as filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
    filterOff = referencesFilter(getFilterParams({ client, config: configOff })) as filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
    filterCloud = referencesFilter(getFilterParams({ config })) as filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
    reference = new ReferenceExpression(new ElemID('jira', 'temp', 'instance', 'reference'))
    instance = new InstanceElement(
      'instance',
      workflowType,
      {
        transitions: {
          tran1: {
            name: 'tran1',
            rules: {
              postFunctions: [
                {
                  configuration: {
                    field: reference,
                  },
                },
              ],
            },
          },
        },
      }
    )
  })
  describe('on fetch', () => {
    beforeEach(() => {
      instance.value.transitions = {
        tran1: {
          id: '11',
          name: 'tran1',
          rules: {
            postFunctions: [
              {
                type: SCRIPT_RUNNER_POST_FUNCTION_TYPE,
                configuration: {
                  scriptRunner: {
                    transitionId: '21',
                  },
                },
              },
              {
                type: SCRIPT_RUNNER_POST_FUNCTION_TYPE,
                configuration: {
                  scriptRunner: {
                    transitionId: '11',
                  },
                },
              },
            ],
          },
        },
        tran2: {
          id: '21',
          name: 'tran2',
          rules: {
            postFunctions: [
              {
                type: SCRIPT_RUNNER_POST_FUNCTION_TYPE,
                configuration: {
                  scriptRunner: {
                    transitionId: '11',
                  },
                },
              },
            ],
          },
        },
      }
    })
    it('should create references to transitions', async () => {
      await filterCloud.onFetch([instance])
      expect(instance.value.transitions.tran1.rules.postFunctions[0].configuration.scriptRunner.transitionId)
        .toBeInstanceOf(ReferenceExpression)
      expect(instance.value.transitions.tran1.rules.postFunctions[0].configuration.scriptRunner.transitionId
        .elemID.getFullName()).toEqual('jira.Workflow.instance.instance.transitions.tran2')
      expect(instance.value.transitions.tran1.rules.postFunctions[1].configuration.scriptRunner.transitionId)
        .toBeInstanceOf(ReferenceExpression)
      expect(instance.value.transitions.tran1.rules.postFunctions[1].configuration.scriptRunner.transitionId
        .elemID.getFullName()).toEqual('jira.Workflow.instance.instance.transitions.tran1')
      expect(instance.value.transitions.tran2.rules.postFunctions[0].configuration.scriptRunner.transitionId)
        .toBeInstanceOf(ReferenceExpression)
      expect(instance.value.transitions.tran2.rules.postFunctions[0].configuration.scriptRunner.transitionId
        .elemID.getFullName()).toEqual('jira.Workflow.instance.instance.transitions.tran1')
    })
    it('should not fail if wrong structure', async () => {
      instance.value.transitions = {
        tran1: {
          id: '11',
          name: 'tran1',
        },
        tran2: {
          id: '21',
          name: 'tran2',
          rules: {
          },
        },
        tran3: {
          id: '31',
          name: 'tran3',
          rules: {
            postFunctions: [
              {
              },
            ],
          },
        },
        tran4: {
          id: '41',
          name: 'tran4',
          rules: {
            postFunctions: [
              {
                type: SCRIPT_RUNNER_POST_FUNCTION_TYPE,
              },
              {
                type: SCRIPT_RUNNER_POST_FUNCTION_TYPE,
                configuration: {
                },
              },
              {
                type: SCRIPT_RUNNER_POST_FUNCTION_TYPE,
                configuration: {
                  scriptRunner: {
                  },
                },
              },
            ],
          },
        },
      }
      await expect(filterCloud.onFetch([instance])).resolves.not.toThrow()
    })
    it('should convert to missing reference if transition id does not exist', async () => {
      instance.value.transitions = {
        tran1: {
          id: '11',
          name: 'tran1',
          rules: {
            postFunctions: [
              {
                type: SCRIPT_RUNNER_POST_FUNCTION_TYPE,
                configuration: {
                  scriptRunner: {
                    transitionId: '21',
                  },
                },
              },
            ],
          },
        },
      }
      await filterCloud.onFetch([instance])
      const { transitionId } = instance.value.transitions.tran1.rules.postFunctions[0].configuration.scriptRunner
      expect(transitionId).toBeInstanceOf(ReferenceExpression)
      expect(transitionId.elemID.getFullName()).toEqual('jira.Workflow.instance.instance.transitions.missing_21')
    })
    it('should not change anything if script runner is not enabled', async () => {
      await filterOff.onFetch([instance])
      expect(instance.value.transitions.tran1.rules.postFunctions[0].configuration.scriptRunner.transitionId)
        .toEqual('21')
    })
    it('should not change anything if dc', async () => {
      await filter.onFetch([instance])
      expect(instance.value.transitions.tran1.rules.postFunctions[0].configuration.scriptRunner.transitionId)
        .toEqual('21')
    })
  })
  describe('pre deploy', () => {
    it('should store reference and replace correctly', async () => {
      await filter.preDeploy([toChange({ after: instance })])
      expect(instance.value.transitions.tran1.rules.postFunctions[0].configuration.field).toEqual(1)
    })
    it('should store reference and replace correctly in modification', async () => {
      await filter.preDeploy([toChange({ before: instance, after: instance })])
      expect(instance.value.transitions.tran1.rules.postFunctions[0].configuration.field).toEqual(1)
    })
    it('should not change if script runner not supported', async () => {
      await filterOff.preDeploy([toChange({ after: instance })])
      expect(instance.value.transitions.tran1.rules.postFunctions[0].configuration.field).toEqual(reference)
    })
    it('should change if cloud', async () => {
      await filterCloud.preDeploy([toChange({ after: instance })])
      expect(instance.value.transitions.tran1.rules.postFunctions[0].configuration.field).toEqual(1)
    })
  })
  describe('on deploy', () => {
    it('should return reference', async () => {
      await filter.onDeploy([toChange({ after: instance })])
      expect(instance.value.transitions.tran1.rules.postFunctions[0].configuration.field).toEqual(2)
    })
    it('should do nothing if scirptrunner not supported', async () => {
      await filterOff.onDeploy([toChange({ after: instance })])
      expect(instance.value.transitions.tran1.rules.postFunctions[0].configuration.field).toEqual(reference)
    })
    it('should return if cloud', async () => {
      await filterCloud.onDeploy([toChange({ after: instance })])
      expect(instance.value.transitions.tran1.rules.postFunctions[0].configuration.field).toEqual(2)
    })
  })
})
