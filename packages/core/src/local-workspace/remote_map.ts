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
import leveldown from 'leveldown'
import rocksdb from 'rocksdb'
import { promisify } from 'util'
import LRU from 'lru-cache'

const LRU_OPTIONS_DEFAULT = { max: 500 }
const NAMESPACE_SEPARATOR = '::'
const TEMP_PREFIX = '~TEMP~'

const BATCH_WRITE_INTERVAL_DEFAULT = 1000

export type RemoteMap<V> = {
  get: (key: string) => Promise<V | undefined>
  getAll: () => AsyncIterator<V>
  set: (key: string, element: V) => Promise<void>
  putAll: (elements: AsyncIterable<V>) => Promise<void>
  list: () => AsyncIterator<string>
  destroy: () => void
  close: () => Promise<void>
  flush: () => Promise<void>
  revert: () => Promise<void>
}

type RocksDBValue = string | Buffer | undefined

const dbConnections: Record<string, rocksdb> = {}

export const createRemoteMap = async <V>(namespace: string, dbLocation: string,
  serialize: (value: V) => string,
  deserialize: (s: string) => Promise<V>,
  valueToKey: (value: V) => string,
  batchInterval = BATCH_WRITE_INTERVAL_DEFAULT,
  lruOptions = LRU_OPTIONS_DEFAULT): Promise<RemoteMap<V>> => {
  if (!/^[a-z0-9]+$/i.test(namespace)) {
    throw new Error(`Invalid namespace: ${namespace}. Must include only alphanumeric characters`)
  }
  const cache = new LRU<string, V>(lruOptions)
  let db: rocksdb
  const keyToDBKey = (key: string): string =>
    namespace.concat(NAMESPACE_SEPARATOR).concat(key)
  const keyToTempDBKey = (key: string): string =>
    TEMP_PREFIX.concat(namespace.concat(NAMESPACE_SEPARATOR).concat(key))
  // We calculate a different key according to whether we're
  // looking for a temp value or a regular value
  const getAppropriateKey = (key: string, temp = false): string =>
    (temp ? keyToTempDBKey(key) : keyToDBKey(key))
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
  const putAllImpl = async (elements: AsyncIterable<V>, temp = true): Promise<void> => {
    let i = 0
    let batch = db.batch()
    for await (const element of elements) {
      i += 1
      cache.set(valueToKey(element), element)
      batch.put(getAppropriateKey(valueToKey(element), temp), serialize(element))
      if (i % batchInterval === 0) {
        await promisify(batch.write.bind(batch))()
        batch = db.batch()
      }
    }
    if (i % batchInterval !== 0) {
      await promisify(batch.write.bind(batch))()
    }
  }
  const getNextValue = async (
    tempDone: boolean,
    tempValueIter: rocksdb.Iterator,
    returnedTempKeys: Set<string>,
    tempOnly: boolean,
    valueIter: rocksdb.Iterator,
    key = false,
  ): Promise<{ tempDone: boolean; curVal: RocksDBValue}> => {
    let curVal: RocksDBValue
    let innerTempDone = tempDone
    if (!innerTempDone) {
      curVal = await readIteratorNext(tempValueIter, key)
      if (curVal === undefined) {
        innerTempDone = true
      } else {
        returnedTempKeys.add(curVal)
      }
    }
    if (innerTempDone && !tempOnly) {
      curVal = await readIteratorNext(valueIter, key)
      while (curVal !== undefined && returnedTempKeys.has(curVal)) {
        // eslint-disable-next-line no-await-in-loop
        curVal = await readIteratorNext(valueIter, key)
      }
    }
    return { tempDone: innerTempDone, curVal }
  }
  const getAllImpl = (tempOnly = false): AsyncIterator<V> => {
    const tempValueIter = createIterator(TEMP_PREFIX
      .concat(namespace.concat(NAMESPACE_SEPARATOR)), false, true)
    const valueIter = createIterator(namespace.concat(NAMESPACE_SEPARATOR), false, true)
    const returnedTempKeys = new Set<string>()
    let tempDone = false
    return {
      next: async () => {
        let curVal: RocksDBValue
        ({ tempDone, curVal } = await getNextValue(tempDone,
          tempValueIter, returnedTempKeys, tempOnly, valueIter))
        return {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          value: curVal ? (await deserialize(curVal.toString())) : undefined as any,
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
  const createDBIfNotCreated = async (loc: string): Promise<void> => {
    if (!(loc in dbConnections)) {
      db = rocksdb(loc)
      dbConnections[loc] = db
      await promisify(db.open.bind(db))()
      await clearImpl(TEMP_PREFIX)
    } else {
      db = dbConnections[loc]
    }
  }
  await createDBIfNotCreated(dbLocation)
  return {
    get: async (key: string): Promise<V | undefined> => new Promise(resolve => {
      if (cache.has(key)) {
        resolve(cache.get(key) as V)
      } else {
        const resolveRet = async (value: Buffer | string): Promise<void> => {
          const ret = (await deserialize(value.toString()))
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
    set: async (key: string, element: V): Promise<void> => {
      cache.set(key, element)
      await promisify(db.put.bind(db))(keyToTempDBKey(key), serialize(element))
    },
    putAll: putAllImpl,
    list: () => {
      const tempKeyIter = createIterator(TEMP_PREFIX
        .concat(namespace.concat(NAMESPACE_SEPARATOR)), true)
      const keyIter = createIterator(namespace.concat(NAMESPACE_SEPARATOR), true)
      let tempDone = false
      let curVal: RocksDBValue
      const returnedTempKeys = new Set<string>()
      return {
        next: async (): Promise<IteratorResult<string, boolean>> => {
          ({ tempDone, curVal } = await getNextValue(tempDone,
            tempKeyIter, returnedTempKeys, false, keyIter, true))
          return {
            value: curVal ? curVal.toString().replace(namespace.concat(NAMESPACE_SEPARATOR), '')
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .replace(TEMP_PREFIX, '') : undefined as any,
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
      leveldown.destroy(dbLocation, _error => {
        // no error handling atm
      })
    },
  }
}
