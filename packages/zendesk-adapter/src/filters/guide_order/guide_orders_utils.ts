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
import {
  BuiltinTypes,
  Change, CORE_ANNOTATIONS,
  DeployResult,
  ElemID,
  InstanceElement,
  isReferenceExpression,
  isRemovalChange,
  ObjectType,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import ZendeskClient from '../../client/client'
import { API_DEFINITIONS_CONFIG, FilterContext } from '../../config'
import { BRAND_TYPE_NAME, CATEGORY_TYPE_NAME, SECTION_TYPE_NAME, ZENDESK } from '../../constants'

const { RECORDS_PATH, SETTINGS_NESTED_PATH, createUrl } = elementsUtils
const { awu } = collections.asynciterable

export const ORDER_IN_BRAND_TYPE = 'order_in_brand'
export const ORDER_IN_CATEGORY_TYPE = 'order_in_category'
export const ORDER_IN_SECTION_TYPE = 'order_in_section'

export const CATEGORIES_FIELD = 'categories'
export const SECTIONS_FIELD = 'sections'
export const ARTICLES_FIELD = 'articles'

// TODO - fill it up
export const GUIDE_ORDER_TYPES : {[key: string]: ObjectType} = {
  [BRAND_TYPE_NAME]:
      new ObjectType({
        elemID: new ElemID(ZENDESK, ORDER_IN_BRAND_TYPE),
        fields: { [CATEGORIES_FIELD]: { refType: BuiltinTypes.UNKNOWN } },
      }),
  [CATEGORY_TYPE_NAME]:
      new ObjectType({
        elemID: new ElemID(ZENDESK, ORDER_IN_CATEGORY_TYPE),
        fields: { [SECTIONS_FIELD]: { refType: BuiltinTypes.UNKNOWN } },
      }),
  [SECTION_TYPE_NAME]:
      new ObjectType({
        elemID: new ElemID(ZENDESK, ORDER_IN_SECTION_TYPE),
        fields: {
          [SECTIONS_FIELD]: { refType: BuiltinTypes.UNKNOWN },
          [ARTICLES_FIELD]: { refType: BuiltinTypes.UNKNOWN },
        },
      }),
}

export const createOrderElement = ({ parent, parentField, orderField, childrenElements }
: {
  parent: InstanceElement
  parentField: string
  orderField: string
  childrenElements: InstanceElement[]
}): InstanceElement => {
  const parentsChildren = _.orderBy(
    childrenElements.filter(c => c.value[parentField] === parent.value.id),
    // Lowest position index first, if there is a tie - the newer is first
    ['value.position', 'value.created_at'], ['asc', 'desc']
  )

  return new InstanceElement(
    parent.elemID.name,
    GUIDE_ORDER_TYPES[parent.elemID.typeName],
    {
      [orderField]: parentsChildren.map(c => new ReferenceExpression(c.elemID, c)),
    },
    [
      ZENDESK,
      RECORDS_PATH,
      SETTINGS_NESTED_PATH,
      'GuideOrder',
      `order_in_${parent.elemID.typeName}`,
    ],
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parent.elemID, parent)],
    }
  )
}

// Transform order changes to new changes and deploy them
export const deployOrderChanges = async ({ changes, client, config, orderField } : {
  changes: Change<InstanceElement>[]
  client: ZendeskClient
  config: FilterContext
  orderField: string
}) : Promise<DeployResult> => {
  const orderChangeErrors: Error[] = []
  const appliedChanges: Change[] = []

  await awu(changes).forEach(async change => {
    // Removal means nothing because the element is internal
    if (isRemovalChange(change)) {
      return
    }

    const newOrderElement = change.data.after
    const orderElements = newOrderElement.value[orderField]

    if (!orderElements.every(isReferenceExpression)) {
      orderChangeErrors.push(new Error(`Error updating ${orderField} positions of '${newOrderElement.elemID.typeName}' - some values in the list are not a reference`))
      return
    }

    await awu(orderElements).filter(isReferenceExpression).forEach(async (child, i) => {
      const resolvedChild = child.value
      const childType = resolvedChild.elemID.typeName
      const childUpdateApi = config[API_DEFINITIONS_CONFIG].types[childType].deployRequests?.modify

      // Send an api request to update the positions of the elements in the order list
      if (childUpdateApi !== undefined) {
        try {
          await client.put({
            url: createUrl({
              instance: resolvedChild,
              baseUrl: childUpdateApi.url,
              urlParamsToFields: childUpdateApi.urlParamsToFields,
            }),
            data: { position: i },
          })
        } catch (e) {
          orderChangeErrors.push(new Error(`Error updating position of '${childType}' - ${e.message}`))
        }
      } else {
        orderChangeErrors.push(new Error(`Error updating position of '${childType}' - No update API configuration`))
      }
    })

    if (orderChangeErrors.length === 0) {
      appliedChanges.push(change)
    }
  })

  return {
    appliedChanges,
    errors: orderChangeErrors,
  }
}
