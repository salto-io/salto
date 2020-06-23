/*
*                      Copyright 2020 Salto Labs Ltd.
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
  isListType, getDeepInnerType, Value, ListType,
} from '@salto-io/adapter-api'
import { Owner } from '../client/types'
import { isUserIdentifierType } from '../transformers/transformer'
import { FilterCreator } from '../filter'

const getValueAsArray = (value: Values): Values[] =>
  (_.isArray(value) ? value : [value])

const convertUserIdentifiers = (
  objectType: ObjectType,
  values: Values,
  ownersMap: Map<number, string>
): void => {
  const convertListTypeOfObjectType = (
    listType: ListType,
    listValue: Values,
  ): void => {
    const currentLevelInnerType = listType.innerType
    if (isListType(currentLevelInnerType)) {
      getValueAsArray(listValue).forEach((val: Values): void => {
        convertListTypeOfObjectType(currentLevelInnerType, val)
      })
    }
    if (isObjectType(currentLevelInnerType)) {
      getValueAsArray(listValue).forEach((val: Values): void => {
        convertUserIdentifiers(currentLevelInnerType, val, ownersMap)
      })
    }
  }
  _.values(objectType.fields)
    .forEach(field => {
      const currentValue = values[field.name]
      if (_.isUndefined(currentValue)) {
        return
      }
      const fieldType = field.type
      if (isUserIdentifierType(fieldType)) {
        const numVal = Number(currentValue)
        if (!Number.isNaN(numVal)) {
          values[field.name] = ownersMap.get(numVal) || numVal.toString()
        }
      }
      if (isObjectType(fieldType)) {
        convertUserIdentifiers(fieldType, currentValue, ownersMap)
      }
      if (isListType(fieldType)) {
        const deepInnerType = getDeepInnerType(fieldType)
        if (isUserIdentifierType(deepInnerType)) {
          // Currently all array are represented as a string in HubSpot
          // If there will be "real" array ones we need to support it
          values[field.name] = _.cloneDeepWith(currentValue, (val: Value): string[] | undefined =>
            (_.isString(val) ? val.split(',').map(vals => vals.trim())
              .map(v => ownersMap.get(Number(v)) || v) : undefined))
        }
        if (isObjectType(deepInnerType)) {
          const currentLevelInnerType = fieldType.innerType
          if (isObjectType(currentLevelInnerType)) {
            getValueAsArray(currentValue).forEach((val: Values): void => {
              convertUserIdentifiers(currentLevelInnerType, val, ownersMap)
            })
          }
          if (isListType(currentLevelInnerType)) {
            getValueAsArray(currentValue).forEach((val: Values): void => {
              convertListTypeOfObjectType(currentLevelInnerType, val)
            })
          }
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
    elements
      .filter(isInstanceElement)
      .filter(instance => isObjectType(instance.type))
      .forEach(instance => {
        convertUserIdentifiers(instance.type, instance.value, ownersMap)
      })
  },
})

export default filterCreator
