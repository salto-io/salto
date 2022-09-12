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
  ChangeValidator, getChangeData, isModificationChange, InstanceElement, isInstanceChange,
  ModificationChange,
  ElemID,
  Values,
} from '@salto-io/adapter-api'
// import { collections } from '@salto-io/lowerdash'
import { CUSTOM_LIST, NETSUITE } from '../constants'

// const { makeArray } = collections.array

const isCustomListChange = (change: ModificationChange<InstanceElement>): boolean =>
  getChangeData(change).refType.elemID.isEqual(new ElemID(NETSUITE, CUSTOM_LIST))

const hasItemRemoval = (change: ModificationChange<InstanceElement>): boolean => {
  const beforeCustomList: Record<string, Values> = change.data.before.value.customvalues
    ?.customvalue
  const afterCustomList: Record<string, Values> = change.data.after.value.customvalues?.customvalue
  const afterItemsScriptIds = new Set(
    Object.entries(afterCustomList).map(item => item[1].scriptid)
  )
  const beforeItems = Object.entries(beforeCustomList)
  return beforeItems.some(beforeItem => !afterItemsScriptIds.has(beforeItem[1].scriptid))
}

const changeValidator: ChangeValidator = async changes => (
  changes
    .filter(isModificationChange)
    .filter(isInstanceChange)
    .filter(isCustomListChange)
    .filter(hasItemRemoval)
    .map(getChangeData)
    .map(({ elemID }) => ({
      elemID,
      severity: 'Error',
      message: `Removing customvalue from ${CUSTOM_LIST} is forbidden`,
      detailedMessage: `${elemID.name} has customvalues that were removed`,
    }))
)

export default changeValidator
