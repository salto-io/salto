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
import { values } from '@salto-io/lowerdash'
import { Element, ElemID, DetailedChange, getChangeElement } from '@salto-io/adapter-api'
import { filterByID, applyFunctionToChangeData } from '@salto-io/adapter-utils'
import wu from 'wu'
import { getDetailedChanges } from './fetch'

const filterChangesByIDRegex = async (
  changes: DetailedChange[],
  filters: RegExp[]
): Promise<DetailedChange[]> => {
  const filterIDByRegex = (elemID: ElemID): boolean => _.some(
    filters, f => f.test(elemID.getFullName())
  )

  const filterChangeByID = (change: DetailedChange): DetailedChange | undefined => {
    const filteredChange = applyFunctionToChangeData(
      change,
      changeData => filterByID(change.id, changeData, filterIDByRegex),
    )
    return getChangeElement(filteredChange) === undefined
      ? undefined
      : filteredChange
  }

  return _.isEmpty(filters)
    ? changes
    : changes.map(filterChangeByID).filter(values.isDefined)
}

export const createDiffChanges = async (
  toElements: readonly Element[],
  fromElements: Element[],
  idFilters: RegExp[] = [],
): Promise<DetailedChange[]> => filterChangesByIDRegex(
  wu(await getDetailedChanges(toElements, fromElements)).toArray(),
  idFilters
)
