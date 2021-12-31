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
import { collections } from '@salto-io/lowerdash'
import {
  ChangeError, ChangeValidator, ElemID, getChangeElement, isInstanceChange, Values,
} from '@salto-io/adapter-api'
import { INDEX } from '../constants'
import { getMappedLists } from '../mapped_lists/mapped_lists'

const { awu } = collections.asynciterable

const getIndexesErrorMessages = (
  { path, value }: { path: ElemID; value: Values }
): { elemID: ElemID; errorMessage: string }[] => {
  const items = Object.entries(value)
  const indexes = items.map((_item, index) => index)

  const errorMessages: { elemID: ElemID; errorMessage: string }[] = []
  items.forEach(([key, item]) => {
    if (item[INDEX] === undefined) {
      errorMessages.push({ elemID: path.createNestedID(key), errorMessage: `${key} has no 'index' attribute` })
    } else if (!_.isInteger(item[INDEX])) {
      errorMessages.push({ elemID: path.createNestedID(key), errorMessage: 'index is not an integer' })
    } else if (item[INDEX] < 0 || item[INDEX] >= items.length) {
      errorMessages.push({ elemID: path.createNestedID(key), errorMessage: 'index is out of range' })
    } else if (!indexes.includes(item[INDEX])) {
      errorMessages.push({ elemID: path, errorMessage: `some items has the same index value (index = ${item[INDEX]})` })
    } else {
      _.pull(indexes, item[INDEX])
    }
  })

  return errorMessages
}

const changeValidator: ChangeValidator = async changes => (
  awu(changes)
    .filter(isInstanceChange)
    .map(getChangeElement)
    .flatMap(getMappedLists)
    .flatMap(getIndexesErrorMessages)
    .map(async ({ elemID, errorMessage }): Promise<ChangeError> => ({
      elemID,
      severity: 'Error',
      message: 'invalid index attribute in a mapped list',
      detailedMessage: errorMessage,
    }))
    .toArray()
)

export default changeValidator
