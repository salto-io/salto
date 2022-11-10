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
  ElemID, getChangeData,
  InstanceElement,
  isReferenceExpression,
  isRemovalChange, ListType,
  ObjectType,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import ZendeskClient from '../../client/client'
import { API_DEFINITIONS_CONFIG, FilterContext } from '../../config'
import { BRAND_TYPE_NAME, CATEGORY_TYPE_NAME, SECTION_TYPE_NAME, ZENDESK } from '../../constants'
import { getZendeskError } from '../../errors'

const { RECORDS_PATH, SETTINGS_NESTED_PATH, createUrl } = elementsUtils
const { awu } = collections.asynciterable

export const ORDER_IN_BRAND_TYPE = 'order_in_brand'
export const ORDER_IN_CATEGORY_TYPE = 'order_in_category'
export const ORDER_IN_SECTION_TYPE = 'order_in_section'

export const CATEGORIES_FIELD = 'categories'
export const SECTIONS_FIELD = 'sections'
export const ARTICLES_FIELD = 'articles'

const GUIDE_ORDER_TYPES : {[key: string]: () => ObjectType} = {
  [BRAND_TYPE_NAME]: () =>
    new ObjectType({
      elemID: new ElemID(ZENDESK, ORDER_IN_BRAND_TYPE),
      fields: { [CATEGORIES_FIELD]: { refType: new ListType(BuiltinTypes.NUMBER) } },
    }),
  [CATEGORY_TYPE_NAME]: () =>
    new ObjectType({
      elemID: new ElemID(ZENDESK, ORDER_IN_CATEGORY_TYPE),
      fields: { [SECTIONS_FIELD]: { refType: new ListType(BuiltinTypes.NUMBER) } },
    }),
  [SECTION_TYPE_NAME]: () =>
    new ObjectType({
      elemID: new ElemID(ZENDESK, ORDER_IN_SECTION_TYPE),
      fields: {
        [SECTIONS_FIELD]: { refType: new ListType(BuiltinTypes.NUMBER) },
        [ARTICLES_FIELD]: { refType: new ListType(BuiltinTypes.NUMBER) },
      },
    }),
}

export const createOrderType = (typeName: string) : ObjectType => GUIDE_ORDER_TYPES[typeName]()


export const createOrderElement = ({ parent, parentField, orderField, childrenElements }
: {
  parent: InstanceElement
  parentField: string
  orderField: string
  childrenElements: InstanceElement[]
}): InstanceElement => {
  const parentsChildren = _.orderBy(
    childrenElements.filter(c => c.value[parentField] === parent.value.id),
    // Lowest position index first, if there is a tie - the newer is first, another tie - by id
    ['value.position', 'value.created_at', 'value.id'], ['asc', 'desc', 'asc']
  )

  return new InstanceElement(
    `${parent.elemID.name}_${orderField}`,
    createOrderType(parent.elemID.typeName),
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
        } catch (err) {
          orderChangeErrors.push(getZendeskError(getChangeData(change).elemID.getFullName(), err))
        }
      } else {
        orderChangeErrors.push(new Error(`No endpoint of type modify for ${child.elemID.typeName}`))
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
