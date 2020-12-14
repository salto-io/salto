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
import { Element, DetailedChange, getChangeElement, ElemID } from '@salto-io/adapter-api'
import { ElementSelector, selectElementIdsByTraversal } from '@salto-io/workspace'
import { filterByID, applyFunctionToChangeData, transformElement, TransformFunc } from '@salto-io/adapter-utils'
import wu from 'wu'
import { getDetailedChanges } from './fetch'

const filterChangesByIds = async (
  changes: DetailedChange[],
  ids: string[],
): Promise<DetailedChange[]> => {
  const filterChangeByID = (change: DetailedChange): DetailedChange | undefined => {
    const filteredChange = applyFunctionToChangeData(
      change,
      changeData => filterByID(change.id, changeData,
        id => ids.some(relevantId => (relevantId === id.getFullName()
          || ElemID.fromFullName(relevantId).isParentOf(id)))),
    )
    return getChangeElement(filteredChange) === undefined
      ? undefined
      : filteredChange
  }
  return changes.map(filterChangeByID).filter(values.isDefined)
}

export const createDiffChanges = async (
  toElements: readonly Element[],
  fromElements: Element[],
  elementSelectors: ElementSelector[] = [],
): Promise<DetailedChange[]> => {
  if (elementSelectors.length > 0) {
    const toElementIdsFiltered = selectElementIdsByTraversal(elementSelectors,
      toElements.map(element => ({ elemID: element.elemID, element })), true)
    const fromElementIdsFiltered = selectElementIdsByTraversal(elementSelectors,
      fromElements.map(element => ({ elemID: element.elemID, element })), true)
    const allRelevantIds = _.uniq(toElementIdsFiltered
      .concat(fromElementIdsFiltered).map(id => id.getFullName()))
    const selectorsToVerify = new Set<string>(elementSelectors
      .map(sel => sel.origin).filter(sel => !sel.includes('*')))
    const verifySelectors: TransformFunc = ({ path, value }) => {
      if (path !== undefined) {
        const id = path.getFullName()
        if (selectorsToVerify.has(id)) {
          selectorsToVerify.delete(id)
        }
        return value
      }
      return undefined
    }
    toElements.forEach(elem => {
      if (selectorsToVerify.has(elem.elemID.getFullName())) {
        selectorsToVerify.delete(elem.elemID.getFullName())
      }
      transformElement({ element: elem, transformFunc: verifySelectors })
    })
    fromElements.forEach(elem => {
      if (selectorsToVerify.has(elem.elemID.getFullName())) {
        selectorsToVerify.delete(elem.elemID.getFullName())
      }
      transformElement({ element: elem, transformFunc: verifySelectors })
    })
    if (selectorsToVerify.size > 0) {
      throw new Error(`ids not found: ${Array.from(selectorsToVerify)}`)
    }
    return filterChangesByIds(wu(await getDetailedChanges(toElements, fromElements))
      .toArray(), allRelevantIds)
  }
  return wu(await getDetailedChanges(toElements, fromElements)).toArray()
}
