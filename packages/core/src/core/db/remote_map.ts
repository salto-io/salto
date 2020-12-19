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
  const keyToTempDBKey = (key: ElemID): string =>
    TEMP_PREFIX.concat(namespace.concat(NAMESPACE_SEPARATOR).concat(key.getFullName()))
  const putAllImpl = async (elements: AsyncIterable<Element>,
    temp = true): Promise<void> => {
    let i = 0
    let batch = db.batch()
    for await (const element of elements) {
      i += 1
      cache.set(element.elemID, element)
      batch.put(temp ? keyToTempDBKey(element
        .elemID) : keyToDBKey(element.elemID), serialize([element]))
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
    const tempValueIter = db.iterator({
      keys: false,
      gte: TEMP_PREFIX.concat(namespace.concat(NAMESPACE_SEPARATOR)),
      lte: TEMP_PREFIX.concat(namespace
        .concat(String.fromCharCode(NAMESPACE_SEPARATOR.charCodeAt(0) + 1))),
    })
    const valueIter = db.iterator({
      keys: false,
      gte: namespace.concat(NAMESPACE_SEPARATOR),
      lte: namespace.concat(String.fromCharCode(NAMESPACE_SEPARATOR.charCodeAt(0) + 1)),
    })
    let done = false
    let tempDone = false
    return {
      next: async () => {
        let curVal: RocksDBValue
        await new Promise<void>(resolve => {
          if (!tempDone) {
            tempValueIter.next((_err, _key, value) => {
              tempDone = value === undefined
              if (!tempDone) {
                curVal = value
                resolve()
              } else {
                valueIter.next((_innerErr, _innerKey, innerValue) => {
                  done = innerValue === undefined
                  curVal = innerValue
                  resolve()
                })
              }
            })
          } else {
            valueIter.next((_err, _key, value) => {
              done = value === undefined
              curVal = value
              resolve()
            })
          }
        })
        if (tempOnly) {
          done = tempDone
        }
        return {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          value: curVal ? (await deserialize(curVal.toString()))[0] : undefined as any,
          done,
        }
      },
    }
  }
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
    set: async (key: ElemID, element: Element): Promise<void> => new Promise(resolve => {
      cache.set(key, element)
      db.put(keyToTempDBKey(key), serialize([element]), () => { resolve() })
    }),
    putAll: putAllImpl,
    list: () => {
      const tempKeyIter = db.iterator({
        values: false,
        gte: TEMP_PREFIX.concat(namespace.concat(NAMESPACE_SEPARATOR)),
        lte: TEMP_PREFIX.concat(namespace.concat(String
          .fromCharCode(NAMESPACE_SEPARATOR.charCodeAt(0) + 1))),
      })
      const keyIter = db.iterator({
        values: false,
        gte: namespace.concat(NAMESPACE_SEPARATOR),
        lte: namespace.concat(String.fromCharCode(NAMESPACE_SEPARATOR.charCodeAt(0) + 1)),
      })
      let done = false
      let tempDone = false
      return {
        next: async () => {
          let value: RocksDBValue
          await new Promise<void>(resolve => {
            if (!tempDone) {
              tempKeyIter.next((_err, next) => {
                tempDone = next === undefined
                if (!tempDone) {
                  value = next
                  resolve()
                } else {
                  keyIter.next((_innerErr, innerNext) => {
                    done = innerNext === undefined
                    value = innerNext
                    resolve()
                  })
                }
              })
            } else {
              keyIter.next((_err, next) => {
                done = next === undefined
                value = next
                resolve()
              })
            }
          })
          return {
            value: value ? ElemID.fromFullName(value.toString().replace(namespace.concat(NAMESPACE_SEPARATOR), '')
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .replace(TEMP_PREFIX, '')) : undefined as any,
            done,
          }
        },
      }
    },
    flush: async () => {
      await putAllImpl({ [Symbol.asyncIterator]: () => getAllImpl(true) }, false)
      return new Promise<void>(resolve => {
        db.clear({
          gte: TEMP_PREFIX,
          lte: TEMP_PREFIX.substring(0, TEMP_PREFIX.length - 1).concat(String
            .fromCharCode(TEMP_PREFIX[TEMP_PREFIX.length - 1].charCodeAt(0) + 1)),
        }, () => {
          resolve()
        })
      })
    },
    close: () => promisify(db.close.bind(db))(),
    destroy: () => {
      leveldown.destroy(DB_LOCATION, _error => {
        // no error handling atm
      })
    },
  }
}
