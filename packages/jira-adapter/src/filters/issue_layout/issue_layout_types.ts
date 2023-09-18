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

import Joi from 'joi'
import { ObjectType, ElemID, BuiltinTypes, ListType, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { elements as adapterElements } from '@salto-io/adapter-components'
import { ISSUE_LAYOUT_TYPE, JIRA } from '../../constants'

export const createIssueLayoutType = (): {
  issueLayoutType: ObjectType
  subTypes: ObjectType[]
} => {
  const issueLayoutItemType = new ObjectType({
    elemID: new ElemID(JIRA, 'issueLayoutItem'),
    fields: {
      type: { refType: BuiltinTypes.STRING },
      sectionType: { refType: BuiltinTypes.STRING },
      key: { refType: BuiltinTypes.STRING },
    },
  })

  const issueLayoutConfigType = new ObjectType({
    elemID: new ElemID(JIRA, 'issueLayoutConfig'),
    fields: {
      items: { refType: new ListType(issueLayoutItemType) },
    },
  })

  const issueLayoutType = new ObjectType({
    elemID: new ElemID(JIRA, ISSUE_LAYOUT_TYPE),
    fields: {
      id: {
        refType: BuiltinTypes.SERVICE_ID,
        annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
      },
      projectId: {
        refType: BuiltinTypes.NUMBER,
      },
      extraDefinerId: {
        refType: BuiltinTypes.NUMBER,
      },
      issueLayoutConfig: {
        refType: issueLayoutConfigType,
      },
    },
    path: [JIRA, adapterElements.TYPES_PATH, ISSUE_LAYOUT_TYPE],
  })

  return {
    issueLayoutType,
    subTypes: [
      issueLayoutItemType,
      issueLayoutConfigType,
    ],
  }
}

export type screenScheme = {
  id: string
  name: string
  description: string
  screens: {
  }
}

export type containerIssueLayoutResponse = {
  containerType: string
  items: {
    nodes: {
      fieldItemId?: string
      panelItemId?: string
    }[]
  }
}

const CONTAINER_ISSUE_LAYOUT_RESPONSE_SCHEME = Joi.object({
  containerType: Joi.string().required(),
  items: Joi.object({
    nodes: Joi.array().items(Joi.object({
      fieldItemId: Joi.string(),
      panelItemId: Joi.string(),
    }).unknown(true)).required(),
  }).required(),
}).unknown(true).required()

export type IssueLayoutResponse = {
  issueLayoutConfiguration: {
      issueLayoutResult: {
          id: string
          name: string
          containers: containerIssueLayoutResponse[]
      }
    }
  }

export type IssueLayoutConfigItem = {
  type: string
  sectionType: 'PRIMARY' | 'SECONDARY' | 'CONTENT'
  key: string
}

export const ISSUE_LAYOUT_CONFIG_ITEM_SCHEME = Joi.object({
  type: Joi.string().required(),
  sectionType: Joi.string().valid('PRIMARY', 'SECONDARY', 'CONTENT').required(),
  key: Joi.string().required(),
}).unknown(true).required()

export type IssueLayoutConfig = {
    items: IssueLayoutConfigItem[]
}

export const ISSUE_LAYOUT_RESPONSE_SCHEME = Joi.object({
  issueLayoutConfiguration: Joi.object({
    issueLayoutResult: Joi.object({
      containers: Joi.array().items(CONTAINER_ISSUE_LAYOUT_RESPONSE_SCHEME).required(),
    }).unknown(true).required(),
  }).unknown(true).required(),
}).unknown(true).required()
