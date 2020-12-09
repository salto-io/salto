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
import LRU from 'lru-cache'

const LRU_OPTIONS = { max: 500 }
const DB_LOCATION = '/tmp/salto_db'
const NAMESPACE_SEPARATOR = '_'

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
let dbCreated = false
let db: rocksdb
const createDBIfNotCreated = async (): Promise<void> => {
  if (!dbCreated) {
    dbCreated = true
    db = rocksdb(DB_LOCATION)
    await promisify(db.open.bind(db))()
  }
}

export const createRemoteMap = async (namespace: string): Promise<RemoteMap> => {
  await createDBIfNotCreated()
  const cache = new LRU<ElemID, Element>(LRU_OPTIONS)
  const keyToDBKey = (key: ElemID): string =>
    namespace.concat(NAMESPACE_SEPARATOR).concat(key.getFullName())
  return {
    get: async (key: ElemID): Promise<Element> => new Promise(resolve => {
      if (cache.has(key)) {
        resolve(cache.get(key) as Element)
      } else {
        db.get(keyToDBKey(key), async (_error, value) => {
          const ret = (await deserialize(value.toString()))[0]
          cache.set(key, ret)
          resolve(ret)
        })
      }
    }),
    getAll: (): AsyncIterator<Element> => {
      const valueIter = db.iterator({
        keys: false,
        gte: namespace.concat(NAMESPACE_SEPARATOR),
        lte: namespace.concat(String.fromCharCode(NAMESPACE_SEPARATOR.charCodeAt(0) + 1)),
      })
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
      cache.set(key, element)
      db.put(keyToDBKey(key), serialize([element]), () => { resolve() })
    }),
    putAll: async (elements: AsyncIterable<Element>) => {
      let i = 0
      let batch = db.batch()
      for await (const element of elements) {
        i += 1
        cache.set(element.elemID, element)
        batch.put(keyToDBKey(element.elemID), serialize([element]))
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
      const keyIter = db.iterator({
        values: false,
        gte: namespace.concat(NAMESPACE_SEPARATOR),
        lte: namespace.concat(String.fromCharCode(NAMESPACE_SEPARATOR.charCodeAt(0) + 1)),
      })
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
            value: value ? ElemID.fromFullName(value.toString().replace(namespace.concat(NAMESPACE_SEPARATOR), '')) : undefined as any,
            done,
          }
        },
      }
    },
  }
}
