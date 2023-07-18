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
import { InstanceElement, Element, CORE_ANNOTATIONS, ReferenceExpression } from '@salto-io/adapter-api'
import { naclCase } from '@salto-io/adapter-utils'
import { AUTOMATION_TYPE, ISSUE_TYPE_SCHEMA_NAME, NOTIFICATION_SCHEME_TYPE_NAME, SECURITY_LEVEL_TYPE, SECURITY_SCHEME_TYPE, WORKFLOW_TYPE_NAME } from '../../../src/constants'
import { createSecurityLevelValues, createSecuritySchemeValues } from './securityScheme'
import { createIssueTypeSchemeValues } from './issueTypeScheme'
import { createDashboardValues, createGadget1Values, createGadget2Values } from './dashboard'
import { findType } from '../../utils'
import { createWorkflowValues } from './workflow'
import { createFieldConfigurationValues } from './fieldConfiguration'
import { createNotificationSchemeValues } from './notificationScheme'
import { createAutomationValues } from './automation'
import { createKanbanBoardValues, createScrumBoardValues } from './board'
import { createFilterValues } from './filter'

export const createInstances = (randomString: string, fetchedElements: Element[]): InstanceElement[][] => {
  const dashboard = new InstanceElement(
    randomString,
    findType('Dashboard', fetchedElements),
    createDashboardValues(randomString),
  )

  const dashboardGadget1 = new InstanceElement(
    naclCase(`${randomString}__${randomString}-1_2_0`),
    findType('DashboardGadget', fetchedElements),
    createGadget1Values(randomString),
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(dashboard.elemID, dashboard)] }
  )

  const dashboardGadget2 = new InstanceElement(
    naclCase(`${randomString}__${randomString}-2_2_1`),
    findType('DashboardGadget', fetchedElements),
    createGadget2Values(randomString),
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(dashboard.elemID, dashboard)] }
  )

  const issueTypeScheme = new InstanceElement(
    randomString,
    findType(ISSUE_TYPE_SCHEMA_NAME, fetchedElements),
    createIssueTypeSchemeValues(randomString, fetchedElements),
  )

  const workflow = new InstanceElement(
    randomString,
    findType(WORKFLOW_TYPE_NAME, fetchedElements),
    createWorkflowValues(randomString, fetchedElements),
  )


  const fieldConfiguration = new InstanceElement(
    randomString,
    findType('FieldConfiguration', fetchedElements),
    createFieldConfigurationValues(randomString),
  )

  const securityLevel = new InstanceElement(
    naclCase(`${randomString}__${randomString}`),
    findType(SECURITY_LEVEL_TYPE, fetchedElements),
    createSecurityLevelValues(randomString, fetchedElements),
  )

  const securityScheme = new InstanceElement(
    randomString,
    findType(SECURITY_SCHEME_TYPE, fetchedElements),
    createSecuritySchemeValues(randomString, securityLevel),
  )

  securityLevel.annotations[CORE_ANNOTATIONS.PARENT] = [
    new ReferenceExpression(securityScheme.elemID, securityScheme),
  ]


  const notificationScheme = new InstanceElement(
    randomString,
    findType(NOTIFICATION_SCHEME_TYPE_NAME, fetchedElements),
    createNotificationSchemeValues(randomString),
  )

  const automation = new InstanceElement(
    randomString,
    findType(AUTOMATION_TYPE, fetchedElements),
    createAutomationValues(randomString, fetchedElements),
  )

  // const kanbanBoard = new InstanceElement(
  //   `kanban${randomString}`,
  //   findType('Board', fetchedElements),
  //   createKanbanBoardValues(randomString, fetchedElements),
  // )

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

  return [
    [dashboard],
    [dashboardGadget1],
    [dashboardGadget2],
    [issueTypeScheme],
    [workflow],
    [fieldConfiguration],
    [securityScheme, securityLevel],
    [notificationScheme],
    [automation],
    // [kanbanBoard],
    [scrumBoard],
    [filter],
  ]
}
