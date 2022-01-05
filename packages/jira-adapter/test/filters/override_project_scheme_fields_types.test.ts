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
import { BuiltinTypes, createRefToElmWithValue, Element, ElemID, ObjectType, TypeReference } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { getDefaultAdapterConfig, mockClient } from '../utils'
import overrideProjectSchemeFields from '../../src/filters/override_project_scheme_fields_types'
import { JIRA } from '../../src/constants'

describe('overrideProjectSchemeFields', () => {
  const MOCK_REF_TYPE = new TypeReference(new ElemID('', ''))

  let runFilter: (...elements: Element[]) => Promise<Element[]>
  beforeAll(async () => {
    const { client, paginator } = mockClient()
    const filter = overrideProjectSchemeFields({
      client,
      paginator,
      config: await getDefaultAdapterConfig(),
    }) as filterUtils.FilterWith<'onFetch'>
    runFilter = async (...elements: Element[]): Promise<Element[]> => {
      await filter.onFetch(elements)
      return elements
    }
  })

  it('should override the type of the scheme fields to the matching scheme type', async () => {
    const workflowSchemeType = new ObjectType({
      elemID: new ElemID(JIRA, 'WorkflowScheme'),
    })
    const permissionSchemeType = new ObjectType({
      elemID: new ElemID(JIRA, 'PermissionScheme'),
    })
    const notificationSchemeType = new ObjectType({
      elemID: new ElemID(JIRA, 'NotificationScheme'),
    })
    const issueTypeScreenSchemeType = new ObjectType({
      elemID: new ElemID(JIRA, 'IssueTypeScreenScheme'),
    })
    const fieldConfigurationSchemeType = new ObjectType({
      elemID: new ElemID(JIRA, 'FieldConfigurationScheme'),
    })
    const projectType = new ObjectType({
      elemID: new ElemID(JIRA, 'Project'),
      fields: {
        workflowScheme: { refType: MOCK_REF_TYPE },
        permissionScheme: { refType: MOCK_REF_TYPE },
        notificationScheme: { refType: MOCK_REF_TYPE },
        issueTypeScreenScheme: { refType: MOCK_REF_TYPE },
        fieldConfigurationScheme: { refType: MOCK_REF_TYPE },
      },
    })
    await runFilter(
      projectType,
      workflowSchemeType,
      permissionSchemeType,
      notificationSchemeType,
      issueTypeScreenSchemeType,
      fieldConfigurationSchemeType,
    )
    expect(projectType.fields.workflowScheme.refType)
      .toEqual(createRefToElmWithValue(workflowSchemeType))
    expect(projectType.fields.permissionScheme.refType)
      .toEqual(createRefToElmWithValue(permissionSchemeType))
    expect(projectType.fields.notificationScheme.refType)
      .toEqual(createRefToElmWithValue(notificationSchemeType))
    expect(projectType.fields.issueTypeScreenScheme.refType)
      .toEqual(createRefToElmWithValue(issueTypeScreenSchemeType))
    expect(projectType.fields.fieldConfigurationScheme.refType)
      .toEqual(createRefToElmWithValue(BuiltinTypes.UNKNOWN))
  })
})
