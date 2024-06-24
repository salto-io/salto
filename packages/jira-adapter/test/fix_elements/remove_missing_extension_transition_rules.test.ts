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
import { InstanceElement, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { removeMissingExtensionsTransitionRulesHandler } from '../../src/fix_elements/remove_missing_extension_transition_rules'
import { JiraConfig, getDefaultConfig } from '../../src/config/config'
import {
  DEFAULT_CLOUD_ID,
  createConnectTransitionRule,
  createForgeTransitionRule,
  createSkeletonWorkflowV2Instance,
  createSkeletonWorkflowV2Transition,
  createSkeletonWorkflowV2TransitionConditionGroup,
  mockClient,
} from '../utils'
import JiraClient from '../../src/client/client'
import {
  EXTENSION_ID_ARI_PREFIX,
  UPM_INSTALLED_APPS_URL,
  ExtensionType,
  EXTENSION_ID_LENGTH,
} from '../../src/common/extensions'

const CONNECT_EXTENSION: ExtensionType = {
  id: 'some-random-id',
  name: 'connect-extension',
}

const FORGE_EXTENSION: ExtensionType = {
  id: 'a'.repeat(EXTENSION_ID_LENGTH),
  name: 'forge-extension',
}

const NON_EXISTENT_CONNECT_EXTENSION_ID = 'non-existent-extension'
const NON_EXISTENT_CONNECT_EXTENSION_TRANSITION_RULE = createConnectTransitionRule(NON_EXISTENT_CONNECT_EXTENSION_ID)
const NON_EXISTENT_FORGE_EXTENSION_ID = 's'.repeat(EXTENSION_ID_LENGTH)
const NON_EXISTENT_FORGE_EXTENSION_TRANSITION_RULE = createForgeTransitionRule(NON_EXISTENT_FORGE_EXTENSION_ID)
const NON_EXISTENT_EXTENSIONS_TRANSITION_RULES = [
  NON_EXISTENT_CONNECT_EXTENSION_TRANSITION_RULE,
  NON_EXISTENT_FORGE_EXTENSION_TRANSITION_RULE,
]

describe('removeMissingExtensionsTransitionRulesHandler', () => {
  let config: JiraConfig
  let instance: InstanceElement
  let elementsSource: ReadOnlyElementsSource
  let client: JiraClient

  beforeEach(() => {
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.deploy.ignoreMissingExtensions = true
    config.fetch.enableNewWorkflowAPI = true
    const { connection, client: tempClient } = mockClient(false, DEFAULT_CLOUD_ID)
    client = tempClient
    client.gqlPost = async () => ({
      status: 200,
      data: {
        ecosystem: {
          appInstallationsByContext: {
            nodes: [
              {
                app: {
                  name: FORGE_EXTENSION.name,
                  id: EXTENSION_ID_ARI_PREFIX + FORGE_EXTENSION.id,
                },
              },
            ],
          },
        },
      },
    })
    connection.get.mockImplementation(async url => {
      if (url === UPM_INSTALLED_APPS_URL) {
        return {
          status: 200,
          data: {
            plugins: [
              {
                name: CONNECT_EXTENSION.name,
                key: CONNECT_EXTENSION.id,
                enabled: true,
                userInstalled: true,
              },
            ],
          },
        }
      }
      throw new Error(`unexpected url: ${url}`)
    })
    instance = createSkeletonWorkflowV2Instance('some-workflow')
    elementsSource = buildElementsSourceFromElements([instance])
  })
  it('should do nothing if config.deploy.ignoreMissingExtensions is false', async () => {
    config.deploy.ignoreMissingExtensions = false
    instance.value.transitions.transition1 = createSkeletonWorkflowV2Transition('transition1')
    instance.value.transitions.transition1.actions = [...NON_EXISTENT_EXTENSIONS_TRANSITION_RULES]

    const result = await removeMissingExtensionsTransitionRulesHandler({ config, client, elementsSource })([instance])
    expect(result).toEqual({ fixedElements: [], errors: [] })
  })
  it('should do nothing if config.fetch.enableNewWorkflowAPI is false', async () => {
    config.fetch.enableNewWorkflowAPI = false
    instance.value.transitions.transition1 = createSkeletonWorkflowV2Transition('transition1')
    instance.value.transitions.transition1.actions = [...NON_EXISTENT_EXTENSIONS_TRANSITION_RULES]

    const result = await removeMissingExtensionsTransitionRulesHandler({ config, client, elementsSource })([instance])
    expect(result).toEqual({ fixedElements: [], errors: [] })
  })
  it('should fix transitions with action rules of missing extensions', async () => {
    instance.value.transitions.transition1 = createSkeletonWorkflowV2Transition('transition1')
    instance.value.transitions.transition1.actions = [...NON_EXISTENT_EXTENSIONS_TRANSITION_RULES]

    const result = await removeMissingExtensionsTransitionRulesHandler({ config, client, elementsSource })([instance])

    const fixedInstance = instance.clone()
    fixedInstance.value.transitions.transition1.actions = []

    expect(result.fixedElements).toEqual([fixedInstance])
    expect(result.errors).toEqual([
      {
        elemID: instance.elemID.createNestedID('transitions', 'transition1'),
        severity: 'Info' as const,
        message: 'Deploying workflow transition without all of its rules.',
        detailedMessage:
          'This workflow transition contains rules for Jira apps that do not exist in the target environment. It will be deployed without them.',
      },
    ])
  })
  it('should fix transitions with validator rules of missing extensions', async () => {
    instance.value.transitions.transition1 = createSkeletonWorkflowV2Transition('transition1')
    instance.value.transitions.transition1.validators = [...NON_EXISTENT_EXTENSIONS_TRANSITION_RULES]

    const result = await removeMissingExtensionsTransitionRulesHandler({ config, client, elementsSource })([instance])

    const fixedInstance = instance.clone()
    fixedInstance.value.transitions.transition1.validators = []

    expect(result.fixedElements).toEqual([fixedInstance])
    expect(result.errors).toEqual([
      {
        elemID: instance.elemID.createNestedID('transitions', 'transition1'),
        severity: 'Info' as const,
        message: 'Deploying workflow transition without all of its rules.',
        detailedMessage:
          'This workflow transition contains rules for Jira apps that do not exist in the target environment. It will be deployed without them.',
      },
    ])
  })
  it('should fix transitions with condition rules of missing extensions', async () => {
    instance.value.transitions.transition1 = createSkeletonWorkflowV2Transition('transition1')
    instance.value.transitions.transition1.conditions = createSkeletonWorkflowV2TransitionConditionGroup()
    instance.value.transitions.transition1.conditions.conditions = [...NON_EXISTENT_EXTENSIONS_TRANSITION_RULES]

    const result = await removeMissingExtensionsTransitionRulesHandler({ config, client, elementsSource })([instance])
    const fixedInstance = instance.clone()
    fixedInstance.value.transitions.transition1.conditions.conditions = []

    expect(result.fixedElements).toEqual([fixedInstance])
    expect(result.errors).toEqual([
      {
        elemID: instance.elemID.createNestedID('transitions', 'transition1'),
        severity: 'Info' as const,
        message: 'Deploying workflow transition without all of its rules.',
        detailedMessage:
          'This workflow transition contains rules for Jira apps that do not exist in the target environment. It will be deployed without them.',
      },
    ])
  })
  it('should fix transitions with nested condition rules of missing extensions', async () => {
    instance.value.transitions.transition1 = createSkeletonWorkflowV2Transition('transition1')
    instance.value.transitions.transition1.conditions = createSkeletonWorkflowV2TransitionConditionGroup()
    instance.value.transitions.transition1.conditions.conditionGroups.push(
      createSkeletonWorkflowV2TransitionConditionGroup(),
    )
    instance.value.transitions.transition1.conditions.conditionGroups[0].conditions = [
      ...NON_EXISTENT_EXTENSIONS_TRANSITION_RULES,
    ]

    const result = await removeMissingExtensionsTransitionRulesHandler({ config, client, elementsSource })([instance])
    const fixedInstance = instance.clone()
    fixedInstance.value.transitions.transition1.conditions.conditionGroups[0].conditions = []

    expect(result.fixedElements).toEqual([fixedInstance])
    expect(result.errors).toEqual([
      {
        elemID: instance.elemID.createNestedID('transitions', 'transition1'),
        severity: 'Info' as const,
        message: 'Deploying workflow transition without all of its rules.',
        detailedMessage:
          'This workflow transition contains rules for Jira apps that do not exist in the target environment. It will be deployed without them.',
      },
    ])
  })
  it('should not fix transitions without transition rules of missing extensions', async () => {
    const validTransitionRules = [
      createForgeTransitionRule(FORGE_EXTENSION.id),
      createConnectTransitionRule(CONNECT_EXTENSION.id),
    ]
    instance.value.transitions.transition1 = createSkeletonWorkflowV2Transition('transition1')
    instance.value.transitions.transition1.actions = [...validTransitionRules]
    instance.value.transitions.transition1.validators = [...validTransitionRules]
    instance.value.transitions.transition1.conditions = createSkeletonWorkflowV2TransitionConditionGroup()
    instance.value.transitions.transition1.conditions.conditions = [...validTransitionRules]
    instance.value.transitions.transition1.conditions.conditionGroups.push(
      createSkeletonWorkflowV2TransitionConditionGroup(),
    )
    instance.value.transitions.transition1.conditions.conditionGroups[0].conditions = [...validTransitionRules]

    const result = await removeMissingExtensionsTransitionRulesHandler({ config, client, elementsSource })([instance])
    expect(result.fixedElements).toEqual([])
    expect(result.errors).toEqual([])
  })
  it('should only fix transitions rules of missing extensions without affecting valid transition rules.', async () => {
    const validTransitionRules = [
      createForgeTransitionRule(FORGE_EXTENSION.id),
      createConnectTransitionRule(CONNECT_EXTENSION.id),
    ]
    instance.value.transitions.transition1 = createSkeletonWorkflowV2Transition('transition1')
    instance.value.transitions.transition1.actions = [
      ...validTransitionRules,
      ...NON_EXISTENT_EXTENSIONS_TRANSITION_RULES,
    ]
    instance.value.transitions.transition1.validators = [
      ...validTransitionRules,
      ...NON_EXISTENT_EXTENSIONS_TRANSITION_RULES,
    ]
    instance.value.transitions.transition1.conditions = createSkeletonWorkflowV2TransitionConditionGroup()
    instance.value.transitions.transition1.conditions.conditions = [
      ...validTransitionRules,
      ...NON_EXISTENT_EXTENSIONS_TRANSITION_RULES,
    ]
    instance.value.transitions.transition1.conditions.conditionGroups.push(
      createSkeletonWorkflowV2TransitionConditionGroup(),
    )
    instance.value.transitions.transition1.conditions.conditionGroups[0].conditions = [
      ...validTransitionRules,
      ...NON_EXISTENT_EXTENSIONS_TRANSITION_RULES,
    ]

    const fixedInstance = instance.clone()
    fixedInstance.value.transitions.transition1.actions = [...validTransitionRules]
    fixedInstance.value.transitions.transition1.validators = [...validTransitionRules]
    fixedInstance.value.transitions.transition1.conditions.conditions = [...validTransitionRules]
    fixedInstance.value.transitions.transition1.conditions.conditionGroups[0].conditions = [...validTransitionRules]

    const result = await removeMissingExtensionsTransitionRulesHandler({ config, client, elementsSource })([instance])
    expect(result.fixedElements).toEqual([fixedInstance])
    expect(result.errors).toEqual([
      {
        elemID: instance.elemID.createNestedID('transitions', 'transition1'),
        severity: 'Info' as const,
        message: 'Deploying workflow transition without all of its rules.',
        detailedMessage:
          'This workflow transition contains rules for Jira apps that do not exist in the target environment. It will be deployed without them.',
      },
    ])
  })
  it('should fix transitions only once, irrelevant of how many invalid transition rules they have', async () => {
    instance.value.transitions.transition1 = createSkeletonWorkflowV2Transition('transition1')
    instance.value.transitions.transition1.actions = [...NON_EXISTENT_EXTENSIONS_TRANSITION_RULES]
    instance.value.transitions.transition1.validators = [...NON_EXISTENT_EXTENSIONS_TRANSITION_RULES]
    instance.value.transitions.transition1.conditions = createSkeletonWorkflowV2TransitionConditionGroup()
    instance.value.transitions.transition1.conditions.conditions = [...NON_EXISTENT_EXTENSIONS_TRANSITION_RULES]
    instance.value.transitions.transition1.conditions.conditionGroups.push(
      createSkeletonWorkflowV2TransitionConditionGroup(),
    )
    instance.value.transitions.transition1.conditions.conditionGroups[0].conditions = [
      ...NON_EXISTENT_EXTENSIONS_TRANSITION_RULES,
    ]

    const result = await removeMissingExtensionsTransitionRulesHandler({ config, client, elementsSource })([instance])

    const fixedInstance = instance.clone()
    fixedInstance.value.transitions.transition1.actions = []
    fixedInstance.value.transitions.transition1.validators = []
    fixedInstance.value.transitions.transition1.conditions.conditions = []
    fixedInstance.value.transitions.transition1.conditions.conditionGroups[0].conditions = []

    expect(result.fixedElements).toEqual([fixedInstance])
    expect(result.errors).toEqual([
      {
        elemID: instance.elemID.createNestedID('transitions', 'transition1'),
        severity: 'Info' as const,
        message: 'Deploying workflow transition without all of its rules.',
        detailedMessage:
          'This workflow transition contains rules for Jira apps that do not exist in the target environment. It will be deployed without them.',
      },
    ])
  })
  it('should fix workflows only once, irrelevant of how many invalid transition rules they have, but emit an error for each invalid transition', async () => {
    instance.value.transitions.transition1 = createSkeletonWorkflowV2Transition('transition1')
    instance.value.transitions.transition2 = createSkeletonWorkflowV2Transition('transition2')
    instance.value.transitions.transition1.actions = [...NON_EXISTENT_EXTENSIONS_TRANSITION_RULES]
    instance.value.transitions.transition2.validators = [...NON_EXISTENT_EXTENSIONS_TRANSITION_RULES]

    const result = await removeMissingExtensionsTransitionRulesHandler({ config, client, elementsSource })([instance])

    const fixedInstance = instance.clone()
    fixedInstance.value.transitions.transition1.actions = []
    fixedInstance.value.transitions.transition2.validators = []

    expect(result.fixedElements).toEqual([fixedInstance])
    expect(result.errors).toEqual([
      {
        elemID: instance.elemID.createNestedID('transitions', 'transition1'),
        severity: 'Info' as const,
        message: 'Deploying workflow transition without all of its rules.',
        detailedMessage:
          'This workflow transition contains rules for Jira apps that do not exist in the target environment. It will be deployed without them.',
      },
      {
        elemID: instance.elemID.createNestedID('transitions', 'transition2'),
        severity: 'Info' as const,
        message: 'Deploying workflow transition without all of its rules.',
        detailedMessage:
          'This workflow transition contains rules for Jira apps that do not exist in the target environment. It will be deployed without them.',
      },
    ])
  })
})
