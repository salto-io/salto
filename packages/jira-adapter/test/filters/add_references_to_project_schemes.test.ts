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
import { Element, ElemID, InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { instanceCreators, mockTypes } from '../mock_elements'
import { JIRA } from '../../src/constants'
import { getDefaultAdapterConfig, mockClient } from '../utils'
import addReferencesToProjectSchemes, { isProjectInstance } from '../../src/filters/add_references_to_project_schemes'
import 'jest-extended'

describe('addReferencesToProjectSchemes', () => {
  const ISSUE_TYPE_SCREEN_SCHEME_ID = '133'
  const FIELD_CONFIGURATION_SCHEME_ID = '412'

  const WORKFLOW_SCHEME_REF = new ReferenceExpression(new ElemID(JIRA, 'WorkflowScheme'))
  const PERMISSION_SCHEME_REF = new ReferenceExpression(new ElemID(JIRA, 'PermissionScheme'))
  const NOTIFICATION_SCHEME_REF = new ReferenceExpression(new ElemID(JIRA, 'NotificationScheme'))

  let runFilter: (...elements: Element[]) => Promise<Element[]>
  beforeAll(async () => {
    const { client, paginator } = mockClient()
    const filter = addReferencesToProjectSchemes({
      client,
      paginator,
      config: await getDefaultAdapterConfig(),
    }) as filterUtils.FilterWith<'onFetch'>
    runFilter = async (...elements: Element[]): Promise<Element[]> => {
      await filter.onFetch(elements)
      return elements
    }
  })

  let issueTypeScreenSchemeInstance: InstanceElement
  let fieldConfigurationSchemeInstance: InstanceElement
  let projectInstance: InstanceElement
  beforeEach(() => {
    issueTypeScreenSchemeInstance = instanceCreators
      .issueTypeScreenScheme(ISSUE_TYPE_SCREEN_SCHEME_ID)
    fieldConfigurationSchemeInstance = instanceCreators
      .fieldConfigurationScheme(FIELD_CONFIGURATION_SCHEME_ID)
    projectInstance = new InstanceElement(
      'testProject',
      mockTypes.Project,
      {
        workflowScheme: [{ workflowScheme: WORKFLOW_SCHEME_REF }],
        permissionScheme: [PERMISSION_SCHEME_REF],
        notificationScheme: [NOTIFICATION_SCHEME_REF],
        issueTypeScreenScheme:
          [{ issueTypeScreenScheme: { id: ISSUE_TYPE_SCREEN_SCHEME_ID } }],
        fieldConfigurationScheme:
          [{ fieldConfigurationScheme: { id: FIELD_CONFIGURATION_SCHEME_ID }, projectIds: ['100'] }],
      },
    )
    expect(projectInstance).toSatisfy(isProjectInstance)
  })
  describe('when all scheme instances are present', () => {
    it('should set references to the project\'s schemes', async () => {
      await runFilter(
        projectInstance,
        issueTypeScreenSchemeInstance,
        fieldConfigurationSchemeInstance
      )
      expect(projectInstance.value.workflowScheme).toEqual(WORKFLOW_SCHEME_REF)
      expect(projectInstance.value.permissionScheme).toEqual(PERMISSION_SCHEME_REF)
      expect(projectInstance.value.notificationScheme).toEqual(NOTIFICATION_SCHEME_REF)
      expect(projectInstance.value.issueTypeScreenScheme)
        .toEqual(new ReferenceExpression(issueTypeScreenSchemeInstance.elemID))
      expect(projectInstance.value.fieldConfigurationScheme)
        .toEqual(new ReferenceExpression(fieldConfigurationSchemeInstance.elemID))
    })
  })
  describe('when scheme instances are missing', () => {
    it('should extract inner value when IssueTypeScreenScheme is missing', async () => {
      const innerValue = projectInstance.value.issueTypeScreenScheme[0].issueTypeScreenScheme
      await runFilter(
        projectInstance,
        fieldConfigurationSchemeInstance
      )
      expect(projectInstance.value.workflowScheme).toEqual(WORKFLOW_SCHEME_REF)
      expect(projectInstance.value.permissionScheme).toEqual(PERMISSION_SCHEME_REF)
      expect(projectInstance.value.notificationScheme).toEqual(NOTIFICATION_SCHEME_REF)
      expect(projectInstance.value.issueTypeScreenScheme).toEqual(innerValue)
      expect(projectInstance.value.fieldConfigurationScheme)
        .toEqual(new ReferenceExpression(fieldConfigurationSchemeInstance.elemID))
    })

    it('should extract inner value when FieldConfigurationScheme is missing', async () => {
      const innerValue = projectInstance.value.fieldConfigurationScheme[0].fieldConfigurationScheme
      await runFilter(
        projectInstance,
        issueTypeScreenSchemeInstance
      )
      expect(projectInstance.value.workflowScheme).toEqual(WORKFLOW_SCHEME_REF)
      expect(projectInstance.value.permissionScheme).toEqual(PERMISSION_SCHEME_REF)
      expect(projectInstance.value.notificationScheme).toEqual(NOTIFICATION_SCHEME_REF)
      expect(projectInstance.value.issueTypeScreenScheme)
        .toEqual(new ReferenceExpression(issueTypeScreenSchemeInstance.elemID))
      expect(projectInstance.value.fieldConfigurationScheme).toEqual(innerValue)
    })
  })

  it('should set Project.fieldConfigurationScheme to "default" when the project uses the default FieldConfigurationScheme', async () => {
    delete projectInstance.value.fieldConfigurationScheme[0].fieldConfigurationScheme
    await runFilter(
      projectInstance,
      issueTypeScreenSchemeInstance,
      fieldConfigurationSchemeInstance
    )
    expect(projectInstance.value.workflowScheme).toEqual(WORKFLOW_SCHEME_REF)
    expect(projectInstance.value.permissionScheme).toEqual(PERMISSION_SCHEME_REF)
    expect(projectInstance.value.notificationScheme).toEqual(NOTIFICATION_SCHEME_REF)
    expect(projectInstance.value.issueTypeScreenScheme)
      .toEqual(new ReferenceExpression(issueTypeScreenSchemeInstance.elemID))
    expect(projectInstance.value.fieldConfigurationScheme).toEqual('default')
  })
})
