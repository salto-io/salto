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
import _ from 'lodash'
import { toChange, InstanceElement } from '@salto-io/adapter-api'
import { missingExtensionsTransitionRulesChangeValidator } from '../../../src/change_validators/workflowsV2/missing_extensions_transition_rules'
import {
  DEFAULT_CLOUD_ID,
  createSkeletonWorkflowV2Instance,
  createSkeletonWorkflowV2TransitionConditionGroup,
  mockClient,
} from '../../utils'
import JiraClient, { ExtensionType, EXTENSION_ID_ARI_PREFIX, EXTENSION_ID_LENGTH } from '../../../src/client/client'
import { WorkflowV2TransitionRule } from '../../../src/filters/workflowV2/types'

const createConnectTransitionRule = (extensionId: string): WorkflowV2TransitionRule => ({
  ruleKey: `connect:some-rule`,
  parameters: { appKey: `${extensionId}` },
})

const createForgeTransitionRule = (extensionId: string): WorkflowV2TransitionRule => ({
  ruleKey: `forge:some-rule`,
  parameters: { key: `${EXTENSION_ID_ARI_PREFIX}${extensionId}/some-suffix` },
})

const createSystemTransitionRule = (): WorkflowV2TransitionRule => ({ ruleKey: 'system:some-rule' })

const CONNECT_EXTENSION: ExtensionType = {
  id: 'some-random-id',
  name: 'connect-extension',
}

const FORGE_EXTENSION: ExtensionType = {
  id: 'a'.repeat(EXTENSION_ID_LENGTH),
  name: 'forge-extension',
}
const CLIENT: JiraClient = mockClient(false, DEFAULT_CLOUD_ID).client
CLIENT.getInstalledExtensions = async () => [CONNECT_EXTENSION, FORGE_EXTENSION]

const NON_EXISTENT_CONNECT_EXTENSION_ID = 'non-existent-extension'
const NON_EXISTENT_CONNECT_EXTENSION_TRANSITION_RULE = createConnectTransitionRule(NON_EXISTENT_CONNECT_EXTENSION_ID)
const NON_EXISTENT_FORGE_EXTENSION_ID = 's'.repeat(EXTENSION_ID_LENGTH)
const NON_EXISTENT_FORGE_EXTENSION_TRANSITION_RULE = createForgeTransitionRule(NON_EXISTENT_FORGE_EXTENSION_ID)
const NON_EXISTENT_EXTENSIONS_TRANSITION_RULES = [
  NON_EXISTENT_CONNECT_EXTENSION_TRANSITION_RULE,
  NON_EXISTENT_FORGE_EXTENSION_TRANSITION_RULE,
]

describe('missingAppsTransitionRulesReferencedWorkflowDeletionChangeValidator', () => {
  let workflowInstance: InstanceElement

  beforeEach(() => {
    workflowInstance = createSkeletonWorkflowV2Instance('workflowInstance')
  })

  it('Should raise Error SeverityLevel when a transition rule is from a missing extension', async () => {
    const transitionRules = [
      createSystemTransitionRule(),
      createConnectTransitionRule(CONNECT_EXTENSION.id),
      createForgeTransitionRule(FORGE_EXTENSION.id),
      ...NON_EXISTENT_EXTENSIONS_TRANSITION_RULES,
    ] // 2 transitions rules of missing extensions, 2 of existing extensions and one transition rule of type 'system'

    const afterInstance = workflowInstance.clone()
    afterInstance.value.transitions.transition1.validators.push(...transitionRules)
    afterInstance.value.transitions.transition1.actions.push(...transitionRules)
    afterInstance.value.transitions.transition1.conditions.conditions.push(...transitionRules)
    afterInstance.value.transitions.transition1.conditions.conditionGroups.push(
      createSkeletonWorkflowV2TransitionConditionGroup(),
    )
    afterInstance.value.transitions.transition1.conditions.conditionGroups[0].conditions.push(...transitionRules)

    const result = await missingExtensionsTransitionRulesChangeValidator(CLIENT)([
      toChange({ before: workflowInstance, after: afterInstance }),
    ])
    expect(result).toBeArrayOfSize(8) // We added 2 missing extension transition rules every time we pushed transitionRules (4 times)
  })
})
