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
  elemID: new ElemID(JIRA, 'dataOwner'),
  fields: {
    id: { refType: BuiltinTypes.STRING },
    name: { refType: BuiltinTypes.STRING },
    description: { refType: BuiltinTypes.STRING },
    avatarId: { refType: BuiltinTypes.STRING },
    iconUrl: { refType: BuiltinTypes.STRING },
  },
})

export const onwerIssueLayoutType = new ObjectType({
  elemID: new ElemID(JIRA, 'owner'),
  fields: {
    type: { refType: BuiltinTypes.STRING },
    dataOwner: { refType: dataOwnerIssueLayoutType },
  },
})

const providrItemIssueLayoutType = new ObjectType({
  elemID: new ElemID(JIRA, 'providerItem'),
  fields: {
    key: { refType: BuiltinTypes.STRING },
    name: { refType: BuiltinTypes.STRING },
  },
})

const operationsItemIssueLayoutType = new ObjectType({
  elemID: new ElemID(JIRA, 'operationsItem'),
  fields: {
    editable: { refType: BuiltinTypes.BOOLEAN },
    canModifyRequired: { refType: BuiltinTypes.BOOLEAN },
    canModifyOptions: { refType: BuiltinTypes.BOOLEAN },
    canModifyDefaultValue: { refType: BuiltinTypes.BOOLEAN },
    canModifyPropertyConfiguration: { refType: BuiltinTypes.BOOLEAN },
    removable: { refType: BuiltinTypes.BOOLEAN },
    deletable: { refType: BuiltinTypes.BOOLEAN },
    canAssociateInSettings: { refType: BuiltinTypes.BOOLEAN },
    categoriesWhitelist: { refType: new ListType(BuiltinTypes.STRING) },
  },
})
const propertiesItemIssueLayoutType = new ObjectType({
  elemID: new ElemID(JIRA, 'propertiesItem'),
  fields: {
    key: { refType: BuiltinTypes.STRING },
    value: { refType: BuiltinTypes.STRING },
  },
})

const dataItemIssueLayoutType = new ObjectType({
  elemID: new ElemID(JIRA, 'dataItem'),
  fields: {
    externalUuid: { refType: BuiltinTypes.STRING },
    name: { refType: BuiltinTypes.STRING },
    description: { refType: BuiltinTypes.STRING },
    type: { refType: BuiltinTypes.STRING },
    custom: { refType: BuiltinTypes.BOOLEAN },
    global: { refType: BuiltinTypes.BOOLEAN },
    required: { refType: BuiltinTypes.BOOLEAN },
    operations: { refType: operationsItemIssueLayoutType },
    provider: { refType: providrItemIssueLayoutType },
    properties: { refType: new ListType(propertiesItemIssueLayoutType) },
  },
})

const itemIssueLayout = new ObjectType({
  elemID: new ElemID(JIRA, 'item'),
  fields: {
    type: { refType: BuiltinTypes.STRING },
    sectionType: { refType: BuiltinTypes.STRING },
    data: { refType: dataItemIssueLayoutType },
  },
})

export const issueLayoutConfigType = new ObjectType({
  elemID: new ElemID(JIRA, 'issueLayoutConfig'),
  fields: {
    items: { refType: new ListType(itemIssueLayout) },
  },
})

export const ISSUE_LAYOUT_SUB_TYPES = [
  dataOwnerIssueLayoutType,
  onwerIssueLayoutType,
  providrItemIssueLayoutType,
  operationsItemIssueLayoutType,
  propertiesItemIssueLayoutType,
  dataItemIssueLayoutType,
  itemIssueLayout,
  issueLayoutConfigType,
]

export type nodesIssueLayoutResponse = {
  key: string
  name: string
  type: string
  custom: boolean
  global: boolean
  required: boolean
  description: string
  externalUuid: string
  defaultValue: string
  operations: {
    editable: boolean
    canModifyRequired: boolean
    canModifyOptions: boolean
    canModifyDefaultValue: boolean
    canModifyPropertyConfiguration: boolean
    removable: boolean
    deletable: boolean
    canAssociateInSettings: boolean
    categoriesWhitelist: string[]
  }
  provider: {
    key: string
    name: string
  }
  properties: {
    key: string
    value: string
  }[]
}

export type itemsIssueLayoutResponse = {
  nodes: nodesIssueLayoutResponse[]
}


export type IssueLayoutResponse = {
  issueLayoutConfiguration: {
      issueLayoutResult: {
          id: string
          name: string
          usageInfo: {
              edges: {
                  currentProject: boolean
                  node: {
                      avatarId: string
                      projectId: number
                      projectKey: string
                      projectName: string
                      layoutOwners: {
                          avatarId: string
                          description: string
                          iconUrl: string
                          id: string
                          name: string
                      }[]
                  }
              }[]
          }
          containers: {
            containerType: string
            items: {
              nodes: {
                fieldItemId: string
                panelItemId: string
              }[]
            }
          }[]
      }
      metadata: {
          configuration: {
              items: {
                nodes : nodesIssueLayoutResponse[]
              }
          }
      }
    }
  }

export type IssueLayoutConfigItem = {
  type: string
  sectionType: string
  key: string
  data: {
      name: string
      description: string
      type: string
      custom: boolean
      global: boolean
      required: boolean
      externalUuid: string
      operations: {
          editable: boolean
          canModifyRequired: boolean
          canModifyOptions: boolean
          canModifyDefaultValue: boolean
          canModifyPropertyConfiguration: boolean
          removable: boolean
          deletable: boolean
          canAssociateInSettings: boolean
          categoriesWhitelist: string[]
      }
      provider: {
          key: string
          name: string
      }
      properties: {}
  }
}

export type IssueLayoutConfig = {
    items: IssueLayoutConfigItem[]
}

export type LayoutOwners = {
    avatarId: string
    description: string
    iconUrl: string
    id: string
    name: string
}[]

export type owners = {
  data: {
      id: string
      name: string
      description: string
      avatarId: string
      iconUrl: string
  }
}[]
