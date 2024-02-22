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
  BuiltinTypes,
  ElemID,
  InstanceElement,
  ListType,
  ObjectType,
  ReferenceExpression,
  Element,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { createEmptyType, getFilterParams } from '../../utils'
import { ISSUE_LAYOUT_TYPE, JIRA, PROJECT_TYPE, SCREEN_SCHEME_TYPE } from '../../../src/constants'
import createReferencesIssueLayoutFilter from '../../../src/filters/layouts/create_references_layouts'
import { getDefaultConfig } from '../../../src/config/config'
import { createLayoutType } from '../../../src/filters/layouts/layout_types'

describe('createReferencesIssueLayoutFilter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  let elements: Element[]
  let issueLayoutInstance: InstanceElement
  const screenType = new ObjectType({
    elemID: new ElemID(JIRA, 'Screen'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
    },
  })
  const screenInstance = new InstanceElement('screen1', screenType, {
    id: 11,
  })
  const screenSchemeType = new ObjectType({
    elemID: new ElemID(JIRA, SCREEN_SCHEME_TYPE),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      screens: { refType: screenType },
    },
  })
  const screenSchemeInstance = new InstanceElement('screenScheme1', screenSchemeType, {
    id: 111,
    screens: { default: new ReferenceExpression(screenInstance.elemID, screenInstance) },
  })
  const issueTypeScreenSchemeItemType = new ObjectType({
    elemID: new ElemID(JIRA, 'IssueTypeScreenSchemeItem'),
    fields: {
      issueTypeId: { refType: BuiltinTypes.STRING },
      screenSchemeId: { refType: screenSchemeType },
    },
  })
  const issueTypeScreenSchemeType = new ObjectType({
    elemID: new ElemID(JIRA, 'IssueTypeScreenScheme'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      issueTypeMappings: { refType: new ListType(issueTypeScreenSchemeItemType) },
    },
  })
  const issueTypeScreenSchemeInstance = new InstanceElement('issueTypeScreenScheme1', issueTypeScreenSchemeType, {
    id: 1111,
    issueTypeMappings: [
      {
        issueTypeId: 1,
        screenSchemeId: new ReferenceExpression(screenSchemeInstance.elemID, screenSchemeInstance),
      },
    ],
  })
  const projectType = new ObjectType({
    elemID: new ElemID(JIRA, PROJECT_TYPE),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      simplified: { refType: BuiltinTypes.BOOLEAN },
      issueTypeScreenScheme: { refType: issueTypeScreenSchemeType },
    },
  })
  const projectInstance = new InstanceElement('project1', projectType, {
    id: 11111,
    name: 'project1',
    simplified: false,
    projectTypeKey: 'software',
    issueTypeScreenScheme: new ReferenceExpression(issueTypeScreenSchemeInstance.elemID, issueTypeScreenSchemeInstance),
  })
  const fieldType = createEmptyType('Field')
  const fieldInstance1 = new InstanceElement('testField1', fieldType, {
    id: 'testField1',
    name: 'TestField1',
    type: 'testField1',
  })
  const layoutConfigItemType = new ObjectType({
    elemID: new ElemID(JIRA, 'layoutConfigItem'),
    fields: {
      key: { refType: fieldType },
      sectionType: { refType: BuiltinTypes.STRING },
      type: { refType: BuiltinTypes.STRING },
    },
  })
  const layoutConfigType = new ObjectType({
    elemID: new ElemID(JIRA, 'issueLayoutConfig'),
    fields: {
      items: { refType: new ListType(layoutConfigItemType) },
    },
  })
  const issueLayoutType = createLayoutType(ISSUE_LAYOUT_TYPE).layoutType

  const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
  config.fetch.enableIssueLayouts = true

  beforeEach(() => {
    issueLayoutInstance = new InstanceElement('issueLayout', issueLayoutType, {
      id: '2',
      extraDefinerId: '11',
      issueLayoutConfig: {
        items: [
          {
            type: 'FIELD',
            sectionType: 'PRIMARY',
            key: 'testField1',
          },
        ],
      },
    })
    elements = [
      screenType,
      screenInstance,
      screenSchemeType,
      screenSchemeInstance,
      issueTypeScreenSchemeType,
      issueTypeScreenSchemeInstance,
      projectType,
      projectInstance,
      fieldType,
      fieldInstance1,
      layoutConfigItemType,
      layoutConfigType,
      issueLayoutType,
      issueLayoutInstance,
    ]
    filter = createReferencesIssueLayoutFilter(getFilterParams({ config })) as typeof filter
  })
  it('should add references to issue layout', async () => {
    await filter.onFetch(elements)
    expect(issueLayoutInstance.value).toEqual({
      id: '2',
      extraDefinerId: new ReferenceExpression(screenInstance.elemID, screenInstance),
      issueLayoutConfig: {
        items: [
          {
            type: 'FIELD',
            sectionType: 'PRIMARY',
            key: new ReferenceExpression(fieldInstance1.elemID, fieldInstance1),
          },
        ],
      },
    })
  })
  it('should add key as missing ref if there is no field', async () => {
    fieldInstance1.value.id = 'testField3'
    await filter.onFetch(elements)
    expect(issueLayoutInstance?.value.issueLayoutConfig.items[0].key).toBeInstanceOf(ReferenceExpression)
    expect(issueLayoutInstance?.value.issueLayoutConfig.items[0].key.elemID.getFullName()).toEqual(
      'jira.Field.instance.missing_testField1',
    )
  })
})
