/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { ElemID, DetailedChange, isRemovalChange, toChange, getChangeData, Element } from '@salto-io/adapter-api'
import { filterByID, applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { pathIndex, filterByPathHint, ElementSelector, elementSource, remoteMap } from '@salto-io/workspace'
import { createDiffChanges } from './diff'
import { ChangeWithDetails } from './plan/plan_item'

const { awu } = collections.asynciterable

const splitDetailedChangeByPath = async (
  change: DetailedChange,
  index: pathIndex.PathIndex
): Promise<DetailedChange[]> => {
  const changeHints = await pathIndex.getFromPathIndex(change.id, index)
  if (_.isEmpty(changeHints) || isRemovalChange(change)) {
    return [change]
  }
  return Promise.all(changeHints.map(async hint => {
    const filteredChange = await applyFunctionToChangeData(
      change,
      async changeData => filterByID(change.id, changeData, id => filterByPathHint(index, hint, id)),
    )
    return {
      ...filteredChange,
      path: hint,
    }
  }))
}

export function createRestoreChanges(
  workspaceElements: elementSource.ElementsSource,
  state: elementSource.ElementsSource,
  index: remoteMap.RemoteMap<pathIndex.Path[]>,
  referenceSourcesIndex: remoteMap.ReadOnlyRemoteMap<ElemID[]>,
  elementSelectors: ElementSelector[] | undefined,
  accounts: readonly string[] | undefined,
  resultType: 'changes'
): Promise<ChangeWithDetails[]>
export function createRestoreChanges(
  workspaceElements: elementSource.ElementsSource,
  state: elementSource.ElementsSource,
  index: remoteMap.RemoteMap<pathIndex.Path[]>,
  referenceSourcesIndex: remoteMap.ReadOnlyRemoteMap<ElemID[]>,
  elementSelectors?: ElementSelector[],
  accounts?: readonly string[],
  resultType?: 'detailedChanges'
): Promise<DetailedChange[]>
export async function createRestoreChanges(
  workspaceElements: elementSource.ElementsSource,
  state: elementSource.ElementsSource,
  index: remoteMap.RemoteMap<pathIndex.Path[]>,
  referenceSourcesIndex: remoteMap.ReadOnlyRemoteMap<ElemID[]>,
  elementSelectors: ElementSelector[] = [],
  accounts?: readonly string[],
  resultType: 'changes' | 'detailedChanges' = 'detailedChanges'
): Promise<DetailedChange[] | ChangeWithDetails[]> {
  if (resultType === 'changes') {
    const changes = await createDiffChanges(
      workspaceElements,
      state,
      referenceSourcesIndex,
      elementSelectors,
      [id => (accounts?.includes(id.adapter) ?? true) || id.adapter === ElemID.VARIABLES_NAMESPACE],
      'changes'
    )
    return awu(changes)
      .map(async change => {
        const detailedChangesByPath = (await Promise.all(
          change.detailedChanges()
            .map(detailedChange => splitDetailedChangeByPath(detailedChange, index))
        )).flat()
        return { ...change, detailedChanges: () => detailedChangesByPath }
      })
      .toArray()
  }

  const detailedChanges = await createDiffChanges(
    workspaceElements,
    state,
    referenceSourcesIndex,
    elementSelectors,
    [id => (accounts?.includes(id.adapter) ?? true) || id.adapter === ElemID.VARIABLES_NAMESPACE],
    'detailedChanges'
  )
  return awu(detailedChanges)
    .flatMap(change => splitDetailedChangeByPath(change, index))
    .toArray()
}

export const createRestorePathChanges = async (
  elements: Element[],
  index: remoteMap.RemoteMap<pathIndex.Path[]>,
  accounts?: string[],
): Promise<DetailedChange[]> => {
  const relevantElements = elements
    .filter(element => accounts === undefined || accounts.includes(element.elemID.adapter))
  const removalChanges = relevantElements.map(element => ({
    ...toChange({ before: element }),
    id: element.elemID,
  }))

  const additionChanges = await awu(relevantElements)
    .map(element => toChange({ after: element }))
    .flatMap(change => splitDetailedChangeByPath(
      {
        ...change,
        id: getChangeData(change).elemID,
      },
      index
    ))
    .toArray()

  return removalChanges.concat(additionChanges)
}
