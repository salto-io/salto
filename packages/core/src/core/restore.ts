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
import { pathIndex } from '@salto-io/workspace'
import { createDiffChanges } from './diff'

type PathIndex = pathIndex.PathIndex

const splitChangeByPath = async (
  change: DetailedChange,
  index: PathIndex
): Promise<DetailedChange[]> => {
  const changeHints = _.uniqWith(index.get(change.id.getFullName()), _.isEqual)
  if (_.isEmpty(changeHints)) {
    return [change]
  }
  return Promise.all(changeHints.map(async hint => {
    const filterByPathHint = async (id: ElemID): Promise<boolean> => {
      const idHints = index.get(id.getFullName()) as string[][]
      return _.some(idHints, idHint => _.isEqual(idHint, hint))
    }
    if (change.action === 'add') {
      return {
        ...change,
        data: { after: await filterByID(change.id, change.data.after, filterByPathHint) },
        path: hint,
      } as DetailedChange
    }
    if (change.action === 'remove') {
      return {
        ...change,
        data: { before: await filterByID(change.id, change.data.before, filterByPathHint) },
        path: hint,
      } as DetailedChange
    }
    return {
      ...change,
      data: {
        before: await filterByID(change.id, change.data.before, filterByPathHint),
        after: await filterByID(change.id, change.data.after, filterByPathHint),
      },
      path: hint,
    } as DetailedChange
  }))
}

export const createRestoreChanges = async (
  workspaceElements: readonly Element[],
  stateElements: Element[],
  index: PathIndex,
  idFilters: RegExp[] = [],
): Promise<DetailedChange[]> => {
  const changes = await createDiffChanges(workspaceElements, stateElements, idFilters)
  const detailedChanges = _.flatten(await Promise.all(
    changes.map(change => splitChangeByPath(change, index))
  ))
  return detailedChanges
}
