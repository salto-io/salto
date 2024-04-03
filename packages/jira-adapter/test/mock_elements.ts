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
  ObjectType,
  ElemID,
  BuiltinTypes,
  MapType,
  InstanceElement,
  ListType,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { openapi } from '@salto-io/adapter-components'
import { ISSUE_TYPE_SCHEMA_NAME, JIRA } from '../src/constants'

const { ADDITIONAL_PROPERTIES_FIELD } = openapi

const boardLocationType = new ObjectType({
  elemID: new ElemID(JIRA, 'Board_location'),
  fields: {
    projectId: { refType: BuiltinTypes.NUMBER },
    [ADDITIONAL_PROPERTIES_FIELD]: { refType: new MapType(BuiltinTypes.UNKNOWN) },
  },
})

const boardType = new ObjectType({
  elemID: new ElemID(JIRA, 'Board'),
  fields: {
    self: { refType: BuiltinTypes.STRING },
    location: { refType: boardLocationType },
  },
})

const projectType = new ObjectType({
  elemID: new ElemID(JIRA, 'Project'),
  fields: {
    self: { refType: BuiltinTypes.STRING },
  },
})

const issueTypeSchemeMappingType = new ObjectType({
  elemID: new ElemID(JIRA, 'IssueTypeSchemeMapping'),
  fields: {
    issueTypeId: { refType: BuiltinTypes.STRING },
  },
})

const issueTypeSchemeType = new ObjectType({
  elemID: new ElemID(JIRA, ISSUE_TYPE_SCHEMA_NAME),
  fields: {
    issueTypeIds: { refType: new ListType(issueTypeSchemeMappingType) },
  },
})

const issueTypeScreenSchemeType = new ObjectType({
  elemID: new ElemID(JIRA, 'IssueTypeScreenScheme'),
  fields: {
    id: { refType: BuiltinTypes.STRING },
  },
})

const fieldConfigurationSchemeType = new ObjectType({
  elemID: new ElemID(JIRA, 'FieldConfigurationScheme'),
  fields: {
    id: { refType: BuiltinTypes.STRING },
  },
})

export const mockTypes = {
  Board: boardType,
  Project: projectType,
  IssueTypeScheme: issueTypeSchemeType,
  IssueTypeScreenScheme: issueTypeScreenSchemeType,
  FieldConfigurationScheme: fieldConfigurationSchemeType,
}

export const mockInstances = {
  Board: new InstanceElement('my_board', mockTypes.Board, {
    self: 'https://test.atlassian.net/rest/agile/1.0/board/1',
    location: {
      projectId: 10000,
      [ADDITIONAL_PROPERTIES_FIELD]: {
        self: 'https://ori-salto-test.atlassian.net/rest/api/2/project/10000',
      },
    },
  }),
  Project: new InstanceElement('my_project', mockTypes.Project, {
    self: 'https://ori-salto-test.atlassian.net/rest/api/3/project/10000',
  }),
}

export const instanceCreators = {
  issueTypeScheme: (name: string, issueTypesReferences: ReferenceExpression[]) =>
    new InstanceElement(name, mockTypes.IssueTypeScheme, {
      issueTypeIds: issueTypesReferences.map(reference => ({ issueTypeId: reference })),
    }),
  issueTypeScreenScheme: (id: string, name = 'mockIssueTypeScreenScheme') =>
    new InstanceElement(name, mockTypes.IssueTypeScreenScheme, { id }),
  fieldConfigurationScheme: (id: string, name = 'mockFieldConfigurationScheme') =>
    new InstanceElement(name, mockTypes.FieldConfigurationScheme, { id }),
}
