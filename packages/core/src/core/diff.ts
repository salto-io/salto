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
import { Element, DetailedChange, ElemID, ReadOnlyElementsSource, isAdditionChange, isRemovalChange, Change } from '@salto-io/adapter-api'
import { ElementSelector, selectElementIdsByTraversal, elementSource } from '@salto-io/workspace'
import { transformElement, TransformFunc } from '@salto-io/adapter-utils'
import wu from 'wu'
import { collections } from '@salto-io/lowerdash'
import { IDFilter, getPlan, Plan } from './plan/plan'
import { filterPlanItem } from './plan/plan_item'

const { awu } = collections.asynciterable

const isIdRelevant = (relevantIds: ElemID[], id: ElemID): boolean =>
  relevantIds.some(elemId =>
    id.isParentOf(elemId) || elemId.getFullName() === id.getFullName() || elemId.isParentOf(id))

const filterRelevantParts = (
  elementIds: ElemID[],
): TransformFunc => ({ path, value }) => {
  if (path !== undefined) {
    if (isIdRelevant(elementIds, path)) {
      return value
    }
  }
  return undefined
}

const filterElementByRelevance = async (
  elem: Element,
  relevantIds: ElemID[],
  topLevelIds: Set<string>,
  elementsSource: ReadOnlyElementsSource
): Promise<Element | undefined> => {
  if (topLevelIds.has(elem.elemID.getFullName())) {
    return transformElement({
      element: elem,
      transformFunc: filterRelevantParts(relevantIds),
      runOnFields: true,
      strict: false,
      elementsSource,
    })
  }
  return undefined
}

const filterPlanItemsByRelevance = async (
  plan: Plan,
  toElementsSrc: elementSource.ElementsSource,
  fromElementsSrc: elementSource.ElementsSource,
  toElementIdsFiltered: ElemID[],
  fromElementIdsFiltered: ElemID[],
): Promise<DetailedChange[]> => {
  const toTopLevelElementIdsFiltered = new Set<string>(toElementIdsFiltered
    .map(id => id.createTopLevelParentID().parent.getFullName()))
  const fromTopLevelElementIdsFiltered = new Set<string>(fromElementIdsFiltered
    .map(id => id.createTopLevelParentID().parent.getFullName()))
  return awu(plan.itemsByEvalOrder())
    .map(item => filterPlanItem(
      item,
      async change => {
        const before = isAdditionChange(change)
          ? undefined : await filterElementByRelevance(
            change.data.before,
            toElementIdsFiltered,
            toTopLevelElementIdsFiltered,
            toElementsSrc
          )
        const after = isRemovalChange(change)
          ? undefined : await filterElementByRelevance(
            change.data.after,
            fromElementIdsFiltered,
            fromTopLevelElementIdsFiltered,
            fromElementsSrc
          )
        if (after === undefined && before === undefined) {
          return undefined
        }
        return {
          ...change,
          data: { before, after },
        } as Change
      }
    ))
    .flatMap(planItem => planItem.detailedChanges())
    .toArray()
}

const getFilteredIds = async (
  elementSelectors: ElementSelector[],
  src: elementSource.ElementsSource
): Promise<ElemID[]> => (
  awu(await selectElementIdsByTraversal(elementSelectors, src, true)).toArray()
)

export const createDiffChanges = async (
  toElementsSrc: elementSource.ElementsSource,
  fromElementsSrc: elementSource.ElementsSource,
  elementSelectors: ElementSelector[] = [],
  topLevelFilters: IDFilter[] = []
): Promise<DetailedChange[]> => {
  const plan = await getPlan({
    before: toElementsSrc,
    after: fromElementsSrc,
    dependencyChangers: [],
    topLevelFilters,
  })

  if (elementSelectors.length > 0) {
    const toElementIdsFiltered = await getFilteredIds(elementSelectors, toElementsSrc)
    const fromElementIdsFiltered = await getFilteredIds(elementSelectors, fromElementsSrc)
    return filterPlanItemsByRelevance(
      plan,
      toElementsSrc,
      fromElementsSrc,
      toElementIdsFiltered,
      fromElementIdsFiltered
    )
  }
  return wu(plan.itemsByEvalOrder())
    .map(item => item.detailedChanges())
    .flatten()
    .toArray()
}
