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
import { Field, isListType, isObjectType, MapType, Element, isInstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FilterCreator } from '../filter'

const { awu } = collections.asynciterable

const log = logger(module)

type ListToMapDetails = {
  typeName: string
  fieldToMap: string
  keyPath: string
}

const LIST_TO_MAPS_DETAILS: ListToMapDetails[] = [
  {
    typeName: 'FieldConfiguration',
    fieldToMap: 'fields',
    keyPath: 'id.elemID.name',
  },
]

const replaceFieldTypes = async (elements: Element[]): Promise<void> => {
  await awu(elements)
    .filter(isObjectType)
    .forEach(async type => {
      await awu(LIST_TO_MAPS_DETAILS)
        .filter(({ typeName }) => type.elemID.name === typeName)
        .forEach(async ({ fieldToMap }) => {
          const field = type.fields[fieldToMap]
          if (field === undefined) {
            log.warn(`${type.elemID.getFullName()} does not have ${fieldToMap} field`)
            return
          }

          const fieldType = await field.getType()

          if (isListType(fieldType)) {
            type.fields[fieldToMap] = new Field(
              type,
              fieldToMap,
              new MapType(await fieldType.getInnerType()),
              field.annotations
            )
          } else {
            log.warn(`${fieldToMap} in ${type.elemID.getFullName()} is not a list`)
          }
        })
    })
}

const replaceFieldValues = (elements: Element[]): void => {
  elements
    .filter(isInstanceElement)
    .forEach(instance => {
      LIST_TO_MAPS_DETAILS
        .filter(({ typeName }) => instance.elemID.typeName === typeName)
        .forEach(({ fieldToMap, keyPath }) => {
          if (!Array.isArray(instance.value[fieldToMap])) {
            log.warn(`${fieldToMap} of ${instance.elemID.getFullName()} is not a list`)
            return
          }

          instance.value[fieldToMap] = _.keyBy(instance.value[fieldToMap], keyPath)
        })
    })
}

const filter: FilterCreator = () => ({
  onFetch: async elements => {
    await replaceFieldTypes(elements)
    replaceFieldValues(elements)
  },
})

export default filter
