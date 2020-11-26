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
import { values, collections } from '@salto-io/lowerdash'
import { Element, DetailedChange, getChangeElement } from '@salto-io/adapter-api'
import { ElementSelector, selectElementsBySelectors } from '@salto-io/workspace'
import { filterByID, applyFunctionToChangeData } from '@salto-io/adapter-utils'
import wu from 'wu'
import { getDetailedChanges } from './fetch'


const { awu } = collections.asynciterable

const filterChangesBySelectors = async (
  changes: DetailedChange[],
  selectors: ElementSelector[]
): Promise<DetailedChange[]> => {
  const changeIds = await awu(
    (await selectElementsBySelectors(awu(changes).map(change => change.id), selectors)).elements
  ).toArray()
  const filterChangeByID = (change: DetailedChange): DetailedChange | undefined => {
    const filteredChange = applyFunctionToChangeData(
      change,
      changeData => filterByID(change.id, changeData, id => changeIds.includes(id)),
    )
    return getChangeElement(filteredChange) === undefined
      ? undefined
      : filteredChange
  }
  return _.isEmpty(selectors)
    ? changes
    : changes.map(filterChangeByID).filter(values.isDefined)
}

export const createDiffChanges = async (
  toElements: readonly Element[],
  fromElements: Element[],
  elementSelectors: ElementSelector[] = [],
): Promise<DetailedChange[]> => filterChangesBySelectors(
  wu(await getDetailedChanges(toElements, fromElements)).toArray(),
  elementSelectors
)
