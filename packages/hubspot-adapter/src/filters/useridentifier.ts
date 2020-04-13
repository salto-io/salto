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
import { Element, isInstanceElement, isObjectType, Values, ObjectType, TypeElement, isListType } from '@salto-io/adapter-api'
import { Owner } from 'src/client/types'
import { Types } from '../transformers/transformer'
import { FilterCreator } from '../filter'

const isUserIdentifierType = (type: TypeElement): boolean =>
  type.elemID.isEqual(Types.userIdentifierType.elemID)

const convertUserIdentifiers = (
  objectType: ObjectType,
  values: Values,
  ownersMap: Map<number, string>
): void => {
  _.values(objectType.fields)
    .forEach(field => {
      const fieldType = field.type
      const currentValue = values[field.name]
      if (_.isUndefined(currentValue)) {
        return
      }
      if (isUserIdentifierType(fieldType)) {
        if (!Number.isNaN(Number(currentValue))) {
          values[field.name] = ownersMap.get(Number(currentValue))
            ? ownersMap.get(Number(currentValue)) : currentValue
          return
        }
      }
      if (isObjectType(fieldType)) {
        convertUserIdentifiers(fieldType, currentValue, ownersMap)
        return
      }
      if (isListType(fieldType)) {
        const objectInnerType = fieldType.innerType
        if (isUserIdentifierType(objectInnerType)) {
          let valuesArray: string[]
          if (_.isArray(currentValue)) {
            valuesArray = currentValue
          } else if (_.isString(currentValue)) {
            valuesArray = currentValue.split(',').map(vals => vals.trim())
          } else {
            valuesArray = []
          }
          values[field.name] = valuesArray.map(val => {
            if (Number.isNaN(Number(val)) || val === '') {
              return val
            }
            return ownersMap.get(Number(val)) || val
          })
          return
        }
        if (isObjectType(objectInnerType)) {
          const valuesArray = _.isArray(currentValue) ? currentValue : [currentValue]
          valuesArray.forEach(val => {
            convertUserIdentifiers(objectInnerType, val, ownersMap)
          })
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
