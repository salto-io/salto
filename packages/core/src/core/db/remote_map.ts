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
import { Element, ElemID } from '@salto-io/adapter-api'
import rocksdb from 'rocksdb'
import levelup from 'levelup'
import { serialization } from '@salto-io/workspace'
import toArray from 'stream-to-array'

const { serialize, deserialize } = serialization
const BATCH_WRITE_INTERVAL = 100

type RemoteMap = {
  get: (key: ElemID) => Promise<Element>
  getAll: () => AsyncIterator<Element>
  getAllByKeys: (keys: ElemID[]) => Promise<Element[]>
  set: (key: ElemID, element: Element) => Promise<void>
  putAll: (elements: AsyncIterable<Element>) => Promise<void>
  list: () => AsyncIterator<ElemID>
}

export const createRemoteMap = (namespace: string): RemoteMap => {
  const db = levelup(rocksdb(`/tmp/${namespace}`))
  return {
    get: async (key: ElemID): Promise<Element> =>
      ((await deserialize(await db.get(key.getFullName()) as string))[0]),
    getAll: (): AsyncIterator<Element> => {
      const valueIter = db.createValueStream()[Symbol.asyncIterator]()
      return {
        next: async () => {
          const { value, done } = await valueIter.next()
          return {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            value: value ? (await deserialize(value.toString()))[0] : undefined as any,
            done,
          }
        },
      }
    },
    getAllByKeys: async (keys: ElemID[]): Promise<Element[]> => {
      const keyStrings = keys.map(key => key.getFullName())
      const entries = (await toArray(db
        .createReadStream())).filter(entry => keyStrings.includes(entry.key.toString()))
      return Promise.all(entries.map(async entry => ((await deserialize(entry
        .value.toString()))[0])))
    },
    set: async (key: ElemID, element: Element): Promise<void> => {
      (await db.put(key.getFullName(), serialize([element])))
    },
    putAll: async (elements: AsyncIterable<Element>) => {
      let i = 0
      let batch = db.batch()
      for await (const element of elements) {
        i += 1
        batch.put(element.elemID.getFullName(), serialize([element]))
        if (i % BATCH_WRITE_INTERVAL === 0) {
          await batch.write()
          batch = db.batch()
        }
      }
      if (i % BATCH_WRITE_INTERVAL !== 0) {
        await batch.write()
      }
    },
    list: () => {
      const keyIter = db.createKeyStream()[Symbol.asyncIterator]()
      return {
        next: async () => {
          const { value, done } = await keyIter.next()
          return {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            value: value ? ElemID.fromFullName(value.toString()) : undefined as any,
            done,
          }
        },
      }
    },
  }
}
