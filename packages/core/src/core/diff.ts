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
import { Element, DetailedChange, ElemID } from '@salto-io/adapter-api'
import { ElementSelector, selectElementIdsByTraversal } from '@salto-io/workspace'
import { transformElement, TransformFunc } from '@salto-io/adapter-utils'
import wu from 'wu'
import { getDetailedChanges } from './fetch'

const isIdRelevant = (relevantIds: ElemID[], id: ElemID): boolean =>
  relevantIds.some(elemId =>
    id.isParentOf(elemId) || elemId.getFullName() === id.getFullName() || elemId.isParentOf(id))

const filterRelevantParts = (elementIds: ElemID[],
  selectorsToVerify: Set<string>): TransformFunc => ({ path, value }) => {
  if (path !== undefined) {
    const id = path.getFullName()
    selectorsToVerify.delete(id)
    if (isIdRelevant(elementIds, path)) {
      return value
    }
  }
  return undefined
}

const filterElementsByRelevance = (elements: Element[], relevantIds: ElemID[],
  selectorsToVerify: Set<string>): Element[] => {
  const topLevelIds = new Set<string>(relevantIds
    .map(id => id.createTopLevelParentID().parent.getFullName()))
  return elements.filter(elem => topLevelIds.has(elem.elemID.getFullName())).map(elem => {
    selectorsToVerify.delete(elem.elemID.getFullName())
    return transformElement({
      element: elem,
      transformFunc: filterRelevantParts(relevantIds, selectorsToVerify),
    })
  })
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
    const selectorsToVerify = new Set<string>(elementSelectors
      .map(sel => sel.origin).filter(sel => !sel.includes('*')))
    const toElementsFiltered = filterElementsByRelevance([...toElements],
      toElementIdsFiltered, selectorsToVerify)
    const fromElementsFiltered = filterElementsByRelevance(fromElements,
      fromElementIdsFiltered, selectorsToVerify)
    if (selectorsToVerify.size > 0) {
      throw new Error(`ids not found: ${Array.from(selectorsToVerify)}`)
    }
    return wu(await getDetailedChanges(toElementsFiltered, fromElementsFiltered)).toArray()
  }
  return wu(await getDetailedChanges(toElements, fromElements)).toArray()
}
