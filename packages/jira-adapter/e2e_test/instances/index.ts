/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { InstanceElement, Element, ElemID, CORE_ANNOTATIONS, ReferenceExpression } from '@salto-io/adapter-api'
import { naclCase } from '@salto-io/adapter-utils'
import { CUSTOM_FIELDS_SUFFIX } from '../../src/filters/fields/field_name_filter'
import { ISSUE_TYPE_NAME, ISSUE_TYPE_SCHEMA_NAME, JIRA, SECURITY_LEVEL_TYPE, SECURITY_SCHEME_TYPE, WORKFLOW_TYPE_NAME } from '../../src/constants'
import { createReference, findType } from '../utils'
import { createBoardValues } from './board'
import { createContextValues, createFieldValues } from './field'
import { createFieldConfigurationValues } from './fieldConfiguration'
import { createFieldConfigurationSchemeValues } from './fieldConfigurationScheme'
import { createIssueTypeSchemeValues } from './issueTypeScheme'
import { createIssueTypeScreenSchemeValues } from './issueTypeScreenScheme'
import { createScreenValues } from './screen'
import { createWorkflowValues } from './workflow'
import { createWorkflowSchemeValues } from './workflowScheme'
import { createSecurityLevelValues, createSecuritySchemeValues } from './securityScheme'

export const createInstances = (fetchedElements: Element[]): InstanceElement[][] => {
  const randomString = `createdByOssE2e${String(Date.now()).substring(6)}`

  const issueType = new InstanceElement(
    randomString,
    findType(ISSUE_TYPE_NAME, fetchedElements),
    {
      description: randomString,
      name: randomString,
      hierarchyLevel: 0,
    }
  )

  const field = new InstanceElement(
    `${randomString}${CUSTOM_FIELDS_SUFFIX}`,
    findType('Field', fetchedElements),
    createFieldValues(randomString),
  )

  const fieldContext = new InstanceElement(
    naclCase(`${randomString}${CUSTOM_FIELDS_SUFFIX}_${randomString}`),
    findType('CustomFieldContext', fetchedElements),
    createContextValues(randomString, fetchedElements),
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(field.elemID, field)] }
  )

  const workflow = new InstanceElement(
    randomString,
    findType(WORKFLOW_TYPE_NAME, fetchedElements),
    createWorkflowValues(randomString, fetchedElements),
  )

  const screen = new InstanceElement(
    randomString,
    findType('Screen', fetchedElements),
    createScreenValues(randomString, fetchedElements),
  )

  const dashboard = new InstanceElement(
    randomString,
    findType('Dashboard', fetchedElements),
    {
      description: randomString,
      name: randomString,
      sharePermissions: [
        { type: 'authenticated' },
      ],
    },
  )

  const workflowScheme = new InstanceElement(
    randomString,
    findType('WorkflowScheme', fetchedElements),
    createWorkflowSchemeValues(randomString, fetchedElements),
  )

  const screenScheme = new InstanceElement(
    randomString,
    findType('ScreenScheme', fetchedElements),
    {
      name: randomString,
      description: randomString,
      screens: {
        default: createReference(new ElemID(JIRA, 'Screen', 'instance', 'Default_Screen@s'), fetchedElements),
      },
    },
  )

  const issueTypeScreenScheme = new InstanceElement(
    randomString,
    findType('IssueTypeScreenScheme', fetchedElements),
    createIssueTypeScreenSchemeValues(randomString, fetchedElements),
  )

  const fieldConfigurationScheme = new InstanceElement(
    randomString,
    findType('FieldConfigurationScheme', fetchedElements),
    createFieldConfigurationSchemeValues(randomString, fetchedElements),
  )

  const board = new InstanceElement(
    randomString,
    findType('Board', fetchedElements),
    createBoardValues(randomString, fetchedElements),
  )

  const filter = new InstanceElement(
    randomString,
    findType('Filter', fetchedElements),
    {
      name: randomString,
      jql: 'project = TP ORDER BY Rank ASC',
    },
  )

  const issueLinkType = new InstanceElement(
    randomString,
    findType('IssueLinkType', fetchedElements),
    {
      name: randomString,
      inward: randomString,
      outward: randomString,
    },
  )

  const issueTypeScheme = new InstanceElement(
    randomString,
    findType(ISSUE_TYPE_SCHEMA_NAME, fetchedElements),
    createIssueTypeSchemeValues(randomString, fetchedElements),
  )

  const projectRole = new InstanceElement(
    randomString,
    findType('ProjectRole', fetchedElements),
    {
      name: randomString,
      description: randomString,
    },
  )

  const fieldConfiguration = new InstanceElement(
    randomString,
    findType('FieldConfiguration', fetchedElements),
    createFieldConfigurationValues(randomString, fetchedElements),
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

  return [
    [issueType],
    [field],
    [fieldContext],
    [screen],
    [workflow],
    [dashboard],
    [workflowScheme],
    [screenScheme],
    [issueTypeScreenScheme],
    [fieldConfigurationScheme],
    [board],
    [filter],
    [issueLinkType],
    [issueTypeScheme],
    [projectRole],
    [fieldConfiguration],
    [securityScheme, securityLevel],
  ]
}
