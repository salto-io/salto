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
import { InstanceElement, Element, CORE_ANNOTATIONS, ReferenceExpression, ModificationChange, ElemID } from '@salto-io/adapter-api'
import { naclCase } from '@salto-io/adapter-utils'
import { AUTOMATION_TYPE, CALENDAR_TYPE, ESCALATION_SERVICE_TYPE, ISSUE_TYPE_SCHEMA_NAME, JIRA,
  NOTIFICATION_SCHEME_TYPE_NAME, PORTAL_GROUP_TYPE, PORTAL_SETTINGS_TYPE_NAME, QUEUE_TYPE,
  SCHEDULED_JOB_TYPE, SCRIPTED_FIELD_TYPE, SCRIPT_FRAGMENT_TYPE, SCRIPT_RUNNER_LISTENER_TYPE,
  SECURITY_LEVEL_TYPE, SECURITY_SCHEME_TYPE, SLA_TYPE_NAME, WORKFLOW_TYPE_NAME } from '../../../src/constants'
import { createSecurityLevelValues, createSecuritySchemeValues } from './securityScheme'
import { createIssueTypeSchemeValues } from './issueTypeScheme'
import { createDashboardValues, createGadget1Values, createGadget2Values } from './dashboard'
import { createReference, findType } from '../../utils'
import { createWorkflowValues } from './workflow'
import { createFieldConfigurationValues } from './fieldConfiguration'
import { createNotificationSchemeValues } from './notificationScheme'
import { createAutomationValues } from './automation'
import { createKanbanBoardValues, createScrumBoardValues } from './board'
import { createFilterValues } from './filter'
import { createIssueLayoutValues } from './issueLayout'
// import { createBehaviorValues } from './scriptrunner/beahvior'
import { createScriptedFieldValues } from './scriptrunner/scripted_fields'
import { createScriptRunnerListenerValues } from './scriptrunner/listener'
import { createScheduledJobsValues } from './scriptrunner/scheduled_jobs'
import { createEscalationServiceValues } from './scriptrunner/escalation_service'
import { createScriptedFragmentsValues } from './scriptrunner/scripted_fragments'
import { createScriptRunnerSettingsInstances } from './scriptrunner/settings'
import { createPortalSettingsValues } from './jsm/portal_settings'
import { createPortalGroupValues } from './jsm/portal_groups'
import { createQueueValues } from './jsm/queue'
import { createCalendarValues } from './jsm/calendar'
import { createSLAValues } from './jsm/SLA'
import { createrequestTypeValues } from './jsm/request_type'

export const createInstances = (
  randomString: string,
  uuid: string,
  fetchedElements: Element[]
): InstanceElement[][] => {
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
  // The issueLayout name is automatically generated by the service for each project and screen.
  const issueLayout = new InstanceElement(
    'Test_Project_TP__Kanban_Default_Issue_Screen@sufssss',
    findType('IssueLayout', fetchedElements),
    createIssueLayoutValues(fetchedElements),
  )
  // const behavior = new InstanceElement(
  //   randomString,
  //   findType('Behavior', fetchedElements),
  //   createBehaviorValues(randomString, fetchedElements),
  // )
  const scriptedField = new InstanceElement(
    randomString,
    findType(SCRIPTED_FIELD_TYPE, fetchedElements),
    createScriptedFieldValues(randomString, fetchedElements),
  )
  const scriptRunnerListeners = new InstanceElement(
    randomString,
    findType(SCRIPT_RUNNER_LISTENER_TYPE, fetchedElements),
    createScriptRunnerListenerValues(randomString, fetchedElements),
  )

  const scheduledJobs = new InstanceElement(
    randomString,
    findType(SCHEDULED_JOB_TYPE, fetchedElements),
    createScheduledJobsValues(randomString),
  )

  const escalationService = new InstanceElement(
    randomString,
    findType(ESCALATION_SERVICE_TYPE, fetchedElements),
    createEscalationServiceValues(randomString, fetchedElements),
  )

  const scriptedFragments = new InstanceElement(
    naclCase(uuid),
    findType(SCRIPT_FRAGMENT_TYPE, fetchedElements),
    createScriptedFragmentsValues(uuid, fetchedElements),
  )

  const jsmProject = createReference(new ElemID(JIRA, 'Project', 'instance', 'Support'), fetchedElements)

  const portalSettings = new InstanceElement(
    'Support',
    findType(PORTAL_SETTINGS_TYPE_NAME, fetchedElements),
    createPortalSettingsValues('Support'),
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [jsmProject] }
  )

  const portalGroup = new InstanceElement(
    `${randomString}_SUP`,
    findType(PORTAL_GROUP_TYPE, fetchedElements),
    createPortalGroupValues(randomString, fetchedElements),
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [jsmProject] }
  )

  const queue = new InstanceElement(
    `${randomString}_SUP`,
    findType(QUEUE_TYPE, fetchedElements),
    createQueueValues(randomString, fetchedElements),
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [jsmProject] }
  )

  const calendar = new InstanceElement(
    `${randomString}_SUP`,
    findType(CALENDAR_TYPE, fetchedElements),
    createCalendarValues(randomString),
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [jsmProject] }
  )
  const SLA = new InstanceElement(
    `${randomString}_SUP`,
    findType(SLA_TYPE_NAME, fetchedElements),
    createSLAValues(randomString, fetchedElements),
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [jsmProject] }
  )

  const RequestType = new InstanceElement(
    `${randomString}_SUP`,
    findType('RequestType', fetchedElements),
    createrequestTypeValues(randomString, fetchedElements),
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [jsmProject] }
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
    [kanbanBoard],
    [scrumBoard],
    [filter],
    [issueLayout],
    // [behavior],
    [scriptedField],
    [scriptRunnerListeners],
    [scheduledJobs],
    [escalationService],
    [scriptedFragments],
    [portalSettings],
    [portalGroup],
    [queue],
    [calendar],
    [SLA],
    [RequestType],
  ]
}

export const modifyCloudInstances = (fetchedElements: Element[]): ModificationChange<InstanceElement>[][] => [
  [createScriptRunnerSettingsInstances(fetchedElements)],
]
