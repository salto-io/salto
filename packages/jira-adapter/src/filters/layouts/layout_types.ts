/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import Joi from 'joi'
import {
  ObjectType,
  ElemID,
  BuiltinTypes,
  ListType,
  CORE_ANNOTATIONS,
  Value,
  InstanceElement,
} from '@salto-io/adapter-api'
import { elements as adapterElements } from '@salto-io/adapter-components'
import { JIRA } from '../../constants'

export const createLayoutType = (
  typeName: string,
): {
  layoutType: ObjectType
  subTypes: ObjectType[]
} => {
  const layoutItemType = new ObjectType({
    elemID: new ElemID(JIRA, 'issueLayoutItem'),
    fields: {
      type: { refType: BuiltinTypes.STRING },
      sectionType: { refType: BuiltinTypes.STRING },
      key: { refType: BuiltinTypes.STRING },
    },
  })

  const layoutConfigType = new ObjectType({
    elemID: new ElemID(JIRA, 'issueLayoutConfig'),
    fields: {
      items: { refType: new ListType(layoutItemType) },
    },
  })

  const layoutType = new ObjectType({
    elemID: new ElemID(JIRA, typeName),
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
        refType: layoutConfigType,
      },
    },
    path: [JIRA, adapterElements.TYPES_PATH, typeName],
  })

  return {
    layoutType,
    subTypes: [layoutItemType, layoutConfigType],
  }
}

type ContainerIssueLayoutResponse = {
  containerType: string
  items: {
    nodes: {
      fieldItemId?: string
      panelItemId?: string
      items?: {
        nodes: {
          fieldItemId?: string
          panelItemId?: string
        }[]
      }
    }[]
  }
}

const CONTAINER_ISSUE_LAYOUT_RESPONSE_SCHEME = Joi.object({
  containerType: Joi.string().required(),
  items: Joi.object({
    nodes: Joi.array()
      .items(
        Joi.object({
          fieldItemId: Joi.string(),
          panelItemId: Joi.string(),
          items: Joi.object({
            nodes: Joi.array().items(
              Joi.object({
                fieldItemId: Joi.string(),
                panelItemId: Joi.string(),
              }).unknown(true),
            ),
          }).unknown(true),
        }).unknown(true),
      )
      .required(),
  }).required(),
})
  .unknown(true)
  .required()

export type IssueLayoutConfiguration = {
  issueLayoutResult: {
    id: string
    name: string
    containers: ContainerIssueLayoutResponse[]
  }
  metadata?: {
    configuration: {
      items: {
        nodes: {
          fieldItemId?: string
          panelItemId?: string
        }[]
      }
    }
  }
}

export type IssueLayoutResponse = {
  issueLayoutConfiguration: IssueLayoutConfiguration
}

export type LayoutConfigItem = {
  type: 'FIELD' | 'PANEL'
  sectionType: 'PRIMARY' | 'SECONDARY' | 'CONTENT' | 'REQUEST'
  key: string
  data:
    | {
        properties?: Value | null
      }
    | undefined
}

export const ISSUE_LAYOUT_CONFIG_ITEM_SCHEME = Joi.object({
  type: Joi.string().valid('FIELD', 'PANEL').required(),
  sectionType: Joi.string().valid('PRIMARY', 'SECONDARY', 'CONTENT', 'REQUEST').required(),
  key: Joi.string().required(),
  data: Joi.object({
    properties: Joi.object().unknown(true).allow(null),
  }).unknown(true),
})
  .unknown(true)
  .required()

export type IssueLayoutConfig = {
  items: LayoutConfigItem[]
}

export const ISSUE_LAYOUT_RESPONSE_SCHEME = Joi.object({
  issueLayoutConfiguration: Joi.object({
    issueLayoutResult: Joi.object({
      containers: Joi.array().items(CONTAINER_ISSUE_LAYOUT_RESPONSE_SCHEME).required(),
    })
      .unknown(true)
      .required(),
    metadata: Joi.object({
      configuration: Joi.object({
        items: Joi.object({
          nodes: Joi.array().items(Joi.object({}).unknown(true).required()).required(),
        }).required(),
      })
        .unknown(true)
        .required(),
    })
      .unknown(true)
      .allow(null)
      .required(),
  })
    .unknown(true)
    .required(),
})
  .unknown(true)
  .required()

type RequestType = {
  requestForm: {
    issueLayoutConfig: IssueLayoutConfig
  }
}

export type RequestTypeWithIssueLayoutConfigInstance = InstanceElement & {
  value: InstanceElement['value'] & RequestType
}

export type errorResponse = {
  message: string
  extensions: {
    statusCode: number
  }
}

export const ERROR_RESPONSE_SCHEME = Joi.object({
  message: Joi.string().required(),
  extensions: Joi.object({
    statusCode: Joi.number().required(),
  })
    .required()
    .unknown(true),
})
  .unknown(true)
  .required()
