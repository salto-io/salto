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
import { EventEmitter } from 'pietile-eventemitter'
import _ from 'lodash'
import { Element, ElemID, DetailedChange } from '@salto-io/adapter-api'
import { filterByID } from '@salto-io/adapter-utils'
import wu from 'wu'
import { pathIndex } from '@salto-io/workspace'
import { StepEvents } from './deploy'
import { getDetailedChanges } from './fetch'

type PathIndex = pathIndex.PathIndex

export type RestoreProgressEvents = {
  filtersWillBeCreated: (stepProgress: EventEmitter<StepEvents>) => void
  diffWillBeCalculated: (stepProgress: EventEmitter<StepEvents>) => void
  diffWasCalculated: (detailedChanges: DetailedChange[]) => void
  workspaceWillBeUpdated: (
    stepProgress: EventEmitter<StepEvents>,
    changes: number,
    approved: number
  ) => void
}

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

export const createRestoreChanges = async (
  workspaceElements: readonly Element[],
  stateElements: Element[],
  index: PathIndex,
  idFilters: RegExp[] = [],
  progressEmitter?: EventEmitter<RestoreProgressEvents>
): Promise<DetailedChange[]> => {
  const calculateDiffEmitter = new EventEmitter<StepEvents>()
  if (progressEmitter) {
    progressEmitter.emit('diffWillBeCalculated', calculateDiffEmitter)
  }

  const changes = await filterChangesByIDRegex(
    wu(await getDetailedChanges(workspaceElements, stateElements)).toArray(),
    idFilters
  )
  const detailedChanges = _.flatten(await Promise.all(
    changes.map(change => splitChangeByPath(change, index))
  ))
  if (progressEmitter) {
    progressEmitter.emit('diffWasCalculated', detailedChanges)
  }
  calculateDiffEmitter.emit('completed')
  return detailedChanges
}
