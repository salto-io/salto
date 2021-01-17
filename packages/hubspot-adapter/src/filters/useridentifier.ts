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
  Element, isInstanceElement, isObjectType, Values, ObjectType,
  isListType, getDeepInnerType, Value, ListType, isMapType,
} from '@salto-io/adapter-api'
import { toObjectType } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { Owner } from '../client/types'
import { isUserIdentifierType } from '../transformers/transformer'
import { FilterCreator } from '../filter'

const { awu } = collections.asynciterable

const getValueAsArray = (value: Values): Values[] =>
  (_.isArray(value) ? value : [value])

const convertUserIdentifiers = async (
  objectType: ObjectType,
  values: Values,
  ownersMap: Map<number, string>
): Promise<void> => {
  const convertListTypeOfObjectType = async (
    listType: ListType,
    listValue: Values,
  ): Promise<void> => {
    const currentLevelInnerType = await listType.getInnerType()
    if (isListType(currentLevelInnerType)) {
      await awu(getValueAsArray(listValue)).forEach(async (val: Values): Promise<void> => {
        await convertListTypeOfObjectType(currentLevelInnerType, val)
      })
    }
    if (isObjectType(currentLevelInnerType) || isMapType(currentLevelInnerType)) {
      await awu(getValueAsArray(listValue)).forEach(async (val: Values): Promise<void> => {
        await convertUserIdentifiers(toObjectType(currentLevelInnerType, val), val, ownersMap)
      })
    }
  }
  await awu(Object.values(objectType.fields))
    .forEach(async field => {
      const currentValue = values[field.name]
      if (_.isUndefined(currentValue)) {
        return
      }
      const fieldType = await field.getType()
      if (isUserIdentifierType(fieldType)) {
        const numVal = Number(currentValue)
        if (!Number.isNaN(numVal)) {
          values[field.name] = ownersMap.get(numVal) || numVal.toString()
        }
      }
      if (isObjectType(fieldType) || isMapType(fieldType)) {
        await convertUserIdentifiers(toObjectType(fieldType, currentValue), currentValue, ownersMap)
      }
      if (isListType(fieldType)) {
        const deepInnerType = await getDeepInnerType(fieldType)
        if (isUserIdentifierType(deepInnerType)) {
          // Currently all array are represented as a string in HubSpot
          // If there will be "real" array ones we need to support it
          values[field.name] = _.cloneDeepWith(currentValue, (val: Value): string[] | undefined =>
            (_.isString(val) ? val.split(',').map(vals => vals.trim())
              .map(v => ownersMap.get(Number(v)) || v) : undefined))
        }
        if (isObjectType(deepInnerType)) {
          await convertListTypeOfObjectType(fieldType, currentValue)
        }
      }
    })
}

const createOwnersMap = (ownersRes: Owner[]): Map<number, string> =>
  new Map(ownersRes.map((ownerRes): [number, string] => [ownerRes.activeUserId, ownerRes.email]))

const filterCreator: FilterCreator = ({ client }) => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    const owners = await client.getOwners()
    const ownersMap = createOwnersMap(owners)
    await awu(elements)
      .filter(isInstanceElement)
      .filter(async instance => isObjectType(await instance.getType()))
      .forEach(async instance => {
        await convertUserIdentifiers(await instance.getType(), instance.value, ownersMap)
      })
  },
})

export default filterCreator
