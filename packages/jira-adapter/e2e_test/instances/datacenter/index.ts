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
import { InstanceElement, Element, ModificationChange } from '@salto-io/adapter-api'
import { AUTOMATION_TYPE, ISSUE_TYPE_NAME, PRIORITY_SCHEME_TYPE_NAME, WORKFLOW_TYPE_NAME } from '../../../src/constants'
import { findType } from '../../utils'
import { createAutomationValues } from './automation'
import { createKanbanBoardValues, createScrumBoardValues } from './board'
import { createFieldConfigurationValues } from './fieldConfiguration'
import { createFilterValues } from './filter'
import { createPrioritySchemeValues } from './priorityScheme'
import { createWorkflowValues } from './workflow'

export const createInstances = (randomString: string, fetchedElements: Element[]): InstanceElement[][] => {
  const fieldConfiguration = new InstanceElement(
    randomString,
    findType('FieldConfiguration', fetchedElements),
    createFieldConfigurationValues(randomString),
  )
  const issueType = new InstanceElement(`IT_${randomString}`, findType(ISSUE_TYPE_NAME, fetchedElements), {
    description: randomString,
    name: `IT_${randomString}`,
    hierarchyLevel: 0,
  })

  const automation = new InstanceElement(
    randomString,
    findType(AUTOMATION_TYPE, fetchedElements),
    createAutomationValues(randomString),
  )

  const workflow = new InstanceElement(
    randomString,
    findType(WORKFLOW_TYPE_NAME, fetchedElements),
    createWorkflowValues(randomString, fetchedElements),
  )

  const kanbanBoard = new InstanceElement(
    `kanban${randomString}`,
    findType('Board', fetchedElements),
    createKanbanBoardValues(randomString, fetchedElements),
  )

  const scrumBoard = new InstanceElement(
    `scrum${randomString}`,
    findType('Board', fetchedElements),
    createScrumBoardValues(randomString, fetchedElements),
  )

  const filter = new InstanceElement(
    randomString,
    findType('Filter', fetchedElements),
    createFilterValues(randomString, fetchedElements),
  )

  const priorityScheme = new InstanceElement(
    randomString,
    findType(PRIORITY_SCHEME_TYPE_NAME, fetchedElements),
    createPrioritySchemeValues(randomString, fetchedElements),
  )

  return [
    [fieldConfiguration],
    [automation],
    [workflow],
    [kanbanBoard],
    [issueType],
    [scrumBoard],
    [filter],
    [priorityScheme],
  ]
}

export const modifyDataCenterInstances = (_fetchedElements: Element[]): ModificationChange<InstanceElement>[][] => []
