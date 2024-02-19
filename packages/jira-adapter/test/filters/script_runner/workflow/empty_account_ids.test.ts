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
import { createEmptyType, getFilterParams, mockClient } from '../../../utils'
import {
  SCRIPT_RUNNER_POST_FUNCTION_TYPE,
  SCRIPT_RUNNER_SEND_NOTIFICATIONS,
} from '../../../../src/filters/script_runner/workflow/workflow_cloud'
import emptyAccountIds from '../../../../src/filters/script_runner/workflow/empty_account_ids'
import { WORKFLOW_TYPE_NAME } from '../../../../src/constants'
import { getDefaultConfig } from '../../../../src/config/config'

describe('ScriptRunner cloud empty account id', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let filterOff: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let filterDC: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let instance: InstanceElement
  let wrongStructureInstance: InstanceElement

  const workflowType = createEmptyType(WORKFLOW_TYPE_NAME)
  beforeEach(() => {
    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    const configOff = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.enableScriptRunnerAddon = true
    const { client } = mockClient(true)
    filter = emptyAccountIds(getFilterParams({ config })) as filterUtils.FilterWith<
      'onFetch' | 'preDeploy' | 'onDeploy'
    >
    filterOff = emptyAccountIds(getFilterParams({ config: configOff })) as filterUtils.FilterWith<
      'onFetch' | 'preDeploy' | 'onDeploy'
    >
    filterDC = emptyAccountIds(getFilterParams({ client })) as filterUtils.FilterWith<
      'onFetch' | 'preDeploy' | 'onDeploy'
    >
  })
  describe('fetch', () => {
    beforeEach(() => {
      instance = new InstanceElement('instance', workflowType, {
        transitions: {
          tran1: {
            name: 'tran1',
            rules: {
              postFunctions: [
                {
                  type: SCRIPT_RUNNER_POST_FUNCTION_TYPE,
                  configuration: {
                    scriptRunner: {
                      className: SCRIPT_RUNNER_SEND_NOTIFICATIONS,
                      accountIds: [''],
                    },
                  },
                },
                {
                  type: SCRIPT_RUNNER_POST_FUNCTION_TYPE,
                  configuration: {
                    scriptRunner: {
                      className: SCRIPT_RUNNER_SEND_NOTIFICATIONS,
                      accountIds: ['1'],
                    },
                  },
                },
                {
                  type: SCRIPT_RUNNER_POST_FUNCTION_TYPE,
                  configuration: {
                    scriptRunner: {
                      className: SCRIPT_RUNNER_SEND_NOTIFICATIONS,
                      accountIds: [''],
                    },
                  },
                },
              ],
            },
          },
          tran2: {
            name: 'tran2',
            rules: {
              postFunctions: [
                {
                  type: SCRIPT_RUNNER_POST_FUNCTION_TYPE,
                  configuration: {
                    scriptRunner: {
                      className: SCRIPT_RUNNER_SEND_NOTIFICATIONS,
                      accountIds: [''],
                    },
                  },
                },
                {
                  type: SCRIPT_RUNNER_POST_FUNCTION_TYPE,
                  configuration: {
                    scriptRunner: {
                      className: SCRIPT_RUNNER_SEND_NOTIFICATIONS,
                      accountIds: ['1', '2'],
                    },
                  },
                },
              ],
            },
          },
        },
      })
      wrongStructureInstance = new InstanceElement('instance', workflowType, {
        transitions: {
          tran1: {
            name: 'tran1',
            postFunctions: [
              {
                type: SCRIPT_RUNNER_POST_FUNCTION_TYPE,
                configuration: {
                  scriptRunner: {
                    className: SCRIPT_RUNNER_SEND_NOTIFICATIONS,
                    accountIds: [''],
                  },
                },
              },
            ],
          },
          tran2: {
            name: 'tran2',
            rules: {
              postFunctions: [
                {
                  type: SCRIPT_RUNNER_POST_FUNCTION_TYPE,
                  scriptRunner: {
                    className: SCRIPT_RUNNER_SEND_NOTIFICATIONS,
                    accountIds: [''],
                  },
                },
              ],
            },
          },
        },
      })
    })
    it('should remove empty account ids', async () => {
      await filter.onFetch([instance])
      expect(
        instance.value.transitions.tran1.rules.postFunctions[0].configuration.scriptRunner.accountIds,
      ).toBeUndefined()
      expect(
        instance.value.transitions.tran1.rules.postFunctions[2].configuration.scriptRunner.accountIds,
      ).toBeUndefined()
      expect(
        instance.value.transitions.tran2.rules.postFunctions[0].configuration.scriptRunner.accountIds,
      ).toBeUndefined()
    })
    it('should not remove account ids that are not empty', async () => {
      await filter.onFetch([instance])
      expect(instance.value.transitions.tran1.rules.postFunctions[1].configuration.scriptRunner.accountIds).toEqual([
        '1',
      ])
      expect(instance.value.transitions.tran2.rules.postFunctions[1].configuration.scriptRunner.accountIds).toEqual([
        '1',
        '2',
      ])
    })
    it('should not remove account ids when scriptRunner is not enabled', async () => {
      await filterOff.onFetch([instance])
      expect(instance.value.transitions.tran1.rules.postFunctions[0].configuration.scriptRunner.accountIds).toEqual([
        '',
      ])
    })
    it('should not remove account ids when on dc', async () => {
      await filterDC.onFetch([instance])
      expect(instance.value.transitions.tran1.rules.postFunctions[0].configuration.scriptRunner.accountIds).toEqual([
        '',
      ])
    })
    it('should not remove account ids when the structure is wrong', async () => {
      await filter.onFetch([wrongStructureInstance])
      expect(
        wrongStructureInstance.value.transitions.tran1.postFunctions[0].configuration.scriptRunner.accountIds,
      ).toEqual([''])
      expect(wrongStructureInstance.value.transitions.tran2.rules.postFunctions[0].scriptRunner.accountIds).toEqual([
        '',
      ])
    })
  })
  describe('pre deploy', () => {
    beforeEach(() => {
      instance = new InstanceElement('instance', workflowType, {
        transitions: {
          tran1: {
            name: 'tran1',
            rules: {
              postFunctions: [
                {
                  type: SCRIPT_RUNNER_POST_FUNCTION_TYPE,
                  configuration: {
                    scriptRunner: {
                      className: SCRIPT_RUNNER_SEND_NOTIFICATIONS,
                    },
                  },
                },
                {
                  type: SCRIPT_RUNNER_POST_FUNCTION_TYPE,
                  configuration: {
                    scriptRunner: {
                      className: SCRIPT_RUNNER_SEND_NOTIFICATIONS,
                      accountIds: ['1'],
                    },
                  },
                },
              ],
            },
          },
        },
      })
    })
    it('should return the accountIds empty field', async () => {
      await filter.preDeploy([toChange({ after: instance })])
      expect(instance.value.transitions.tran1.rules.postFunctions[0].configuration.scriptRunner.accountIds).toEqual([
        '',
      ])
    })
    it('should not change accountIds that are not empty', async () => {
      await filter.preDeploy([toChange({ after: instance })])
      expect(instance.value.transitions.tran1.rules.postFunctions[1].configuration.scriptRunner.accountIds).toEqual([
        '1',
      ])
    })
    it('should not return account ids when the structure is wrong', async () => {
      wrongStructureInstance.value.transitions.tran1.postFunctions[0].configuration.scriptRunner.accountIds = undefined
      wrongStructureInstance.value.transitions.tran2.rules.postFunctions[0].scriptRunner.accountIds = undefined
      await filter.preDeploy([toChange({ after: wrongStructureInstance })])
      expect(
        wrongStructureInstance.value.transitions.tran1.postFunctions[0].configuration.scriptRunner.accountIds,
      ).toBeUndefined()
      expect(
        wrongStructureInstance.value.transitions.tran2.rules.postFunctions[0].scriptRunner.accountIds,
      ).toBeUndefined()
    })
  })
  describe('on deploy', () => {
    it('should remove empty accountIds', async () => {
      await filter.onDeploy([toChange({ after: instance })])
      expect(
        instance.value.transitions.tran1.rules.postFunctions[0].configuration.scriptRunner.accountIds,
      ).toBeUndefined()
    })
  })
})
