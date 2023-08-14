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

import { ObjectType, ElemID, BuiltinTypes, ListType } from '@salto-io/adapter-api'
import { JIRA } from '../../constants'

const dataOwnerIssueLayoutType = new ObjectType({
  elemID: new ElemID(JIRA, 'IssueLayoutDataOwner'),
  fields: {
    id: { refType: BuiltinTypes.STRING },
    name: { refType: BuiltinTypes.STRING },
    description: { refType: BuiltinTypes.STRING },
    avatarId: { refType: BuiltinTypes.STRING },
    iconUrl: { refType: BuiltinTypes.STRING },
  },
})

export const onwerIssueLayoutType = new ObjectType({
  elemID: new ElemID(JIRA, 'IssueLayoutOwner'),
  fields: {
    type: { refType: BuiltinTypes.STRING },
    dataOwner: { refType: dataOwnerIssueLayoutType },
  },
})

export const issueLayoutItemType = new ObjectType({
  elemID: new ElemID(JIRA, 'issueLayoutItem'),
  fields: {
    type: { refType: BuiltinTypes.STRING },
    sectionType: { refType: BuiltinTypes.STRING },
    key: { refType: BuiltinTypes.STRING },
  },
})

export const issueLayoutConfigType = new ObjectType({
  elemID: new ElemID(JIRA, 'issueLayoutConfig'),
  fields: {
    items: { refType: new ListType(issueLayoutItemType) },
  },
})

export const ISSUE_LAYOUT_SUB_TYPES = [
  dataOwnerIssueLayoutType,
  onwerIssueLayoutType,
  issueLayoutItemType,
  issueLayoutConfigType,
]

export type LayoutOwners = {
  avatarId: string
  description: string
  iconUrl: string
  id: string
  name: string
}[]

export type containerIssueLayoutResponse = {
  containerType: string
  items: {
    nodes: {
      fieldItemId?: string
      panelItemId?: string
    }[]
  }
}

export type IssueLayoutResponse = {
  issueLayoutConfiguration: {
      issueLayoutResult: {
          id: string
          name: string
          usageInfo: {
              edges: {
                  node: {
                      layoutOwners: LayoutOwners
                  }
              }[]
          }
          containers: containerIssueLayoutResponse[]
      }
    }
  }

export type IssueLayoutConfigItem = {
  type: string
  sectionType: string
  key: string
}

export type IssueLayoutConfig = {
    items: IssueLayoutConfigItem[]
}
