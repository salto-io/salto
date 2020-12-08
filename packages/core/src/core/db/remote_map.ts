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
import { serialization } from '@salto-io/workspace'
import { promisify } from 'util'

const { serialize, deserialize } = serialization
const BATCH_WRITE_INTERVAL = 1000

type RemoteMap = {
  get: (key: ElemID) => Promise<Element>
  getAll: () => AsyncIterator<Element>
  set: (key: ElemID, element: Element) => Promise<void>
  putAll: (elements: AsyncIterable<Element>) => Promise<void>
  list: () => AsyncIterator<ElemID>
}

type RocksDBValue = string | Buffer | undefined

export const createRemoteMap = async (namespace: string): Promise<RemoteMap> => {
  const db = rocksdb(`/tmp/${namespace}`)
  await promisify(db.open.bind(db))()
  return {
    get: async (key: ElemID): Promise<Element> => new Promise(resolve => {
      db.get(key.getFullName(), async (_error, value) => {
        resolve((await deserialize(value.toString()))[0])
      })
    }),
    getAll: (): AsyncIterator<Element> => {
      const valueIter = db.iterator({ keys: false })
      return {
        next: async () => {
          let done = false
          let curVal: RocksDBValue
          await new Promise<void>(resolve => {
            valueIter.next((_err, _key, value) => {
              done = value === undefined
              curVal = value
              resolve()
            })
          })
          return {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            value: curVal ? (await deserialize(curVal.toString()))[0] : undefined as any,
            done,
          }
        },
      }
    },
    set: async (key: ElemID, element: Element): Promise<void> => new Promise(resolve => {
      db.put(key.getFullName(), serialize([element]), () => { resolve() })
    }),
    putAll: async (elements: AsyncIterable<Element>) => {
      let i = 0
      let batch = db.batch()
      for await (const element of elements) {
        i += 1
        batch.put(element.elemID.getFullName(), serialize([element]))
        if (i % BATCH_WRITE_INTERVAL === 0) {
          await promisify(batch.write.bind(batch))()
          batch = db.batch()
        }
      }
      if (i % BATCH_WRITE_INTERVAL !== 0) {
        await promisify(batch.write.bind(batch))()
      }
    },
    list: () => {
      const keyIter = db.iterator({ values: false })
      return {
        next: async () => {
          let done = false
          let value: RocksDBValue
          await new Promise<void>(resolve => {
            keyIter.next((_err, next) => {
              done = next === undefined
              value = next
              resolve()
            })
          })
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
