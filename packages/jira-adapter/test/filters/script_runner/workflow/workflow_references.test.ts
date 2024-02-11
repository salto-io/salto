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
import { Change, ElemID, InstanceElement, ReferenceExpression, Value, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { createEmptyType, getFilterParams, mockClient } from '../../../utils'
import referencesFilter from '../../../../src/filters/script_runner/workflow/workflow_references'
import { JIRA_WORKFLOW_TYPE, WORKFLOW_TYPE_NAME } from '../../../../src/constants'
import { getDefaultConfig } from '../../../../src/config/config'
import { SCRIPT_RUNNER_POST_FUNCTION_TYPE } from '../../../../src/filters/script_runner/workflow/workflow_cloud'

const WORKFLOW_V1 = 'workflowV1'
const WORKFLOW_V2 = 'workflowV2'
const SCRIPT_RUNNER = 'scriptRunner'
const FIELD = 'field'

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

const resolvedWorkflowV2Instance = new InstanceElement(
  'instance',
  createEmptyType(JIRA_WORKFLOW_TYPE),
  {
    transitions: {
      tran1: {
        name: 'tran1',
        actions: [
          {
            parameters: {
              field: 1,
            },
          },
        ],
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

const restoredWorkflowV2Instance = new InstanceElement(
  'instance',
  createEmptyType(JIRA_WORKFLOW_TYPE),
  {
    transitions: {
      tran1: {
        name: 'tran1',
        actions: [
          {
            parameters: {
              field: 2,
            },
          },
        ],
      },
    },
  }
)

jest.mock('@salto-io/adapter-utils', () => ({
  ...jest.requireActual<{}>('@salto-io/adapter-utils'),
  resolveValues: jest.fn().mockImplementation((...args) => {
    if (args[0].elemID.typeName === WORKFLOW_TYPE_NAME) {
      return resolvedInstance
    }
    if (args[0].elemID.typeName === JIRA_WORKFLOW_TYPE) {
      return resolvedWorkflowV2Instance
    }
    return undefined
  }),
  restoreValues: jest.fn().mockImplementation((...args) => {
    if (args[1].elemID.typeName === WORKFLOW_TYPE_NAME) {
      return restoredInstance
    }
    if (args[1].elemID.typeName === JIRA_WORKFLOW_TYPE) {
      return restoredWorkflowV2Instance
    }
    return undefined
  }),
}))

describe('Scriptrunner references', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let filterOff: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let filterCloud: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let instance: InstanceElement
  let workflowV2Instance: InstanceElement
  let reference: ReferenceExpression
  let changes: Change[]
  const workflowType = createEmptyType(WORKFLOW_TYPE_NAME)
  const workflowV2Type = createEmptyType(JIRA_WORKFLOW_TYPE)

  const getNestedField = ({
    workflowVersion,
    transitionKey,
    postFunctionIndex,
    fieldName,
  }: {
    workflowVersion: string
    transitionKey: string
    postFunctionIndex: number
    fieldName: string
  }): Value => {
    if (workflowVersion === WORKFLOW_V1) {
      return instance.value.transitions[transitionKey].rules.postFunctions[postFunctionIndex].configuration[fieldName]
    }
    if (workflowVersion === WORKFLOW_V2) {
      return workflowV2Instance.value.transitions[transitionKey].actions[postFunctionIndex].parameters[fieldName]
    }
    throw new Error('Unknown workflow version')
  }

  const getElement = (workflowVersion: string): InstanceElement => {
    if (workflowVersion === WORKFLOW_V1) {
      return instance
    }
    if (workflowVersion === WORKFLOW_V2) {
      return workflowV2Instance
    }
    throw new Error('Unknown workflow version')
  }

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
    workflowV2Instance = new InstanceElement(
      'instance',
      workflowV2Type,
      {
        name: 'instance',
        version: {
          versionNumber: 1,
          id: '123',
        },
        scope: {
          project: 'project',
          type: 'type',
        },
        id: '123',
        statuses: [],
        transitions: {
          tran1: {
            name: 'tran1',
            id: '11',
            actions: [
              {
                ruleKey: 'rule1',
                parameters: {
                  field: reference,
                },
              },
            ],
          },
        },
      }
    )
  })
  describe.each([
    [WORKFLOW_V1],
    [WORKFLOW_V2],
  ])('%s ', workflowVersion => {
    beforeEach(() => {
      changes = [
        toChange({ after: instance }),
        toChange({ after: workflowV2Instance }),
      ]
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
        workflowV2Instance.value.transitions = {
          tran1: {
            id: '11',
            name: 'tran1',
            actions: [
              {
                ruleKey: 'rule1',
                parameters: {
                  appKey: SCRIPT_RUNNER_POST_FUNCTION_TYPE,
                  scriptRunner: {
                    transitionId: '21',
                  },
                },
              },
              {
                ruleKey: 'rule1',
                parameters: {
                  appKey: SCRIPT_RUNNER_POST_FUNCTION_TYPE,
                  scriptRunner: {
                    transitionId: '11',
                  },
                },
              },
            ],
          },
          tran2: {
            id: '21',
            name: 'tran2',
            actions: [
              {
                ruleKey: 'rule1',
                parameters: {
                  appKey: SCRIPT_RUNNER_POST_FUNCTION_TYPE,
                  scriptRunner: {
                    transitionId: '11',
                  },
                },
              },
            ],
          },
        }
      })
      it('should create references to transitions', async () => {
        await filterCloud.onFetch([getElement(workflowVersion)])
        expect(getNestedField({ workflowVersion, transitionKey: 'tran1', postFunctionIndex: 0, fieldName: SCRIPT_RUNNER }).transitionId)
          .toBeInstanceOf(ReferenceExpression)
        expect(getNestedField({ workflowVersion, transitionKey: 'tran1', postFunctionIndex: 0, fieldName: SCRIPT_RUNNER }).transitionId
          .elemID.getFullName()).toEndWith('transitions.tran2')
        expect(getNestedField({ workflowVersion, transitionKey: 'tran1', postFunctionIndex: 1, fieldName: SCRIPT_RUNNER }).transitionId)
          .toBeInstanceOf(ReferenceExpression)
        expect(getNestedField({ workflowVersion, transitionKey: 'tran1', postFunctionIndex: 1, fieldName: SCRIPT_RUNNER }).transitionId
          .elemID.getFullName()).toEndWith('transitions.tran1')
        expect(getNestedField({ workflowVersion, transitionKey: 'tran2', postFunctionIndex: 0, fieldName: SCRIPT_RUNNER }).transitionId)
          .toBeInstanceOf(ReferenceExpression)
        expect(getNestedField({ workflowVersion, transitionKey: 'tran2', postFunctionIndex: 0, fieldName: SCRIPT_RUNNER }).transitionId
          .elemID.getFullName()).toEndWith('transitions.tran1')
      })
      it('should not fail if wrong structure', async () => {
        workflowV2Instance.value.transitions = {
          tran1: {
            id: '11',
            name: 'tran1',
          },
          tran2: {
            id: '21',
            name: 'tran2',
            actions: [
            ],
          },
          tran3: {
            id: '31',
            name: 'tran3',
            actions: [
              { },
            ],
          },
          tran4: {
            id: '41',
            name: 'tran4',
            actions: [
              {
                parameters: {
                },
              },
              {
                parameters: {
                  scriptRunner: {
                  },
                },
              },
            ],
          },
        }
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
        await expect(filterCloud.onFetch([getElement(workflowVersion)])).resolves.not.toThrow()
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
        workflowV2Instance.value.transitions = {
          tran1: {
            id: '11',
            name: 'tran1',
            actions: [
              {
                ruleKey: 'rule1',
                parameters: {
                  appKey: SCRIPT_RUNNER_POST_FUNCTION_TYPE,
                  scriptRunner: {
                    transitionId: '21',
                  },
                },
              },
            ],
          },
        }
        await filterCloud.onFetch([getElement(workflowVersion)])
        const { transitionId } = getNestedField({ workflowVersion, transitionKey: 'tran1', postFunctionIndex: 0, fieldName: SCRIPT_RUNNER })
        expect(transitionId).toBeInstanceOf(ReferenceExpression)
        expect(transitionId.elemID.getFullName()).toEndWith('.transitions.missing_21')
      })
      it('should not change anything if script runner is not enabled', async () => {
        await filterOff.onFetch([getElement(workflowVersion)])
        expect(getNestedField({ workflowVersion, transitionKey: 'tran1', postFunctionIndex: 0, fieldName: SCRIPT_RUNNER }).transitionId)
          .toEqual('21')
      })
      it('should not change anything if dc', async () => {
        await filter.onFetch([getElement(workflowVersion)])
        expect(getNestedField({ workflowVersion, transitionKey: 'tran1', postFunctionIndex: 0, fieldName: SCRIPT_RUNNER }).transitionId)
          .toEqual('21')
      })
      // it('should create reference although enableMissingReferences is undefined', async () => {
      //   config.fetch.enableMissingReferences = undefined
      // })
    })
    describe('pre deploy', () => {
      it('should store reference and replace correctly', async () => {
        await filter.preDeploy(changes)
        expect(getNestedField({ workflowVersion, transitionKey: 'tran1', postFunctionIndex: 0, fieldName: FIELD })).toEqual(1)
      })
      it('should store reference and replace correctly in modification', async () => {
        await filter.preDeploy([
          toChange({ before: instance, after: instance }),
          toChange({ before: workflowV2Instance, after: workflowV2Instance }),
        ])
        expect(getNestedField({ workflowVersion, transitionKey: 'tran1', postFunctionIndex: 0, fieldName: FIELD }))
          .toEqual(1)
      })
      it('should not change if script runner not supported', async () => {
        await filterOff.preDeploy(changes)
        expect(getNestedField({ workflowVersion, transitionKey: 'tran1', postFunctionIndex: 0, fieldName: FIELD }))
          .toEqual(reference)
      })
      it('should change if cloud', async () => {
        await filterCloud.preDeploy(changes)
        expect(getNestedField({ workflowVersion, transitionKey: 'tran1', postFunctionIndex: 0, fieldName: FIELD }))
          .toEqual(1)
      })
    })
    describe('on deploy', () => {
      it('should return reference', async () => {
        await filter.onDeploy(changes)
        expect(getNestedField({ workflowVersion, transitionKey: 'tran1', postFunctionIndex: 0, fieldName: FIELD }))
          .toEqual(2)
      })
      it('should do nothing if scirptrunner not supported', async () => {
        await filterOff.onDeploy(changes)
        expect(getNestedField({ workflowVersion, transitionKey: 'tran1', postFunctionIndex: 0, fieldName: FIELD }))
          .toEqual(reference)
      })
      it('should return if cloud', async () => {
        await filterCloud.onDeploy(changes)
        expect(getNestedField({ workflowVersion, transitionKey: 'tran1', postFunctionIndex: 0, fieldName: FIELD }))
          .toEqual(2)
      })
    })
  })
})
