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
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import _ from 'lodash'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import ZendeskClient from '../../client/client'
import { API_DEFINITIONS_CONFIG, FilterContext } from '../../config'
import { ARTICLE_TYPE_NAME, CATEGORY_TYPE_NAME, SECTION_TYPE_NAME, ZENDESK } from '../../constants'
import { getZendeskError } from '../../errors'


const { isDefined } = lowerDashValues
const { createUrl } = elementsUtils
const { awu } = collections.asynciterable

export const CATEGORIES_ORDER = 'categories_order'
export const SECTIONS_ORDER = 'sections_order'
export const ARTICLES_ORDER = 'articles_order'

export const GUIDE_ORDER_TYPES = [CATEGORIES_ORDER, SECTIONS_ORDER, ARTICLES_ORDER]

export const CATEGORIES_FIELD = 'categories'
export const SECTIONS_FIELD = 'sections'
export const ARTICLES_FIELD = 'articles'

const GUIDE_ORDER_OBJECT_TYPES : {[key: string]: () => ObjectType} = {
  [CATEGORY_TYPE_NAME]: () =>
    new ObjectType({
      elemID: new ElemID(ZENDESK, CATEGORIES_ORDER),
      fields: { [CATEGORIES_FIELD]: { refType: new ListType(BuiltinTypes.NUMBER) } },
    }),
  [SECTION_TYPE_NAME]: () =>
    new ObjectType({
      elemID: new ElemID(ZENDESK, SECTIONS_ORDER),
      fields: { [SECTIONS_FIELD]: { refType: new ListType(BuiltinTypes.NUMBER) } },
    }),
  [ARTICLE_TYPE_NAME]: () =>
    new ObjectType({
      elemID: new ElemID(ZENDESK, ARTICLES_ORDER),
      fields: { [ARTICLES_FIELD]: { refType: new ListType(BuiltinTypes.NUMBER) } },
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
): Promise<Error[]> => {
  // Removal means nothing because the element is internal
  // We have order_deletion_validator that made sure the parent was also deleted
  if (isRemovalChange(change)) {
    return []
  }

  const newOrderElement = change.data.after
  const elements = newOrderElement.value[orderField] ?? []

  return awu(elements).filter(isReferenceExpression).map(
    async (child, i): Promise<Error | undefined> => {
      const resolvedChild = child.value
      const childType = resolvedChild.elemID.typeName
      const childUpdateApi = config[API_DEFINITIONS_CONFIG].types[childType].deployRequests?.modify

      if (childUpdateApi === undefined) {
        return new Error(`No endpoint of type modify for ${child.elemID.typeName}`)
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
          return getZendeskError(getChangeData(change).elemID.getFullName(), err)
        }
      }
      return undefined
    }
  ).filter(isDefined)
    .toArray()
}

/**
  Updated the position of the elements in the order list, by calling their modify API
*/
export const deployOrderChanges = async ({ changes, client, config, orderField } : {
  changes: Change<InstanceElement>[]
  client: ZendeskClient
  config: FilterContext
  orderField: string
}) : Promise<DeployResult> => {
  const orderChangeErrors: Error[] = []
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
