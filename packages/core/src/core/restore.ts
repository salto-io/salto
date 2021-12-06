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
import _ from 'lodash'
import { ElemID, DetailedChange, isRemovalChange } from '@salto-io/adapter-api'
import { filterByID, applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { pathIndex, ElementSelector, elementSource, remoteMap } from '@salto-io/workspace'
import { createDiffChanges } from './diff'

const { awu } = collections.asynciterable

const splitChangeByPath = async (
  change: DetailedChange,
  index: pathIndex.PathIndex
): Promise<DetailedChange[]> => {
  const changeHints = await pathIndex.getFromPathIndex(change.id, index)
  if (_.isEmpty(changeHints) || isRemovalChange(change)) {
    return [change]
  }
  return Promise.all(changeHints.map(async hint => {
    const filterByPathHint = async (id: ElemID): Promise<boolean> => {
      const idHints = await pathIndex.getFromPathIndex(id, index)
      return idHints.some(idHint => _.isEqual(idHint, hint))
    }
    const filteredChange = await applyFunctionToChangeData(
      change,
      async changeData => filterByID(change.id, changeData, filterByPathHint),
    )
    return {
      ...filteredChange,
      path: hint,
    }
  }))
}

export const createRestoreChanges = async (
  workspaceElements: elementSource.ElementsSource,
  state: elementSource.ElementsSource,
  index: remoteMap.RemoteMap<pathIndex.Path[]>,
  referenceSourcesIndex: remoteMap.ReadOnlyRemoteMap<ElemID[]>,
  elementSelectors: ElementSelector[] = [],
  services?: readonly string[]
): Promise<DetailedChange[]> => {
  const changes = await createDiffChanges(
    workspaceElements,
    state,
    referenceSourcesIndex,
    elementSelectors,
    [id => (services?.includes(id.adapter) ?? true) || id.adapter === ElemID.VARIABLES_NAMESPACE],
  )
  const detailedChanges = await awu(changes)
    .flatMap(change => splitChangeByPath(change, index))
    .toArray()
  return detailedChanges
}
