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
import { generateElements, defaultParams } from '@salto-io/dummy-adapter'
import { ElemID, Element } from '@salto-io/adapter-api'
import rocksdb from 'rocksdb'
import { promisify } from 'util'
import { createRemoteMap, RemoteMap, DB_LOCATION } from '../../../src/core/db/remote_map'

const createElements = (): Element[] => {
  const params = Object.assign(defaultParams)
  params.numOfRecords = 1
  params.numOfObjs = 1
  params.numOfPrimitiveTypes = 1
  params.numOfTypes = 1
  const generatedElements = generateElements(params)
  const elements = generatedElements.slice(0, generatedElements.length - 1)
  return elements
}

let remoteMap: RemoteMap

describe('test operations on remote db', () => {
  const elements = createElements()
  beforeEach(async () => {
    remoteMap = await createRemoteMap(Math.random().toString(36).substring(2, 15))
  })
  afterEach(async () => {
    await remoteMap.revert()
  })

  it('finds an item after it is put', async () => {
    remoteMap.set(elements[0].elemID, elements[0])
    expect(await remoteMap.get(elements[0].elemID)).toEqual(elements[0])
  })

  it('put all and then list finds all keys', async () => {
    async function *createAsyncIterable(iterable: Element[]): AsyncGenerator<Element> {
      for (const elem of iterable) {
        yield elem
      }
    }
    await remoteMap.putAll(await createAsyncIterable(elements))
    const iter = remoteMap.list()
    const res: ElemID[] = []
    for await (const elemId of { [Symbol.asyncIterator]: () => iter }) {
      res.push(elemId)
    }
    expect(res.map(id => id.getFullName()).sort())
      .toEqual(elements.map(elem => elem.elemID.getFullName()).sort())
  })

  it('put all and then getAll finds all values', async () => {
    async function *createAsyncIterable(iterable: Element[]): AsyncGenerator<Element> {
      for (const elem of iterable) {
        yield elem
      }
    }
    await remoteMap.putAll(await createAsyncIterable(elements))
    const iter = remoteMap.getAll()
    const res: Element[] = []
    for await (const element of { [Symbol.asyncIterator]: () => iter }) {
      res.push(element)
    }

    expect(res.map(elem => elem.elemID.getFullName()).sort())
      .toEqual(elements.map(elem => elem.elemID.getFullName()).sort())
  })
})

describe('full integration', () => {
  it('creates keys and values, flushes', async () => {
    remoteMap = await createRemoteMap('integration')
    const elements = createElements()
    await remoteMap.set(elements[0].elemID, elements[0])
    async function *createAsyncIterable(iterable: Element[]): AsyncGenerator<Element> {
      for (const elem of iterable) {
        yield elem
      }
    }
    await remoteMap.putAll(await createAsyncIterable(elements.slice(1, elements.length)))
    await remoteMap.flush()
    const iter = remoteMap.getAll()
    const res: Element[] = []
    for await (const element of { [Symbol.asyncIterator]: () => iter }) {
      res.push(element)
    }
    expect(_.uniq(res.map(elem => elem.elemID.getFullName())).sort()).toEqual(elements
      .map(elem => elem.elemID.getFullName()).sort())
    await remoteMap.close()
    const db = rocksdb(DB_LOCATION)
    await promisify(db.open.bind(db))()
    const ids: string[] = []
    const tempValueIter = db.iterator()
    const iterable = {
      [Symbol.asyncIterator]: () => ({
        next: async () => {
          let done = false
          let keyVal = ''
          await new Promise<void>(resolve => {
            tempValueIter.next((_err, key, _value) => {
              done = key === undefined
              if (!done) {
                keyVal = key.toString()
              }
              resolve()
            })
          })
          return {
            done,
            value: done ? undefined : keyVal,
          }
        },
      }),
    }
    for await (const id of iterable) {
      if (id) {
        ids.push(id)
      }
    }
    expect(ids.sort()).toEqual(elements.map(elem => 'integration_'
      .concat(elem.elemID.getFullName())).sort())
  })
})
afterAll(async () => {
  remoteMap.destroy()
})
