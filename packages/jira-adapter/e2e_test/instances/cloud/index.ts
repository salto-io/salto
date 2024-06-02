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
import {
  InstanceElement,
  Element,
  CORE_ANNOTATIONS,
  ReferenceExpression,
  ModificationChange,
  ElemID,
  isInstanceElement,
  toChange,
  StaticFile,
} from '@salto-io/adapter-api'
import { naclCase } from '@salto-io/adapter-utils'
import * as fs from 'fs'
import * as path from 'path'
import {
  AUTOMATION_TYPE,
  CALENDAR_TYPE,
  ESCALATION_SERVICE_TYPE,
  FORM_TYPE,
  ISSUE_LAYOUT_TYPE,
  ISSUE_TYPE_NAME,
  ISSUE_TYPE_SCHEMA_NAME,
  JIRA,
  NOTIFICATION_SCHEME_TYPE_NAME,
  OBJECT_SCHEMA_GLOBAL_STATUS_TYPE,
  OBJECT_SCHEMA_STATUS_TYPE,
  OBJECT_SCHEMA_TYPE,
  OBJECT_TYPE_ATTRIBUTE_TYPE,
  OBJECT_TYPE_TYPE,
  PORTAL_GROUP_TYPE,
  PORTAL_SETTINGS_TYPE_NAME,
  QUEUE_TYPE,
  SCHEDULED_JOB_TYPE,
  SCRIPTED_FIELD_TYPE,
  SCRIPT_FRAGMENT_TYPE,
  SCRIPT_RUNNER_LISTENER_TYPE,
  SECURITY_LEVEL_TYPE,
  SECURITY_SCHEME_TYPE,
  SLA_TYPE_NAME,
  WORKFLOW_TYPE_NAME,
} from '../../../src/constants'
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
import { createFormValues } from './jsm/form'
import { createObjectSchmaValues } from './jsm/objectSchema'
import { createObjectSchemaStatusValues } from './jsm/objectSchemaStatus'
import { createObjectSchemaGlobalStatusValues } from './jsm/objectSchemaGlobalStatus'
import { createObjectTypeValues } from './jsm/objectType'
import { createObjectTypeAttributeValues } from './jsm/objectTypeAttribute'

const ISSUE_LAYOUT_NAME = 'Test_Project_TP__Kanban_Default_Issue_Screen@sufssss'

export const createInstances = (
  randomString: string,
  uuid: string,
  fetchedElements: Element[],
): InstanceElement[][] => {
  const dashboard = new InstanceElement(
    randomString,
    findType('Dashboard', fetchedElements),
    createDashboardValues(randomString),
  )
  const issueType = new InstanceElement(`IT_${randomString}`, findType(ISSUE_TYPE_NAME, fetchedElements), {
    description: randomString,
    name: `IT_${randomString}`,
    hierarchyLevel: 0,
    untranslatedName: `IT_${randomString}`,
    avatar: new StaticFile({
      filepath: `${JIRA}/${ISSUE_TYPE_NAME}/${randomString}.png`,
      content: fs.readFileSync(path.resolve(`${__dirname}/../../../e2e_test/images/nacl.png`)),
    }),
  })

  const dashboardGadget1 = new InstanceElement(
    naclCase(`${randomString}__${randomString}-1_2_0`),
    findType('DashboardGadget', fetchedElements),
    createGadget1Values(randomString),
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(dashboard.elemID, dashboard)] },
  )

  const dashboardGadget2 = new InstanceElement(
    naclCase(`${randomString}__${randomString}-2_2_1`),
    findType('DashboardGadget', fetchedElements),
    createGadget2Values(randomString),
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(dashboard.elemID, dashboard)] },
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

  securityLevel.annotations[CORE_ANNOTATIONS.PARENT] = [new ReferenceExpression(securityScheme.elemID, securityScheme)]

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

  // const behavior = new InstanceElement(
  //   randomString,
  //   findType('Behavior', fetchedElements),
  //   createBehaviorValues(randomString, fetchedElements),
  // )
  const scriptedField = new InstanceElement(
    randomString,
    findType(SCRIPTED_FIELD_TYPE, fetchedElements),
    createScriptedFieldValues(randomString),
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
    { [CORE_ANNOTATIONS.PARENT]: [jsmProject] },
  )

  const portalGroup = new InstanceElement(
    `PG_${randomString}_SUP`,
    findType(PORTAL_GROUP_TYPE, fetchedElements),
    createPortalGroupValues(`PG_${randomString}`, fetchedElements),
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [jsmProject] },
  )

  const queue = new InstanceElement(
    `Queue_${randomString}_SUP`,
    findType(QUEUE_TYPE, fetchedElements),
    createQueueValues(`Queue_${randomString}`, fetchedElements),
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [jsmProject] },
  )

  const calendar = new InstanceElement(
    `CAL_${randomString}_SUP`,
    findType(CALENDAR_TYPE, fetchedElements),
    createCalendarValues(`CAL_${randomString}`),
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [jsmProject] },
  )
  const SLA = new InstanceElement(
    `SLA_${randomString}_SUP`,
    findType(SLA_TYPE_NAME, fetchedElements),
    createSLAValues(`SLA_${randomString}`, fetchedElements),
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [jsmProject] },
  )

  const requestType = new InstanceElement(
    `RT_${randomString}_SUP`,
    findType('RequestType', fetchedElements),
    createrequestTypeValues(`RT_${randomString}`, fetchedElements),
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [jsmProject] },
  )
  const form = new InstanceElement(
    `SUP_${randomString}`,
    findType(FORM_TYPE, fetchedElements),
    createFormValues(randomString),
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [jsmProject] },
  )

  const objectSchemaRef = createReference(new ElemID(JIRA, 'ObjectSchema', 'instance', 'testSchema'), fetchedElements)

  const objectSchema = new InstanceElement(
    `OS_${randomString}`,
    findType(OBJECT_SCHEMA_TYPE, fetchedElements),
    createObjectSchmaValues(`OS_${randomString}`),
    undefined,
  )

  const objectSchemaStatus = new InstanceElement(
    `testSchema__${randomString}`,
    findType(OBJECT_SCHEMA_STATUS_TYPE, fetchedElements),
    createObjectSchemaStatusValues(randomString),
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [objectSchemaRef] },
  )
  const objectSchemaGlobalStatus = new InstanceElement(
    `OSGS${randomString}`,
    findType(OBJECT_SCHEMA_GLOBAL_STATUS_TYPE, fetchedElements),
    createObjectSchemaGlobalStatusValues(`OSGS${randomString}`),
  )

  const objectType = new InstanceElement(
    `testSchema_Hardware_Assets_us_${randomString}@uumu`,
    findType(OBJECT_TYPE_TYPE, fetchedElements),
    createObjectTypeValues(randomString, fetchedElements),
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [objectSchemaRef] },
  )

  const objectTypeAttribute = new InstanceElement(
    `testSchema_Hardware_Assets_us_${randomString}@uumu`,
    findType(OBJECT_TYPE_ATTRIBUTE_TYPE, fetchedElements),
    createObjectTypeAttributeValues(randomString, fetchedElements),
    undefined,
  )

  return [
    [issueType],
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
    [requestType],
    [form],
    [objectSchema],
    [objectSchemaStatus],
    [objectSchemaGlobalStatus],
    [objectType],
    [objectTypeAttribute],
  ]
}

export const modifyCloudInstances = (fetchedElements: Element[]): ModificationChange<InstanceElement>[][] => {
  // The issueLayout name is automatically generated by the service for each project and screen.
  const issueLayoutBefore = fetchedElements
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === ISSUE_LAYOUT_TYPE)
    .find(instance => instance.elemID.name === ISSUE_LAYOUT_NAME)
  if (issueLayoutBefore === undefined) {
    throw new Error(`The issueLayout ${ISSUE_LAYOUT_NAME} was not found and should be in the target environment`)
  }
  const issueLayoutAfter = new InstanceElement(
    ISSUE_LAYOUT_NAME,
    findType('IssueLayout', fetchedElements),
    createIssueLayoutValues(fetchedElements),
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [
        createReference(new ElemID(JIRA, 'Project', 'instance', 'Test_Project@s'), fetchedElements),
      ],
    },
  )
  return [
    [createScriptRunnerSettingsInstances(fetchedElements)],
    [toChange({ before: issueLayoutBefore, after: issueLayoutAfter }) as ModificationChange<InstanceElement>],
  ]
}
