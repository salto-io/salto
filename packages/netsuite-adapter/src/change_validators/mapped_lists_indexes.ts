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
import _ from 'lodash'
import { collections, values } from '@salto-io/lowerdash'
import { ChangeError, getChangeData, isInstanceChange, isMapType, isObjectType } from '@salto-io/adapter-api'
import { INDEX } from '../constants'
import { getMappedLists, MappedList } from '../mapped_lists/utils'
import { NetsuiteChangeValidator } from './types'

const { isDefined } = values

const { awu } = collections.asynciterable

const toChangeErrors = async ({ field, path, value }: MappedList): Promise<ChangeError[]> => {
  const fieldType = await field.getType()
  const innerFieldType = isMapType(fieldType) && (await fieldType.getInnerType())
  if (isObjectType(innerFieldType) && innerFieldType.fields[INDEX] === undefined) {
    return []
  }

  const items = Object.entries(value)
  const indexes = new Set(_.range(items.length))

  return items
    .map(([key, item]) => {
      const keyElemID = path.createNestedID(key)
      if (item[INDEX] === undefined) {
        return {
          elemID: keyElemID,
          severity: 'Warning' as const,
          message:
            'The missing index value will be set to the end of the list in the next fetch. No action item is required.',
          detailedMessage: `The index value of ${key} is missing, we will set it to ${items.length} in the next fetch. No action item is required.`,
        }
      }
      if (!_.isInteger(item[INDEX])) {
        return {
          elemID: keyElemID,
          severity: 'Warning' as const,
          message: 'The index value will be changed in the next fetch. No action item is required.',
          detailedMessage: `The index value of ${key} is not an integer, we will change it in the next fetch to a valid integer value. No action item is required.`,
        }
      }
      if (item[INDEX] < 0 || item[INDEX] >= items.length) {
        return {
          elemID: keyElemID,
          severity: 'Warning' as const,
          message: 'The index value will be changed in the next fetch. No action item is required.',
          detailedMessage: `The index value of ${key} is out of range, we will change it in the next fetch to a valid integer value. No action item is required.`,
        }
      }
      if (!indexes.has(item[INDEX])) {
        return {
          elemID: path,
          severity: 'Warning' as const,
          message: 'The index value is not unique and will be changed in the next fetch. No action item is required.',
          detailedMessage: `The index value of ${key} is not unique. We will sort the elements in ${field.name} that share the index ${item[INDEX]} by their key name, and change their index in the next fetch. No action item is required.`,
        }
      }
      indexes.delete(item[INDEX])
      return undefined
    })
    .filter(isDefined)
}

const changeValidator: NetsuiteChangeValidator = async changes =>
  awu(changes).filter(isInstanceChange).map(getChangeData).flatMap(getMappedLists).flatMap(toChangeErrors).toArray()

export default changeValidator
