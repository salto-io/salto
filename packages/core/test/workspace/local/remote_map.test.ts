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
import leveldown from 'leveldown'
import { generateElements, defaultParams } from '@salto-io/dummy-adapter'
import { Element, ObjectType, isObjectType } from '@salto-io/adapter-api'
import rocksdb from 'rocksdb'
import { promisify } from 'util'
import { serialization, RemoteMap } from '@salto-io/workspace'
import { createRemoteMap } from '../../../src/local-workspace/remote_map'

const { serialize, deserialize } = serialization

const createElements = async (): Promise<Element[]> => {
  const params = Object.assign(defaultParams)
  params.numOfRecords = 1
  params.numOfObjs = 1
  params.numOfPrimitiveTypes = 1
  params.numOfTypes = 1
  const generatedElements = await generateElements(params)
  const elements = generatedElements.slice(0, generatedElements.length - 1)
  return elements
}

const DB_LOCATION = '/tmp/test_db'

let remoteMap: RemoteMap<Element>

const createMap = async (namespace:
  string): Promise<RemoteMap<Element>> => createRemoteMap<Element>(
    namespace,
    {
      dbLocation: DB_LOCATION,
      batchInterval: 1000,
      LRUSize: 500,
    },
    elem => serialize([elem]),
    async elemStr => (await deserialize(elemStr))[0],
    elem => elem.elemID.getFullName()
  )

async function *createAsyncIterable(iterable: Element[]): AsyncGenerator<Element> {
  for (const elem of iterable) {
    yield elem
  }
}

describe('test operations on remote db', () => {
  let elements: Element[]
  beforeEach(async () => {
    elements = await createElements()
    remoteMap = await createMap(Math.random().toString(36).substring(2, 15))
  })
  afterEach(async () => {
    await remoteMap.revert()
  })

  it('finds an item after it is put', async () => {
    await remoteMap.set(elements[0].elemID.getFullName(), elements[0])
    expect(await remoteMap.get(elements[0].elemID.getFullName())).toEqual(elements[0])
  })

  it('put all and then list finds all keys', async () => {
    await remoteMap.putAll(createAsyncIterable(elements))
    const iter = remoteMap.list()
    const res: string[] = []
    for await (const elemId of iter) {
      res.push(elemId)
    }
    expect(res).toEqual(elements.map(elem => elem.elemID.getFullName()).sort())
  })

  it('when overriden, returns new value', async () => {
    await remoteMap.putAll(createAsyncIterable(elements))
    await remoteMap.flush()
    const cloneElements = elements.map(elem => elem.clone())
    const changedElement = cloneElements[0] as ObjectType
    const changedValue = Object.values(changedElement.fields)[0]
    changedValue.name += 'A CHANGE'
    changedElement.fields = { [Object.keys(changedElement.fields)[0].concat('A CHANGE')]:
      changedValue }
    await remoteMap.set(cloneElements[0].elemID.getFullName(), cloneElements[0])
    const iter = remoteMap.values()
    const res: Element[] = []
    const elemToFieldNameMapping = (elem: Element): string | undefined =>
      (isObjectType(elem) ? Object.values((elem as ObjectType).fields)
        .map(field => field.name).sort().toString() : undefined)
    for await (const element of iter) {
      res.push(element)
    }
    expect(res.map(elemToFieldNameMapping)).toEqual(cloneElements.sort((a, b) =>
      (a.elemID.getFullName() < b.elemID.getFullName() ? -1 : 1))
      .map(elemToFieldNameMapping))
  })

  it('put all and then values finds all values', async () => {
    await remoteMap.putAll(await createAsyncIterable(elements))
    const iter = remoteMap.values()
    const res: Element[] = []
    for await (const element of iter) {
      res.push(element)
    }
    expect(res.map(elem => elem.elemID.getFullName()))
      .toEqual(elements.map(elem => elem.elemID.getFullName()).sort())
  })
})

describe('full integration', () => {
  it('creates keys and values, flushes', async () => {
    remoteMap = await createMap('integration')
    const elements = await createElements()
    await remoteMap.set(elements[0].elemID.getFullName(), elements[0])
    await remoteMap.putAll(await createAsyncIterable(elements.slice(1, elements.length)))
    await remoteMap.flush()
    const iter = remoteMap.values()
    const res: Element[] = []
    for await (const element of iter) {
      res.push(element)
    }
    expect(_.uniq(res.map(elem => elem.elemID.getFullName()))).toEqual(elements
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
      if (id && id.includes('integration::')) {
        ids.push(id)
      }
    }
    expect(ids).toEqual(elements.map(elem => 'integration::'
      .concat(elem.elemID.getFullName())).sort())
  })
})
afterAll(async () => {
  leveldown.destroy(DB_LOCATION, _error => {
    // nothing to do with error
  })
})
