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
import { Element, DetailedChange, ElemID } from '@salto-io/adapter-api'
import { ElementSelector, selectElementIdsByTraversal } from '@salto-io/workspace'
import { transformElement, TransformFunc } from '@salto-io/adapter-utils'
import wu from 'wu'
import { getDetailedChanges } from './fetch'

const isIdRelevant = (elementIds: ElemID[], id: ElemID): boolean =>
  elementIds.some(elemId => id.isParentOf(elemId) || elemId.getFullName() === id.getFullName())

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
    const filterElements = (elementIds: ElemID[]): TransformFunc => ({ path, value }) => {
      if (path !== undefined) {
        const id = path.getFullName()
        selectorsToVerify.delete(id)
        if (isIdRelevant(elementIds, path)) {
          return value
        }
      }
      return undefined
    }
    const toElementsFiltered = toElements.filter(elem => isIdRelevant(toElementIdsFiltered,
      elem.elemID)).map(elem => {
      selectorsToVerify.delete(elem.elemID.getFullName())
      return transformElement({
        element: elem,
        transformFunc: filterElements(toElementIdsFiltered),
      })
    })
    const fromElementsFiltered = fromElements.filter(elem => isIdRelevant(fromElementIdsFiltered,
      elem.elemID)).map(elem => {
      selectorsToVerify.delete(elem.elemID.getFullName())
      return transformElement({
        element: elem,
        transformFunc: filterElements(fromElementIdsFiltered),
      })
    })
    if (selectorsToVerify.size > 0) {
      throw new Error(`ids not found: ${Array.from(selectorsToVerify)}`)
    }
    return wu(await getDetailedChanges(toElementsFiltered, fromElementsFiltered)).toArray()
  }
  return wu(await getDetailedChanges(toElements, fromElements)).toArray()
}
