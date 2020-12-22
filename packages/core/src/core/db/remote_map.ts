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
import leveldown from 'leveldown'
import rocksdb from 'rocksdb'
import { serialization } from '@salto-io/workspace'
import { promisify } from 'util'
import LRU from 'lru-cache'

const LRU_OPTIONS = { max: 500 }
export const DB_LOCATION = '/tmp/salto_db'
const NAMESPACE_SEPARATOR = '_'
const TEMP_PREFIX = 'TEMP'

const { serialize, deserialize } = serialization
const BATCH_WRITE_INTERVAL = 1000

export type RemoteMap = {
  get: (key: ElemID) => Promise<Element | undefined>
  getAll: () => AsyncIterator<Element>
  set: (key: ElemID, element: Element) => Promise<void>
  putAll: (elements: AsyncIterable<Element>) => Promise<void>
  list: () => AsyncIterator<ElemID>
  destroy: () => void
  close: () => Promise<void>
  flush: () => Promise<void>
  revert: () => Promise<void>
}

type RocksDBValue = string | Buffer | undefined
let dbCreated = false
let db: rocksdb

export const createRemoteMap = async (namespace: string): Promise<RemoteMap> => {
  const cache = new LRU<ElemID, Element>(LRU_OPTIONS)
  const keyToDBKey = (key: ElemID): string =>
    namespace.concat(NAMESPACE_SEPARATOR).concat(key.getFullName())
  const keyToTempDBKey = (key: ElemID): string =>
    TEMP_PREFIX.concat(namespace.concat(NAMESPACE_SEPARATOR).concat(key.getFullName()))
  const getAppropriateKey = (element: Element, temp = false): string =>
    (temp ? keyToTempDBKey(element.elemID) : keyToDBKey(element.elemID))
  const getPrefixEndCondition = (prefix: string): string => prefix
    .substring(0, prefix.length - 1).concat((String
      .fromCharCode(prefix.charCodeAt(prefix.length - 1) + 1)))
  const createIterator = (prefix: string, keys = false,
    values = false): rocksdb.Iterator => db.iterator({
    keys,
    values,
    gte: prefix,
    lte: getPrefixEndCondition(prefix),
  })
  const readIteratorNext = (iterator: rocksdb
    .Iterator, retrieveKey: boolean): Promise<string | undefined> =>
    new Promise<string | undefined>(resolve => {
      const callback = (_err: Error | undefined, key: RocksDBValue, value: RocksDBValue): void => {
        if (retrieveKey) {
          resolve(key?.toString())
        } else {
          resolve(value?.toString())
        }
      }
      iterator.next(callback)
    })
  const putAllImpl = async (elements: AsyncIterable<Element>,
    temp = true): Promise<void> => {
    let i = 0
    let batch = db.batch()
    for await (const element of elements) {
      i += 1
      cache.set(element.elemID, element)
      batch.put(getAppropriateKey(element, temp), serialize([element]))
      if (i % BATCH_WRITE_INTERVAL === 0) {
        await promisify(batch.write.bind(batch))()
        batch = db.batch()
      }
    }
    if (i % BATCH_WRITE_INTERVAL !== 0) {
      await promisify(batch.write.bind(batch))()
    }
  }
  const getAllImpl = (tempOnly = false): AsyncIterator<Element> => {
    const tempValueIter = createIterator(TEMP_PREFIX
      .concat(namespace.concat(NAMESPACE_SEPARATOR)), false, true)
    const valueIter = createIterator(namespace.concat(NAMESPACE_SEPARATOR), false, true)
    let tempDone = false
    return {
      next: async () => {
        let curVal: RocksDBValue
        if (!tempDone) {
          curVal = await readIteratorNext(tempValueIter, false)
          if (curVal === undefined) {
            tempDone = true
          }
        }
        if (tempDone && !tempOnly) {
          curVal = await readIteratorNext(valueIter, false)
        }
        return {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          value: curVal ? (await deserialize(curVal.toString()))[0] : undefined as any,
          done: curVal === undefined,
        }
      },
    }
  }
  const clearImpl = (prefix: string): Promise<void> => new Promise<void>(resolve => {
    db.clear({
      gte: prefix,
      lte: getPrefixEndCondition(prefix),
    }, () => {
      resolve()
    })
  })
  const createDBIfNotCreated = async (): Promise<void> => {
    if (!dbCreated) {
      dbCreated = true
      db = rocksdb(DB_LOCATION)
      await promisify(db.open.bind(db))()
      await clearImpl(TEMP_PREFIX)
    }
  }
  await createDBIfNotCreated()
  return {
    get: async (key: ElemID): Promise<Element | undefined> => new Promise(resolve => {
      if (cache.has(key)) {
        resolve(cache.get(key) as Element)
      } else {
        const resolveRet = async (value: Buffer | string): Promise<void> => {
          const ret = (await deserialize(value.toString()))[0]
          cache.set(key, ret)
          resolve(ret)
        }
        db.get(keyToTempDBKey(key), async (error, value) => {
          if (error) {
            db.get(keyToDBKey(key), async (innerError, innerValue) => {
              if (innerError) {
                resolve(undefined)
              } else {
                await resolveRet(innerValue)
              }
            })
          } else {
            await resolveRet(value)
          }
        })
      }
    }),
    getAll: getAllImpl,
    set: async (key: ElemID, element: Element): Promise<void> => {
      cache.set(key, element)
      await promisify(db.put.bind(db))(keyToTempDBKey(key), serialize([element]))
    },
    putAll: putAllImpl,
    list: () => {
      const tempKeyIter = createIterator(TEMP_PREFIX
        .concat(namespace.concat(NAMESPACE_SEPARATOR)), true)
      const keyIter = createIterator(namespace.concat(NAMESPACE_SEPARATOR), true)
      let tempDone = false
      return {
        next: async (): Promise<IteratorResult<ElemID, boolean>> => {
          let curVal: RocksDBValue
          if (!tempDone) {
            curVal = await readIteratorNext(tempKeyIter, true)
            if (curVal === undefined) {
              tempDone = true
            }
          }
          if (tempDone) {
            curVal = await readIteratorNext(keyIter, true)
          }
          return {
            value: curVal ? ElemID.fromFullName(curVal.toString().replace(namespace.concat(NAMESPACE_SEPARATOR), '')
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .replace(TEMP_PREFIX, '')) : undefined as any,
            done: curVal === undefined,
          }
        },
      }
    },
    flush: async () => {
      await putAllImpl({ [Symbol.asyncIterator]: () => getAllImpl(true) }, false)
      await clearImpl(TEMP_PREFIX.concat(namespace).concat(NAMESPACE_SEPARATOR))
    },
    revert: async () => {
      await clearImpl(TEMP_PREFIX.concat(namespace).concat(NAMESPACE_SEPARATOR))
    },
    close: () => promisify(db.close.bind(db))(),
    destroy: () => {
      leveldown.destroy(DB_LOCATION, _error => {
        // no error handling atm
      })
    },
  }
}
