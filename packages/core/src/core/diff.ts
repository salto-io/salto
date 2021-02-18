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
import { ElementSelector, selectElementIdsByTraversal, elementSource } from '@salto-io/workspace'
import { transformElement, TransformFunc } from '@salto-io/adapter-utils'
import wu from 'wu'
import { collections } from '@salto-io/lowerdash'
import { getDetailedChanges } from './fetch'
import { IDFilter } from './plan/plan'

const { awu } = collections.asynciterable

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

// This returns an array rather than iterablebecause it's going to be used
// in an inMemElementSource any way
const filterElementsByRelevance = (elements: AsyncIterable<Element>, relevantIds: ElemID[],
  selectorsToVerify: Set<string>): Promise<Element[]> => {
  const topLevelIds = new Set<string>(relevantIds
    .map(id => id.createTopLevelParentID().parent.getFullName()))
  return awu(elements).filter(elem => topLevelIds.has(elem.elemID.getFullName())).map(elem => {
    selectorsToVerify.delete(elem.elemID.getFullName())
    return transformElement({
      element: elem,
      transformFunc: filterRelevantParts(relevantIds, selectorsToVerify),
    })
  }).toArray()
}

export const createDiffChanges = async (
  toElementsSrc: elementSource.ElementsSource,
  fromElementsSrc: elementSource.ElementsSource,
  elementSelectors: ElementSelector[] = [],
  topLevelFilters: IDFilter[] = []
): Promise<DetailedChange[]> => {
  if (elementSelectors.length > 0) {
    const toElements = awu(await toElementsSrc.list())
    const fromElements = awu(await fromElementsSrc.list())
    const toElementIdsFiltered = await awu(await selectElementIdsByTraversal(elementSelectors,
      toElements, toElementsSrc, true)).toArray()
    const fromElementIdsFiltered = await awu(await selectElementIdsByTraversal(elementSelectors,
      fromElements, fromElementsSrc, true)).toArray()
    const selectorsToVerify = new Set<string>(elementSelectors
      .map(sel => sel.origin).filter(sel => !sel.includes('*')))
    const toElementsFiltered = await filterElementsByRelevance(await toElementsSrc.getAll(),
      toElementIdsFiltered, selectorsToVerify)
    const fromElementsFiltered = await filterElementsByRelevance(await fromElementsSrc.getAll(),
      fromElementIdsFiltered, selectorsToVerify)
    if (selectorsToVerify.size > 0) {
      throw new Error(`ids not found: ${Array.from(selectorsToVerify)}`)
    }
    return wu(await getDetailedChanges(
      elementSource.createInMemoryElementSource(toElementsFiltered),
      elementSource.createInMemoryElementSource(fromElementsFiltered),
      topLevelFilters
    )).toArray()
  }
  return wu(await getDetailedChanges(
    toElementsSrc,
    fromElementsSrc,
    topLevelFilters
  )).toArray()
}
