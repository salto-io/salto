/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import {
  DetailedChange,
  Element,
  ElemID,
  getChangeData,
  isAdditionChange,
  isRemovalChange,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { applyDetailedChanges, detailedCompare } from '@salto-io/adapter-utils'
import { getNestedStaticFiles } from '../nacl_files/nacl_file_update'
import { PathIndex, updateTopLevelPathIndex, updatePathIndex } from '../path_index'
import { State, StateData, UpdateStateElementsArgs } from './state'
import { getDanglingStaticFiles } from '../nacl_files/nacl_files_source'

type ThenableIterable<T> = collections.asynciterable.ThenableIterable<T>

const { awu } = collections.asynciterable

const log = logger(module)

type InMemoryState = State & {
  setVersion(version: string): Promise<void>
}

export const buildInMemState = (loadData: () => Promise<StateData>, persistent = true): InMemoryState => {
  let innerStateData: Promise<StateData>
  const stateData = async (): Promise<StateData> => {
    if (innerStateData === undefined) {
      innerStateData = loadData()
    }
    return innerStateData
  }

  const deleteFromFilesSource = async (elements: Element[]): Promise<void> => {
    const files = getNestedStaticFiles(elements)
    await Promise.all(files.map(async file => (await stateData()).staticFilesSource.delete(file)))
  }

  const removeId = async (id: ElemID): Promise<void> => {
    await deleteFromFilesSource([await (await stateData()).elements.get(id)])
    await (await stateData()).elements.delete(id)
  }

  const updateAccounts = async (accounts?: string[]): Promise<void> => {
    const data = await stateData()
    const newAccounts = accounts ?? (await awu(data.accountsUpdateDate.keys()).toArray())
    return data.accountsUpdateDate.setAll(newAccounts.map(s => ({ key: s, value: new Date(Date.now()) })))
  }

  const updateStatePathIndex = async (
    unmergedElements: Element[],
    removedElementsFullNames: Set<string>,
  ): Promise<void> => {
    const currentStateData = await stateData()
    await updateTopLevelPathIndex({
      pathIndex: currentStateData.topLevelPathIndex,
      unmergedElements,
      removedElementsFullNames,
    })
    await updatePathIndex({
      pathIndex: currentStateData.pathIndex,
      unmergedElements,
      removedElementsFullNames,
    })
  }

  const deleteRemovedStaticFiles = async (elemChanges: DetailedChange[]): Promise<void> => {
    const { staticFilesSource } = await stateData()
    const files = getDanglingStaticFiles(elemChanges)
    await Promise.all(files.map(file => staticFilesSource.delete(file)))
  }

  const updateStateElements = async (changes: DetailedChange[]): Promise<void> =>
    log.timeDebug(async () => {
      const state = (await stateData()).elements
      const changesByTopLevelElement = _.groupBy(changes, change =>
        change.id.createTopLevelParentID().parent.getFullName(),
      )
      await awu(Object.values(changesByTopLevelElement)).forEach(async elemChanges => {
        const elemID = elemChanges[0].id
        // If the first change is top level, it means the element was added or removed, and it will include all changes
        if (elemID.isTopLevel()) {
          if (isRemovalChange(elemChanges[0])) {
            await removeId(elemID)
          } else if (isAdditionChange(elemChanges[0])) {
            await state.set(getChangeData(elemChanges[0]))
          }
          return
        }

        // If the first change is not top level, it means this is a modification of an existing element
        // We need to get that element, apply the changes and set it back
        const elemTopLevel = elemID.createTopLevelParentID().parent
        const updatedElem = (await state.get(elemTopLevel)).clone()
        applyDetailedChanges(updatedElem, elemChanges)
        await state.set(updatedElem)
      })
      await deleteRemovedStaticFiles(changes)
    }, 'updateStateElements')

  // Sets the element and delete all the static files that no longer exists on it
  // should not be used in case of regenerate salto ids since it looks only at one element
  const setElement = async (element: Element): Promise<void> => {
    const state = await stateData()
    const beforeElement = await state.elements.get(element.elemID)

    const filesToDelete =
      beforeElement !== undefined ? getDanglingStaticFiles(detailedCompare(beforeElement, element)) : []

    await state.elements.set(element)
    await Promise.all(filesToDelete.map(f => state.staticFilesSource.delete(f)))
  }

  return {
    getAll: async (): Promise<AsyncIterable<Element>> => (await stateData()).elements.getAll(),
    list: async (): Promise<AsyncIterable<ElemID>> => (await stateData()).elements.list(),
    get: async (id: ElemID): Promise<Element | undefined> => (await stateData()).elements.get(id),
    has: async (id: ElemID): Promise<boolean> => (await stateData()).elements.has(id),
    delete: removeId,
    deleteAll: async (ids: ThenableIterable<ElemID>): Promise<void> => {
      await deleteFromFilesSource(
        await awu(ids)
          .map(async id => (await stateData()).elements.get(id))
          .toArray(),
      )
      return (await stateData()).elements.deleteAll(ids)
    },
    set: setElement,
    // This is inefficient, but this shouldn't be used and removing this function is not a small task
    setAll: async (elements: ThenableIterable<Element>): Promise<void> => awu(elements).forEach(setElement),
    remove: removeId,
    isEmpty: async (): Promise<boolean> => (await stateData()).elements.isEmpty(),
    getAccountsUpdateDates: async () => {
      const stateDataVal = await awu((await stateData()).accountsUpdateDate.entries()).toArray()
      return Object.fromEntries(stateDataVal.map(e => [e.key, e.value]))
    },
    existingAccounts: async (): Promise<string[]> => awu((await stateData()).accountsUpdateDate.keys()).toArray(),
    getPathIndex: async (): Promise<PathIndex> => (await stateData()).pathIndex,
    getTopLevelPathIndex: async (): Promise<PathIndex> => (await stateData()).topLevelPathIndex,
    clear: async () => {
      const currentStateData = await stateData()
      await currentStateData.elements.clear()
      await currentStateData.pathIndex.clear()
      await currentStateData.topLevelPathIndex.clear()
      await currentStateData.accountsUpdateDate.clear()
      await currentStateData.saltoMetadata.clear()
      await currentStateData.staticFilesSource.clear()
    },
    flush: async () => {
      if (!persistent) {
        throw new Error('can not flush a non persistent state')
      }
      const currentStateData = await stateData()
      await currentStateData.elements.flush()
      await currentStateData.pathIndex.flush()
      await currentStateData.topLevelPathIndex.flush()
      await currentStateData.accountsUpdateDate.flush()
      await currentStateData.saltoMetadata.flush()
      await currentStateData.staticFilesSource.flush()
    },
    rename: () => Promise.resolve(),
    getHash: async () => (await stateData()).saltoMetadata.get('hash'),
    setHash: async newHash => (await stateData()).saltoMetadata.set('hash', newHash),
    // hash doesn't get calculated in memory
    calculateHash: async () => Promise.resolve(),
    getStateSaltoVersion: async () => (await stateData()).saltoMetadata.get('version'),
    setVersion: async (version: string) => (await stateData()).saltoMetadata.set('version', version),
    updateStateFromChanges: async ({ changes, unmergedElements = [], fetchAccounts }: UpdateStateElementsArgs) => {
      await updateStateElements(changes)
      if (!_.isEmpty(fetchAccounts)) {
        await updateAccounts(fetchAccounts)
      }

      const removedElementsFullNames = new Set(changes.filter(isRemovalChange).map(change => change.id.getFullName()))

      if (unmergedElements.length > 0 || removedElementsFullNames.size > 0) {
        await updateStatePathIndex(unmergedElements, removedElementsFullNames)
      }
    },
    updateConfig: async () => {
      // Currently there is no configuration that affects this implementation
    },
  }
}
