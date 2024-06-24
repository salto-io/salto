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
import { naclCase } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { createEmptyType, getFilterParams, mockClient } from '../../../utils'
import referencesFilter from '../../../../src/filters/script_runner/workflow/workflow_references'
import { WORKFLOW_CONFIGURATION_TYPE, WORKFLOW_TYPE_NAME } from '../../../../src/constants'
import { getDefaultConfig } from '../../../../src/config/config'
import { SCRIPT_RUNNER_POST_FUNCTION_TYPE } from '../../../../src/filters/script_runner/workflow/workflow_cloud'

const WORKFLOW_V1 = 'workflowV1'
const WORKFLOW_V2 = 'workflowV2'
const TRANSITION_KEY = naclCase('tran1::From: Open::Directed')

const resolvedInstance = new InstanceElement('instance', createEmptyType(WORKFLOW_TYPE_NAME), {
  transitions: {
    [TRANSITION_KEY]: {
      name: 'tran1',
      rules: {
        postFunctions: [
          {
            type: SCRIPT_RUNNER_POST_FUNCTION_TYPE,
            configuration: {
              scriptRunner: {
                field: 1,
                transitionId: 11,
              },
            },
          },
        ],
      },
    },
  },
})

const resolvedWorkflowV2Instance = new InstanceElement('instance', createEmptyType(WORKFLOW_CONFIGURATION_TYPE), {
  transitions: {
    [TRANSITION_KEY]: {
      name: 'tran1',
      type: 'DIRECTED',
      actions: [
        {
          parameters: {
            appKey: SCRIPT_RUNNER_POST_FUNCTION_TYPE,
            scriptRunner: {
              field: 1,
              transitionId: 11,
            },
          },
        },
      ],
    },
  },
})

const restoredInstance = new InstanceElement('instance', createEmptyType(WORKFLOW_TYPE_NAME), {
  transitions: {
    [TRANSITION_KEY]: {
      name: 'tran1',
      rules: {
        postFunctions: [
          {
            type: SCRIPT_RUNNER_POST_FUNCTION_TYPE,
            configuration: {
              scriptRunner: {
                field: 2,
                transitionId: 21,
              },
            },
          },
        ],
      },
    },
  },
})

const restoredWorkflowV2Instance = new InstanceElement('instance', createEmptyType(WORKFLOW_CONFIGURATION_TYPE), {
  transitions: {
    [TRANSITION_KEY]: {
      name: 'tran1',
      type: 'DIRECTED',
      actions: [
        {
          parameters: {
            appKey: SCRIPT_RUNNER_POST_FUNCTION_TYPE,
            scriptRunner: {
              field: 2,
              transitionId: 21,
            },
          },
        },
      ],
    },
  },
})

jest.mock('@salto-io/adapter-components', () => ({
  ...jest.requireActual<{}>('@salto-io/adapter-components'),
  resolveValues: jest.fn().mockImplementation((...args) => {
    if (args[0].elemID.typeName === WORKFLOW_TYPE_NAME) {
      return resolvedInstance
    }
    if (args[0].elemID.typeName === WORKFLOW_CONFIGURATION_TYPE) {
      return resolvedWorkflowV2Instance
    }
    return undefined
  }),
  restoreValues: jest.fn().mockImplementation((...args) => {
    if (args[1].elemID.typeName === WORKFLOW_TYPE_NAME) {
      return restoredInstance
    }
    if (args[1].elemID.typeName === WORKFLOW_CONFIGURATION_TYPE) {
      return restoredWorkflowV2Instance
    }
    return undefined
  }),
}))

describe('Scriptrunner references', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let filterOff: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let filterCloud: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let filterCloudWithoutMissingReferences: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let instance: InstanceElement
  let workflowV2Instance: InstanceElement
  let reference: ReferenceExpression
  let transitionV1Reference: ReferenceExpression
  let transitionV2Reference: ReferenceExpression
  let changes: Change[]
  const workflowType = createEmptyType(WORKFLOW_TYPE_NAME)
  const workflowV2Type = createEmptyType(WORKFLOW_CONFIGURATION_TYPE)

  const getScriptRunnerField = ({
    workflowVersion,
    transitionKey,
    postFunctionIndex,
  }: {
    workflowVersion: string
    transitionKey: string
    postFunctionIndex: number
  }): Value => {
    if (workflowVersion === WORKFLOW_V1) {
      return instance.value.transitions[transitionKey].rules.postFunctions[postFunctionIndex].configuration.scriptRunner
    }
    if (workflowVersion === WORKFLOW_V2) {
      return workflowV2Instance.value.transitions[transitionKey].actions[postFunctionIndex].parameters.scriptRunner
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

  const getChange = (workflowVersion: string): Change => {
    if (workflowVersion === WORKFLOW_V1) {
      return toChange({ after: instance })
    }
    if (workflowVersion === WORKFLOW_V2) {
      return toChange({ after: workflowV2Instance })
    }
    throw new Error('Unknown workflow version')
  }

  const getTransitionReference = (workflowVersion: string): ReferenceExpression => {
    if (workflowVersion === WORKFLOW_V1) {
      return transitionV1Reference
    }
    if (workflowVersion === WORKFLOW_V2) {
      return transitionV2Reference
    }
    throw new Error('Unknown workflow version')
  }

  beforeEach(() => {
    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: true }))
    const configOff = _.cloneDeep(getDefaultConfig({ isDataCenter: true }))
    const configWithoutMissingReferences = _.cloneDeep(getDefaultConfig({ isDataCenter: true }))
    const { client } = mockClient(true)
    config.fetch.enableScriptRunnerAddon = true
    configWithoutMissingReferences.fetch.enableScriptRunnerAddon = true
    configWithoutMissingReferences.fetch.enableMissingReferences = false
    filter = referencesFilter(getFilterParams({ client, config })) as filterUtils.FilterWith<
      'onFetch' | 'preDeploy' | 'onDeploy'
    >
    filterOff = referencesFilter(getFilterParams({ client, config: configOff })) as filterUtils.FilterWith<
      'onFetch' | 'preDeploy' | 'onDeploy'
    >
    filterCloud = referencesFilter(getFilterParams({ config })) as filterUtils.FilterWith<
      'onFetch' | 'preDeploy' | 'onDeploy'
    >
    filterCloudWithoutMissingReferences = referencesFilter(
      getFilterParams({ config: configWithoutMissingReferences }),
    ) as filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
    reference = new ReferenceExpression(new ElemID('jira', 'temp', 'instance', 'reference'))
    const transitionV1 = {
      name: 'tran1',
      rules: {
        postFunctions: [
          {
            type: SCRIPT_RUNNER_POST_FUNCTION_TYPE,
            configuration: {
              scriptRunner: {
                field: reference,
                transitionId: '11',
              },
            },
          },
        ],
      },
    }
    instance = new InstanceElement('instance', workflowType, {
      transitions: {
        [TRANSITION_KEY]: transitionV1,
      },
    })
    transitionV1Reference = new ReferenceExpression(
      instance.elemID.createNestedID('transitions', TRANSITION_KEY),
      transitionV1,
    )
    instance.value.transitions[TRANSITION_KEY].rules.postFunctions[0].configuration.scriptRunner.transitionId =
      transitionV1Reference
    const transitionV2 = {
      name: 'tran1',
      id: '11',
      type: 'DIRECTED',
      actions: [
        {
          ruleKey: 'rule1',
          parameters: {
            appKey: SCRIPT_RUNNER_POST_FUNCTION_TYPE,
            scriptRunner: {
              field: reference,
            },
          },
        },
      ],
    }
    workflowV2Instance = new InstanceElement('instance', workflowV2Type, {
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
        [TRANSITION_KEY]: transitionV2,
      },
    })
    transitionV2Reference = new ReferenceExpression(
      workflowV2Instance.elemID.createNestedID('transitions', TRANSITION_KEY),
      transitionV2,
    )
    workflowV2Instance.value.transitions[TRANSITION_KEY].actions[0].parameters.scriptRunner.transitionId =
      transitionV2Reference
  })
  describe.each([[WORKFLOW_V1], [WORKFLOW_V2]])('%s ', workflowVersion => {
    beforeEach(() => {
      changes = [getChange(workflowVersion)]
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
            type: 'DIRECTED',
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
            type: 'DIRECTED',
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
        expect(
          getScriptRunnerField({ workflowVersion, transitionKey: 'tran1', postFunctionIndex: 0 }).transitionId,
        ).toBeInstanceOf(ReferenceExpression)
        expect(
          getScriptRunnerField({
            workflowVersion,
            transitionKey: 'tran1',
            postFunctionIndex: 0,
          }).transitionId.elemID.getFullName(),
        ).toEndWith('transitions.tran2')
        expect(
          getScriptRunnerField({ workflowVersion, transitionKey: 'tran1', postFunctionIndex: 1 }).transitionId,
        ).toBeInstanceOf(ReferenceExpression)
        expect(
          getScriptRunnerField({
            workflowVersion,
            transitionKey: 'tran1',
            postFunctionIndex: 1,
          }).transitionId.elemID.getFullName(),
        ).toEndWith('transitions.tran1')
        expect(
          getScriptRunnerField({ workflowVersion, transitionKey: 'tran2', postFunctionIndex: 0 }).transitionId,
        ).toBeInstanceOf(ReferenceExpression)
        expect(
          getScriptRunnerField({
            workflowVersion,
            transitionKey: 'tran2',
            postFunctionIndex: 0,
          }).transitionId.elemID.getFullName(),
        ).toEndWith('transitions.tran1')
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
            actions: [],
          },
          tran3: {
            id: '31',
            name: 'tran3',
            actions: [{}],
          },
          tran4: {
            id: '41',
            name: 'tran4',
            actions: [
              {
                parameters: {},
              },
              {
                parameters: {
                  scriptRunner: {},
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
            rules: {},
          },
          tran3: {
            id: '31',
            name: 'tran3',
            rules: {
              postFunctions: [{}],
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
                  configuration: {},
                },
                {
                  type: SCRIPT_RUNNER_POST_FUNCTION_TYPE,
                  configuration: {
                    scriptRunner: {},
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
            type: 'DIRECTED',
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
        const { transitionId } = getScriptRunnerField({ workflowVersion, transitionKey: 'tran1', postFunctionIndex: 0 })
        expect(transitionId).toBeInstanceOf(ReferenceExpression)
        expect(transitionId.elemID.getFullName()).toEndWith('.transitions.missing_21')
      })

      it('should not convert to missing reference if the transitionId is empty', async () => {
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
                      transitionId: '',
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
            type: 'DIRECTED',
            actions: [
              {
                ruleKey: 'rule1',
                parameters: {
                  appKey: SCRIPT_RUNNER_POST_FUNCTION_TYPE,
                  scriptRunner: {
                    transitionId: '',
                  },
                },
              },
            ],
          },
        }
        await filterCloud.onFetch([getElement(workflowVersion)])
        const { transitionId } = getScriptRunnerField({ workflowVersion, transitionKey: 'tran1', postFunctionIndex: 0 })
        expect(transitionId).toEqual('')
      })

      it('should not change anything if script runner is not enabled', async () => {
        await filterOff.onFetch([getElement(workflowVersion)])
        expect(
          getScriptRunnerField({ workflowVersion, transitionKey: 'tran1', postFunctionIndex: 0 }).transitionId,
        ).toEqual('21')
      })
      it('should not change anything if dc', async () => {
        await filter.onFetch([getElement(workflowVersion)])
        expect(
          getScriptRunnerField({ workflowVersion, transitionKey: 'tran1', postFunctionIndex: 0 }).transitionId,
        ).toEqual('21')
      })
      it('should not create a missing reference if enableMissingReference is off', async () => {
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
        await filterCloudWithoutMissingReferences.onFetch([getElement(workflowVersion)])
        expect(
          getScriptRunnerField({ workflowVersion, transitionKey: 'tran1', postFunctionIndex: 0 }).transitionId,
        ).toEqual('21')
      })
    })
    describe('pre deploy', () => {
      it('should store reference and replace correctly', async () => {
        await filter.preDeploy(changes)
        expect(
          getScriptRunnerField({ workflowVersion, transitionKey: TRANSITION_KEY, postFunctionIndex: 0 }).field,
        ).toEqual(1)
        expect(
          getScriptRunnerField({ workflowVersion, transitionKey: TRANSITION_KEY, postFunctionIndex: 0 }).transitionId,
        ).toEqual(11)
      })
      it('should store reference and replace correctly in modification', async () => {
        await filter.preDeploy([
          toChange({ before: instance, after: instance }),
          toChange({ before: workflowV2Instance, after: workflowV2Instance }),
        ])
        expect(
          getScriptRunnerField({ workflowVersion, transitionKey: TRANSITION_KEY, postFunctionIndex: 0 }).field,
        ).toEqual(1)
        expect(
          getScriptRunnerField({ workflowVersion, transitionKey: TRANSITION_KEY, postFunctionIndex: 0 }).transitionId,
        ).toEqual(11)
      })
      it('should not change if script runner not supported', async () => {
        await filterOff.preDeploy(changes)
        expect(
          getScriptRunnerField({ workflowVersion, transitionKey: TRANSITION_KEY, postFunctionIndex: 0 }).field,
        ).toEqual(reference)
        expect(
          getScriptRunnerField({ workflowVersion, transitionKey: TRANSITION_KEY, postFunctionIndex: 0 }).transitionId,
        ).toEqual(getTransitionReference(workflowVersion))
      })
      it('should change if cloud', async () => {
        await filterCloud.preDeploy(changes)
        expect(
          getScriptRunnerField({ workflowVersion, transitionKey: TRANSITION_KEY, postFunctionIndex: 0 }).field,
        ).toEqual(1)
        expect(
          getScriptRunnerField({ workflowVersion, transitionKey: TRANSITION_KEY, postFunctionIndex: 0 }).transitionId,
        ).toEqual(11)
      })
      it('should return the transitionId when it is not a reference', async () => {
        instance.value.transitions[TRANSITION_KEY].rules.postFunctions[0].configuration.scriptRunner.transitionId = '11'
        workflowV2Instance.value.transitions[TRANSITION_KEY].actions[0].parameters.scriptRunner.transitionId = '11'
        await filter.preDeploy([getChange(workflowVersion)])
        expect(
          getScriptRunnerField({ workflowVersion, transitionKey: TRANSITION_KEY, postFunctionIndex: 0 }).transitionId,
        ).toEqual(11)
      })
    })
    describe('on deploy', () => {
      it('should return reference', async () => {
        await filter.onDeploy(changes)
        expect(
          getScriptRunnerField({ workflowVersion, transitionKey: TRANSITION_KEY, postFunctionIndex: 0 }).field,
        ).toEqual(2)
        expect(
          getScriptRunnerField({ workflowVersion, transitionKey: TRANSITION_KEY, postFunctionIndex: 0 }).transitionId,
        ).toEqual(21)
      })
      it('should do nothing if scirptrunner not supported', async () => {
        await filterOff.onDeploy(changes)
        expect(
          getScriptRunnerField({ workflowVersion, transitionKey: TRANSITION_KEY, postFunctionIndex: 0 }).field,
        ).toEqual(reference)
        expect(
          getScriptRunnerField({ workflowVersion, transitionKey: TRANSITION_KEY, postFunctionIndex: 0 }).transitionId,
        ).toEqual(getTransitionReference(workflowVersion))
      })
      it('should return if cloud', async () => {
        await filterCloud.onDeploy(changes)
        expect(
          getScriptRunnerField({ workflowVersion, transitionKey: TRANSITION_KEY, postFunctionIndex: 0 }).field,
        ).toEqual(2)
        expect(
          getScriptRunnerField({ workflowVersion, transitionKey: TRANSITION_KEY, postFunctionIndex: 0 }).transitionId,
        ).toEqual(21)
      })
    })
  })
})
