/*
*                      Copyright 2021 Salto Labs Ltd.
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
import _ from 'lodash'
import {
  Element, isInstanceElement, InstanceElement, ObjectType, ElemID, ListType, isObjectType,
  BuiltinTypes, ReferenceExpression, Change, getChangeElement, isModificationChange,
} from '@salto-io/adapter-api'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import { pathNaclCase } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import { ZENDESK_SUPPORT } from '../../constants'
import { deployChange } from '../../deployment'
import { API_DEFINITIONS_CONFIG } from '../../config'

const { TYPES_PATH, SUBTYPES_PATH, RECORDS_PATH } = elementsUtils

type ReorderFilterCreatorParams = {
  typeName: string
  orderFieldName: string
}

export const createOrderTypeName = (typeName: string): string => `${typeName}_order`

export const createReorderFilterCreator = (
  { typeName, orderFieldName }: ReorderFilterCreatorParams
): FilterCreator => ({ config, client }) => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    const orderTypeName = createOrderTypeName(typeName)
    const objType = elements
      .filter(isObjectType)
      .find(e => e.elemID.name === typeName)
    if (objType === undefined) {
      return
    }
    const instancesReferences = _.sortBy(
      elements
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === typeName),
      inst => inst.value.position
    ).map(refInst => new ReferenceExpression(refInst.elemID, refInst))
    const typeNameNaclCase = pathNaclCase(orderTypeName)
    const type = new ObjectType({
      elemID: new ElemID(ZENDESK_SUPPORT, orderTypeName),
      fields: {
        [orderFieldName]: {
          refType: new ListType(BuiltinTypes.NUMBER),
        },
      },
      isSettings: true,
      path: [ZENDESK_SUPPORT, TYPES_PATH, SUBTYPES_PATH, typeNameNaclCase],
    })
    const instance = new InstanceElement(
      ElemID.CONFIG_NAME,
      type,
      { [orderFieldName]: instancesReferences },
      [ZENDESK_SUPPORT, RECORDS_PATH, typeName, typeNameNaclCase],
    )
    elements.push(type, instance)
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const orderTypeName = createOrderTypeName(typeName)
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeElement(change).elemID.typeName === orderTypeName,
    )
    if (relevantChanges.length === 0) {
      return {
        deployResult: { appliedChanges: [], errors: [] },
        leftoverChanges,
      }
    }
    try {
      if (relevantChanges.length > 1) {
        throw new Error(
          `${orderTypeName} element is a singleton and should have only on instance. Found multiple: ${relevantChanges.length}`,
        )
      }
      const [change] = relevantChanges
      if (!isModificationChange(change)) {
        throw new Error(
          `only modify change is allowed on ${orderTypeName}. Found ${change.action} action`,
        )
      }
      await deployChange(change, client, config[API_DEFINITIONS_CONFIG])
    } catch (err) {
      if (!_.isError(err)) {
        throw err
      }
      return {
        deployResult: { appliedChanges: [], errors: [err] },
        leftoverChanges,
      }
    }
    return {
      deployResult: { appliedChanges: relevantChanges, errors: [] },
      leftoverChanges,
    }
  },
})
