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
  Change,
  CORE_ANNOTATIONS,
  DeployResult,
  getChangeData,
  InstanceElement,
  isReferenceExpression,
  isRemovalChange,
  ObjectType,
  ReferenceExpression,
  ElemID,
  ListType,
  BuiltinTypes,
  SaltoElementError, createSaltoElementError,
} from '@salto-io/adapter-api'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import _ from 'lodash'
import { elements as elementsUtils, fetch as fetchUtils } from '@salto-io/adapter-components'
import ZendeskClient from '../../client/client'
import { API_DEFINITIONS_CONFIG, FilterContext } from '../../config'
import { BRAND_TYPE_NAME, CATEGORY_ORDER_TYPE_NAME, SECTION_ORDER_TYPE_NAME, ARTICLE_ORDER_TYPE_NAME, CATEGORY_TYPE_NAME, ZENDESK, CATEGORIES_FIELD, SECTION_TYPE_NAME, SECTIONS_FIELD, ARTICLE_TYPE_NAME, ARTICLES_FIELD } from '../../constants'
import { getZendeskError } from '../../errors'


const { isDefined } = lowerDashValues
const { createUrl } = fetchUtils.resource
const { awu } = collections.asynciterable

export const GUIDE_ORDER_TYPES = [
  CATEGORY_ORDER_TYPE_NAME, SECTION_ORDER_TYPE_NAME, ARTICLE_ORDER_TYPE_NAME,
]

const GUIDE_ORDER_OBJECT_TYPES : {[key: string]: (() => ObjectType)} = {
  [CATEGORY_TYPE_NAME]: () =>
    new ObjectType({
      elemID: new ElemID(ZENDESK, CATEGORY_ORDER_TYPE_NAME),
      fields: {
        [CATEGORIES_FIELD]: { refType: new ListType(BuiltinTypes.NUMBER) },
        brand: { refType: BuiltinTypes.NUMBER },
      },
      path: [ZENDESK, elementsUtils.TYPES_PATH, CATEGORY_ORDER_TYPE_NAME],
    }),
  [SECTION_TYPE_NAME]: () =>
    new ObjectType({
      elemID: new ElemID(ZENDESK, SECTION_ORDER_TYPE_NAME),
      fields: {
        [SECTIONS_FIELD]: { refType: new ListType(BuiltinTypes.NUMBER) },
        brand: { refType: BuiltinTypes.NUMBER },
      },
      path: [ZENDESK, elementsUtils.TYPES_PATH, SECTION_ORDER_TYPE_NAME],
    }),
  [ARTICLE_TYPE_NAME]: () =>
    new ObjectType({
      elemID: new ElemID(ZENDESK, ARTICLE_ORDER_TYPE_NAME),
      fields: {
        [ARTICLES_FIELD]: { refType: new ListType(BuiltinTypes.NUMBER) },
        brand: { refType: BuiltinTypes.NUMBER },
      },
      path: [ZENDESK, elementsUtils.TYPES_PATH, ARTICLE_ORDER_TYPE_NAME],
    }),
}

export const createOrderType = (typeName: string)
  : ObjectType => GUIDE_ORDER_OBJECT_TYPES[typeName]()


export const createOrderInstance = ({ parent, parentField, orderField, childrenElements, orderType }
: {
  parent: InstanceElement
  parentField: string
  orderField: string
  childrenElements: InstanceElement[]
  orderType: ObjectType
}): InstanceElement => {
  const parentsChildren = _.orderBy(
    childrenElements.filter(c => c.value[parentField] === parent.value.id),
    // Lowest position index first, if there is a tie - the newer is first, another tie - by id
    ['value.position', 'value.created_at', 'value.id'], ['asc', 'desc', 'desc']
  )

  return new InstanceElement(
    parent.elemID.name,
    orderType,
    {
      [orderField]: parentsChildren.map(c => new ReferenceExpression(c.elemID, c)),
      brand: parent.elemID.typeName !== BRAND_TYPE_NAME
        ? parent.value.brand
        : new ReferenceExpression(parent.elemID, parent), // for category_order parent is brand
    },
    // The same directory as it's parent
    parent.path !== undefined
      ? [...parent.path.slice(0, -1), orderType.elemID.typeName]
      : undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parent.elemID, parent)],
    }
  )
}

const updateElementPositions = async (
  change: Change<InstanceElement>,
  orderField: string,
  config: FilterContext,
  client: ZendeskClient
): Promise<SaltoElementError[]> => {
  // Removal means nothing because the element is internal
  // We have order_deletion_validator that made sure the parent was also deleted
  if (isRemovalChange(change)) {
    return []
  }

  const newOrderElement = change.data.after
  const elements = newOrderElement.value[orderField] ?? []

  return awu(elements).filter(isReferenceExpression).map(
    async (child, i): Promise<SaltoElementError | undefined> => {
      const resolvedChild = child.value
      const childType = resolvedChild.elemID.typeName
      const childUpdateApi = config[API_DEFINITIONS_CONFIG].types[childType].deployRequests?.modify

      if (childUpdateApi === undefined) {
        return createSaltoElementError({
          message: `No endpoint of type modify for ${child.elemID.typeName}`,
          severity: 'Error',
          elemID: getChangeData(change).elemID,
        })
      }

      // Send an api request to update the positions of the elements in the order list
      // There is no reason to update elements that weren't changed
      if (resolvedChild.value.position !== i) {
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
          return getZendeskError(getChangeData(change).elemID, err)
        }
      }
      return undefined
    }
  ).filter(isDefined)
    .toArray()
}

/**
 * Updated the position of the elements in the order list, by calling their modify API
*/
export const deployOrderChanges = async ({ changes, client, config, orderField } : {
  changes: Change<InstanceElement>[]
  client: ZendeskClient
  config: FilterContext
  orderField: string
}) : Promise<DeployResult> => {
  const orderChangeErrors: (SaltoElementError)[] = []
  const appliedChanges: Change[] = []

  await awu(changes).forEach(async change => {
    const changeErrors = await updateElementPositions(change, orderField, config, client)
    if (changeErrors.length === 0) {
      appliedChanges.push(change)
    } else {
      orderChangeErrors.push(...changeErrors)
    }
  })

  return {
    appliedChanges,
    errors: orderChangeErrors,
  }
}
