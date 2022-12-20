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
import _ from 'lodash'
import { collections, values } from '@salto-io/lowerdash'
import {
  ChangeError, ChangeValidator, getChangeData, isInstanceChange, isMapType, isObjectType,
} from '@salto-io/adapter-api'
import { INDEX } from '../constants'
import { getMappedLists, MappedList } from '../mapped_lists/utils'

const { isDefined } = values

const { awu } = collections.asynciterable

const toChangeErrors = async (
  { field, path, value }: MappedList
): Promise<ChangeError[]> => {
  const fieldType = await field.getType()
  const innerFieldType = isMapType(fieldType) && await fieldType.getInnerType()
  if (isObjectType(innerFieldType) && innerFieldType.fields[INDEX] === undefined) {
    return []
  }

  const items = Object.entries(value)
  const indexes = new Set(_.range(items.length))

  return items.map(([key, item]) => {
    const keyElemID = path.createNestedID(key)
    if (item[INDEX] === undefined) {
      return { elemID: keyElemID, errorMessage: `${key} has no 'index' attribute. It is going to be located at the end of the list (index = ${items.length}).` }
    }
    if (!_.isInteger(item[INDEX])) {
      return { elemID: keyElemID, errorMessage: 'Index is not an integer. It will be override by an integer value in the next fetch.' }
    }
    if (item[INDEX] < 0 || item[INDEX] >= items.length) {
      return { elemID: keyElemID, errorMessage: 'Index is out of range. It will be override by an in-range value in the next fetch.' }
    }
    if (!indexes.has(item[INDEX])) {
      return { elemID: path, errorMessage: `Some items has the same index value (index = ${item[INDEX]}). They will be sorted by their key name (${key}).` }
    }
    indexes.delete(item[INDEX])
    return undefined
  }).filter(isDefined)
    .map(({ elemID, errorMessage }) => ({
      elemID,
      severity: 'Warning',
      message: 'Invalid index attribute in a mapped list',
      detailedMessage: errorMessage,
    }))
}

const changeValidator: ChangeValidator = async changes => (
  awu(changes)
    .filter(isInstanceChange)
    .map(getChangeData)
    .flatMap(getMappedLists)
    .flatMap(toChangeErrors)
    .toArray()
)

export default changeValidator
