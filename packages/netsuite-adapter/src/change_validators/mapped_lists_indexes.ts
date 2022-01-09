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
import { collections, values } from '@salto-io/lowerdash'
import {
  ChangeError, ChangeValidator, getChangeData, isInstanceChange,
} from '@salto-io/adapter-api'
import { INDEX } from '../constants'
import { getMappedLists, MappedList } from '../mapped_lists/mapped_lists'

const { isDefined } = values

const { awu } = collections.asynciterable

const toChangeErrors = (
  { path, value }: MappedList
): ChangeError[] => {
  const items = Object.entries(value)
  const indexes = new Set(_.range(items.length))

  return items.map(([key, item]) => {
    const keyElemID = path.createNestedID(key)
    if (item[INDEX] === undefined) {
      return { elemID: keyElemID, errorMessage: `${key} has no 'index' attribute` }
    }
    if (!_.isInteger(item[INDEX])) {
      return { elemID: keyElemID, errorMessage: 'index is not an integer' }
    }
    if (item[INDEX] < 0 || item[INDEX] >= items.length) {
      return { elemID: keyElemID, errorMessage: 'index is out of range' }
    }
    if (!indexes.has(item[INDEX])) {
      return { elemID: path, errorMessage: `some items has the same index value (index = ${item[INDEX]})` }
    }
    indexes.delete(item[INDEX])
    return undefined
  }).filter(isDefined)
    .map(({ elemID, errorMessage }) => ({
      elemID,
      severity: 'Error',
      message: 'invalid index attribute in a mapped list',
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
