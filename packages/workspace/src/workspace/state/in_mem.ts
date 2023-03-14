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
import { Element, ElemID } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { getNestedStaticFiles } from '../nacl_files/nacl_file_update'
import {
  updatePathIndex,
  overridePathIndex,
  PathIndex,
  overrideTopLevelPathIndex,
} from '../path_index'
import { RemoteMap } from '../remote_map'
import { State, StateData } from './state'

type ThenableIterable<T> = collections.asynciterable.ThenableIterable<T>

const { awu } = collections.asynciterable

const log = logger(module)

type InMemoryState = State & {
  setVersion(version: string): Promise<void>
}

// This function is temporary for the transition to multiple services.
// Remove this when no longer used, SALTO-1661
const getUpdateDate = (data: StateData): RemoteMap<Date> => {
  if ('servicesUpdateDate' in data) {
    return data.servicesUpdateDate
  }
  return data.accountsUpdateDate
}

export const buildInMemState = (
  loadData: () => Promise<StateData>,
  persistent = true
): InMemoryState => {
  let innerStateData: Promise<StateData>
  const stateData = async (): Promise<StateData> => {
    if (innerStateData === undefined) {
      innerStateData = loadData()
    }
    return innerStateData
  }
  const getAccountsUpdateDates = async (): Promise<Record<string, Date>> => {
    const stateDataVal = await awu(getUpdateDate(await stateData()).entries()).toArray()
    return Object.fromEntries(stateDataVal.map(e => [e.key, e.value]))
  }

  const deleteFromFilesSource = async (elements: Element[]): Promise<void> => {
    const files = getNestedStaticFiles(elements)
    await Promise.all(files.map(async file => (await stateData()).staticFilesSource.delete(file)))
  }

  const removeId = async (id: ElemID): Promise<void> => {
    await deleteFromFilesSource([await (await stateData()).elements.get(id)])
    await (await stateData()).elements.delete(id)
  }

  return {
    getAll: async (): Promise<AsyncIterable<Element>> => (await stateData()).elements.getAll(),
    list: async (): Promise<AsyncIterable<ElemID>> => (await stateData()).elements.list(),
    get: async (id: ElemID): Promise<Element | undefined> => (await stateData()).elements.get(id),
    has: async (id: ElemID): Promise<boolean> => (await stateData()).elements.has(id),
    delete: removeId,
    deleteAll: async (ids: ThenableIterable<ElemID>): Promise<void> => {
      await deleteFromFilesSource(
        await awu(ids).map(async id => (await stateData()).elements.get(id)).toArray()
      )
      return (await stateData()).elements.deleteAll(ids)
    },
    set: async (element: Element): Promise<void> =>
      (await stateData()).elements.set(element),
    setAll: async (elements: ThenableIterable<Element>): Promise<void> =>
      (await stateData()).elements.setAll(elements),
    remove: removeId,
    isEmpty: async (): Promise<boolean> => (await stateData()).elements.isEmpty(),
    override: (elements: AsyncIterable<Element>, accounts?: string[])
      : Promise<void> => log.time(
      async () => {
        const data = await stateData()
        const newAccounts = accounts ?? await awu(getUpdateDate(data).keys()).toArray()

        await data.staticFilesSource.clear()

        await data.elements.overide(elements)
        return getUpdateDate(data).setAll(
          awu(newAccounts.map(s => ({ key: s, value: new Date(Date.now()) })))
        )
      },
      'state override'
    ),
    getAccountsUpdateDates,
    getServicesUpdateDates: getAccountsUpdateDates,
    existingAccounts: async (): Promise<string[]> =>
      awu(getUpdateDate(await stateData()).keys()).toArray(),
    overridePathIndex: async (unmergedElements: Element[]): Promise<void> => {
      const currentStateData = await stateData()
      await overridePathIndex(currentStateData.pathIndex, unmergedElements)
      await overrideTopLevelPathIndex(currentStateData.topLevelPathIndex, unmergedElements)
    },
    updatePathIndex: async (
      unmergedElements: Element[],
      servicesNotToChange: string[]
    ): Promise<void> => {
      const currentStateData = await stateData()
      await updatePathIndex(
        {
          index: currentStateData.pathIndex,
          elements: unmergedElements,
          accountsToMaintain: servicesNotToChange,
          isTopLevel: false,
        }
      )
      await updatePathIndex(
        {
          index: currentStateData.topLevelPathIndex,
          elements: unmergedElements,
          accountsToMaintain: servicesNotToChange,
          isTopLevel: true,
        }
      )
    },
    getPathIndex: async (): Promise<PathIndex> =>
      (await stateData()).pathIndex,
    getTopLevelPathIndex: async (): Promise<PathIndex> =>
      (await stateData()).topLevelPathIndex,
    clear: async () => {
      const currentStateData = await stateData()
      await currentStateData.elements.clear()
      await currentStateData.pathIndex.clear()
      await currentStateData.topLevelPathIndex.clear()
      await getUpdateDate(currentStateData).clear()
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
      await getUpdateDate(currentStateData).flush()
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
  }
}
