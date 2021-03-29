/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { collections } from '@salto-io/lowerdash'
import { promisify } from 'util'
import { serialization, remoteMap as rm, merger } from '@salto-io/workspace'
import rocksdb from 'rocksdb'
import { createRemoteMapCreator, RocksDBValue } from '../../../src/local-workspace/remote_map'

const { serialize, deserialize } = serialization
const { awu } = collections.asynciterable

const createElements = async (): Promise<Element[]> => {
  const params = Object.assign(defaultParams)
  params.numOfRecords = 1
  params.numOfObjs = 1
  params.numOfPrimitiveTypes = 1
  params.numOfTypes = 1
  const generatedElements = await generateElements(params, {
    reportProgress: jest.fn(),
  })
  const merged = await merger.mergeElements(awu(generatedElements))
  const elements = await awu(merged.merged.values()).toArray()
  // generatedElements.slice(0, generatedElements.length - 1)
  return elements
}

const DB_LOCATION = '/tmp/test_db'

let remoteMap: rm.RemoteMap<Element>

const createMap = async (namespace: string): Promise<rm.RemoteMap<Element>> =>
  createRemoteMapCreator(DB_LOCATION)({
    namespace,
    batchInterval: 1000,
    serialize: elem => serialize([elem]),
    deserialize: async elemStr => ((await deserialize(elemStr)) as Element[])[0],
  })

async function *createAsyncIterable(iterable: Element[]):
AsyncGenerator<rm.RemoteMapEntry<Element, string>> {
  for (const elem of iterable) {
    yield { key: elem.elemID.getFullName(), value: elem }
  }
}

describe('test operations on remote db', () => {
  let elements: Element[]
  let sortedElements: string[]

  beforeEach(async () => {
    elements = await createElements()
    sortedElements = _.sortBy(elements, e => e.elemID.getFullName())
      .map(e => e.elemID.getFullName())
    remoteMap = await createMap(Math.random().toString(36).substring(2, 15))
  })
  afterEach(async () => {
    await remoteMap.revert()
    await remoteMap.close()
  })

  it('finds an item after it is set', async () => {
    await remoteMap.set(elements[0].elemID.getFullName(), elements[0])
    expect(await remoteMap.get(elements[0].elemID.getFullName())).toEqual(elements[0])
  })
  describe('get', () => {
    it('should get an item after it is set', async () => {
      await remoteMap.set(elements[0].elemID.getFullName(), elements[0])
      expect(await remoteMap.get(elements[0].elemID.getFullName())).toEqual(elements[0])
    })

    it('get non existent key', async () => {
      const id = 'not.exist'
      const element = await remoteMap.get(id)
      expect(element).toBeUndefined()
    })
  })
  describe('getMany', () => {
    it('should get an item after it is set', async () => {
      await remoteMap.set(elements[0].elemID.getFullName(), elements[0])
      const anotherElemID = 'dummy.bla'
      await remoteMap.set(anotherElemID, elements[0])
      expect(await remoteMap.getMany([elements[0].elemID.getFullName(), anotherElemID]))
        .toEqual([elements[0], elements[0]])
    })

    it('get non existent key', async () => {
      await remoteMap.set(elements[0].elemID.getFullName(), elements[0])
      const id = 'not.exist'
      expect(await remoteMap.getMany([id, elements[0].elemID.getFullName()]))
        .toEqual([undefined, elements[0]])
    })
  })

  describe('delete', () => {
    it('should delete an item and not find it anymore', async () => {
      const elemID = elements[0].elemID.getFullName()
      await remoteMap.set(elemID, elements[0])
      expect(await remoteMap.get(elemID)).toBeDefined()
      await remoteMap.delete(elemID)
      expect(await remoteMap.get(elemID)).toBeUndefined()
    })

    it('should delete all elements chosen when deleting all', async () => {
      await remoteMap.setAll(createAsyncIterable(elements))
      await remoteMap.deleteAll(awu(createAsyncIterable(elements.slice(1))).map(entry => entry.key))
      const res = await awu(remoteMap.values()).toArray()
      expect(res.map(elem => elem.elemID.getFullName())).toEqual(
        elements.slice(0, 1).map(elem => elem.elemID.getFullName())
      )
    })
  })

  describe('clear', () => {
    it('should clear the remote map', async () => {
      await remoteMap.set(elements[0].elemID.getFullName(), elements[0])
      expect(await awu(remoteMap.keys()).toArray()).not.toHaveLength(0)
      await remoteMap.clear()
      expect(await awu(remoteMap.keys()).toArray()).toHaveLength(0)
    })
  })

  describe('has', () => {
    it('should return true if key exists', async () => {
      await remoteMap.set(elements[0].elemID.getFullName(), elements[0])
      expect(await remoteMap.has(elements[0].elemID.getFullName())).toEqual(true)
    })

    it('should return false if key does not exist', async () => {
      expect(await remoteMap.has('not-exist')).toEqual(false)
    })
  })

  describe('isEmpty', () => {
    it('should return true if the remote map is empty', async () => {
      expect(await remoteMap.isEmpty()).toEqual(true)
    })

    it('should return false if the remote map is not empty', async () => {
      await remoteMap.set(elements[0].elemID.getFullName(), elements[0])
      expect(await remoteMap.isEmpty()).toEqual(false)
    })
  })

  describe('list', () => {
    it('should list all keys', async () => {
      await remoteMap.setAll(createAsyncIterable(elements))
      const iter = remoteMap.keys()
      const res: string[] = []
      for await (const elemId of iter) {
        res.push(elemId)
      }
      expect(res).toEqual(elements.map(elem => elem.elemID.getFullName()).sort())
    })

    it('should list all keys - paginated', async () => {
      await remoteMap.setAll(createAsyncIterable(elements))
      const firstPageRes: string[] = []
      for await (const elemId of remoteMap.keys({ first: 5 })) {
        firstPageRes.push(elemId)
      }
      expect(firstPageRes).toHaveLength(5)
      expect(firstPageRes).toEqual(sortedElements.slice(0, 5))
      const nextPageRes: string[] = []
      const after = firstPageRes[firstPageRes.length - 1]
      for await (const elemId of remoteMap.keys({ first: 5, after })) {
        nextPageRes.push(elemId)
      }
      expect(nextPageRes).toHaveLength(4)
      expect(nextPageRes).toEqual(sortedElements.slice(5))
    })
  })

  describe('values', () => {
    it('should get all values', async () => {
      await remoteMap.setAll(await createAsyncIterable(elements))
      const iter = remoteMap.values()
      const res: Element[] = []
      for await (const element of iter) {
        res.push(element)
      }
      expect(res.map(elem => elem.elemID.getFullName()))
        .toEqual(elements.map(elem => elem.elemID.getFullName()).sort())
    })

    it('should get all values - paginated', async () => {
      await remoteMap.setAll(await createAsyncIterable(elements))
      const firstPageRes: Element[] = []
      for await (const element of remoteMap.values({ first: 5 })) {
        firstPageRes.push(element)
      }
      expect(firstPageRes).toHaveLength(5)
      expect(firstPageRes.map(e => e.elemID.getFullName())).toEqual(sortedElements.slice(0, 5))
      const after = firstPageRes[firstPageRes.length - 1].elemID.getFullName()
      const nextPageRes: Element[] = []
      for await (const element of remoteMap.values({ first: 5, after })) {
        nextPageRes.push(element)
      }
      expect(nextPageRes).toHaveLength(4)
      expect(nextPageRes.map(e => e.elemID.getFullName())).toEqual(sortedElements.slice(5))
    })
  })

  describe('entries', () => {
    it('should get all entries', async () => {
      await remoteMap.setAll(await createAsyncIterable(elements))
      const iter = remoteMap.entries()
      const res: { key: string; value: Element }[] = []
      for await (const element of iter) {
        res.push(element)
      }
      expect(res.map(elem => elem.key))
        .toEqual(elements.map(elem => elem.elemID.getFullName()).sort())
      expect(res.map(elem => elem.value.elemID.getFullName()))
        .toEqual(elements.map(elem => elem.elemID.getFullName()).sort())
    })

    it('should get all entries - paginated', async () => {
      await remoteMap.setAll(await createAsyncIterable(elements))
      const firstPageRes: { key: string; value: Element }[] = []
      for await (const element of remoteMap.entries({ first: 5 })) {
        firstPageRes.push(element)
      }
      expect(firstPageRes).toHaveLength(5)
      expect(firstPageRes.map(e => e.value.elemID.getFullName()))
        .toEqual(sortedElements.slice(0, 5))
      expect(firstPageRes.map(e => e.key)).toEqual(sortedElements.slice(0, 5))
      const after = firstPageRes[firstPageRes.length - 1].key
      const nextPageRes: { key: string; value: Element }[] = []
      for await (const element of remoteMap.entries({ first: 5, after })) {
        nextPageRes.push(element)
      }
      expect(nextPageRes).toHaveLength(4)
      expect(nextPageRes.map(e => e.value.elemID.getFullName())).toEqual(sortedElements.slice(5))
      expect(nextPageRes.map(e => e.key)).toEqual(sortedElements.slice(5))
    })
  })


  it('when overriden, returns new value', async () => {
    await remoteMap.setAll(createAsyncIterable(elements))
    expect(await remoteMap.flush()).toEqual(true)
    expect(await remoteMap.flush()).toEqual(false)
    const cloneElements = elements.map(elem => elem.clone())
    const changedElement = cloneElements[0] as ObjectType
    const changedValue = Object.values(changedElement.fields)[0]
    changedValue.name += 'A CHANGE'
    changedElement.fields = { [Object.keys(changedElement.fields)[0].concat('A CHANGE')]:
      changedValue }
    await remoteMap.set(cloneElements[0].elemID.getFullName(), cloneElements[0])
    const res = await awu(remoteMap.values()).toArray()
    const elemToFieldNameMapping = (elem: Element): string | undefined =>
      (isObjectType(elem) ? Object.values((elem as ObjectType).fields)
        .map(field => field.name).sort().toString() : undefined)
    expect(res.map(elemToFieldNameMapping)).toEqual(cloneElements.sort((a, b) =>
      (a.elemID.getFullName() < b.elemID.getFullName() ? -1 : 1))
      .map(elemToFieldNameMapping))
  })
})

describe('full integration', () => {
  it('creates keys and values, flushes', async () => {
    remoteMap = await createMap('integration')
    const elements = await createElements()
    await remoteMap.set(elements[0].elemID.getFullName(), elements[0])
    await remoteMap.setAll(createAsyncIterable(elements.slice(1, elements.length)))
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
            tempValueIter.next((_err: unknown, key: RocksDBValue, _value: RocksDBValue) => {
              done = key === undefined
              if (!(key === undefined)) {
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
