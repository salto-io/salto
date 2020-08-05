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
import { Element, ElemID, DetailedChange } from '@salto-io/adapter-api'
import { filterByID } from '@salto-io/adapter-utils'
import wu from 'wu'
import { getDetailedChanges } from './fetch'

const filterChangesByIDRegex = async (
  changes: DetailedChange[],
  filters: RegExp[]
): Promise<DetailedChange[]> => {
  const filterIDByRegex = async (elemID: ElemID): Promise<boolean> => _.some(
    filters, f => f.test(elemID.getFullName())
  )

  const filterChangeByID = async (change: DetailedChange): Promise<DetailedChange | undefined> => {
    if (change.action === 'add') {
      const data = { after: await filterByID(change.id, change.data.after, filterIDByRegex) }
      return _.isEmpty(data.after) ? undefined : { ...change, data }
    }
    if (change.action === 'remove') {
      const data = { before: await filterByID(change.id, change.data.before, filterIDByRegex) }
      return _.isEmpty(data.before) ? undefined : { ...change, data }
    }
    const data = {
      before: await filterByID(change.id, change.data.before, filterIDByRegex),
      after: await filterByID(change.id, change.data.after, filterIDByRegex),
    }
    return _.isEmpty(data.before) && _.isEmpty(data.after) ? undefined : { ...change, data }
  }

  return _.isEmpty(filters)
    ? changes
    : _.compact(await Promise.all(changes.map(filterChangeByID)))
}

export const createDiffChanges = async (
  toElements: readonly Element[],
  fromElements: Element[],
  idFilters: RegExp[] = [],
): Promise<DetailedChange[]> => filterChangesByIDRegex(
  wu(await getDetailedChanges(toElements, fromElements)).toArray(),
  idFilters
)
