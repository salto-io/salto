/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { Element, ObjectType, isObjectType, BuiltinTypes, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { promisify } from 'util'
import { serialization, remoteMap as rm } from '@salto-io/workspace'
import rocksdb from '@salto-io/rocksdb'
import path from 'path'
import { readdirSync, mkdirpSync } from 'fs-extra'
import {
  createRemoteMapCreator,
  createReadOnlyRemoteMap,
  RocksDBValue,
  TMP_DB_DIR,
  cleanDatabases,
  closeAllRemoteMaps,
} from '../../src/remote_map/remote_map'
import { remoteMapLocations } from '../../src/remote_map/location_pool'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const rocksdbImpl = require('../../src/remote_map/rocksdb').default

const { serialize, deserialize } = serialization
const { awu } = collections.asynciterable
const ADAPTER_NAME = 'dummy'
const generateElements = (): Element[] => {
  const HelloType = new ObjectType({
    elemID: new ElemID(ADAPTER_NAME, 'Hello'),
    fields: {
      name: { refType: BuiltinTypes.STRING },
      code: { refType: BuiltinTypes.STRING },
    },
  })
  const ZooBambooType = new ObjectType({
    elemID: new ElemID(ADAPTER_NAME, 'ZooBambooType'),
    fields: {
      country: { refType: BuiltinTypes.STRING },
    },
  })
  const increasedCrimsonEsterType = new ObjectType({
    elemID: new ElemID(ADAPTER_NAME, 'IncreasedCrimsonEster'),
    fields: {
      name: { refType: BuiltinTypes.STRING },
      application: { refType: BuiltinTypes.STRING },
      code: { refType: BuiltinTypes.STRING },
    },
  })

  const instances = [
    new InstanceElement(
      'InstWithStatic',
      HelloType,
      {
        name: 'InstWithStatic',
        code: { flat: 'a', nested: { inner: 'abc' } },
      },
      [ADAPTER_NAME, 'Hello', 'instance', 'InstWithStatic'],
    ),
    new InstanceElement(
      'PartialInst',
      HelloType,
      {
        name: 'PartialInst',
        code: { nested: { inner: 'def', other: 'ghi' } },
      },
      [ADAPTER_NAME, 'Hull', 'instance', 'InstWithStatic'],
    ),
    new InstanceElement('ZooBambooTypeInstYemen', ZooBambooType, {
      country: 'yemen',
    }),
    new InstanceElement('ZooBambooTypeInstIsrael', ZooBambooType, {
      country: 'israel',
    }),
    new InstanceElement('ZooBambooTypeInstRussia', ZooBambooType, {
      country: 'russia',
    }),
    new InstanceElement('ZooBambooTypeInstUkraine', ZooBambooType, {
      country: 'ukraine',
    }),
    new InstanceElement('ZooBambooTypeInstItaly', ZooBambooType, {
      country: 'italy',
    }),
    new InstanceElement('ZooBambooTypeInstFrench', ZooBambooType, {
      country: 'french',
    }),
    new InstanceElement('ColdChocolateDebbi', increasedCrimsonEsterType, {
      name: 'ColdChocolateDebbi',
      code: 'ignore',
    }),
    new InstanceElement('ColdChocolateDeborah', increasedCrimsonEsterType, {
      name: 'ColdChocolateDeborah',
      code: 'ignore',
    }),
    new InstanceElement('ColdChocolateAndTasty', increasedCrimsonEsterType, {
      name: 'ColdChocolateAndTasty',
      code: 'ignore',
    }),
  ]
  const typeWithNoInstances = new ObjectType({
    elemID: new ElemID(ADAPTER_NAME, 'typeWithNoInstances'),
  })
  const typeWithNoInstances2 = new ObjectType({
    elemID: new ElemID(ADAPTER_NAME, 'typeWithNoInstances2'),
  })
  return [HelloType, increasedCrimsonEsterType, ...instances, typeWithNoInstances, typeWithNoInstances2]
}
const DB_LOCATION = '/tmp/test_db'

const createMap = async (
  namespace: string,
  persistent = true,
  location = DB_LOCATION,
): Promise<{ remoteMap: rm.RemoteMap<Element>; close: () => Promise<void> }> => {
  const { create, close } = createRemoteMapCreator(location)
  return {
    close,
    remoteMap: await create({
      namespace,
      batchInterval: 1000,
      serialize: elem => serialize([elem]),
      deserialize: async elemStr => (await deserialize(elemStr))[0],
      persistent,
    }),
  }
}

const createReadOnlyMap = async (namespace: string, location = DB_LOCATION): Promise<rm.RemoteMap<Element>> =>
  createReadOnlyRemoteMap({
    location,
    namespace,
    deserialize: async elemStr => (await deserialize(elemStr))[0],
  })

async function* createAsyncIterable(iterable: Element[]): AsyncGenerator<rm.RemoteMapEntry<Element, string>> {
  for (const elem of iterable) {
    yield { key: elem.elemID.getFullName(), value: elem }
  }
}

describe('test operations on remote db', () => {
  let elements: Element[]
  let sortedElements: string[]
  let filteredSortedElements: string[]
  let remoteMap: rm.RemoteMap<Element>
  let readOnlyRemoteMap: rm.RemoteMap<Element>
  let expectedElementFromMap: Element
  let closeMethod: () => Promise<void>
  const filterFn = (key: string): boolean => key.includes('a')

  beforeEach(async () => {
    elements = generateElements()
    sortedElements = _.sortBy(elements, e => e.elemID.getFullName()).map(e => e.elemID.getFullName())
    filteredSortedElements = sortedElements.filter(filterFn)
    const namespace = 'namespace'
    const result = await createMap(namespace)
    remoteMap = result.remoteMap
    closeMethod = result.close
    await remoteMap.set(elements[0].elemID.getFullName(), elements[0])
    await remoteMap.flush()
    // eslint-disable-next-line prefer-destructuring
    expectedElementFromMap = (await deserialize(await serialize([elements[0]])))[0]
    await result.close()
    const anotherResult = await createMap(namespace)
    closeMethod = anotherResult.close
    remoteMap = anotherResult.remoteMap
    readOnlyRemoteMap = await createReadOnlyMap(namespace)
  })
  afterEach(async () => {
    await closeMethod()
  })

  describe('get', () => {
    it('should get an item that was written to the map in a previous run', async () => {
      expect(await remoteMap.get(elements[0].elemID.getFullName())).toEqual(expectedElementFromMap)
    })
    it('should get an item after it is set', async () => {
      await remoteMap.set(elements[1].elemID.getFullName(), elements[1])
      expect(await remoteMap.get(elements[1].elemID.getFullName())).toEqual(elements[1])
    })
    it('get non existent key', async () => {
      const id = 'not.exist'
      const element = await remoteMap.get(id)
      expect(element).toBeUndefined()
    })
    describe('read only', () => {
      it('should get an item after it is set', async () => {
        const res = await readOnlyRemoteMap.get(elements[0].elemID.getFullName())
        expect(res?.elemID.getFullName()).toEqual(elements[0].elemID.getFullName())
      })
      it('get non existent key', async () => {
        const id = 'not.exist'
        const element = await readOnlyRemoteMap.get(id)
        expect(element).toBeUndefined()
      })
    })
    it('should read from cache in subsequent reads', async () => {
      expect(await remoteMap.get(elements[0].elemID.getFullName())).toEqual(expectedElementFromMap)
      expect(await remoteMap.get(elements[0].elemID.getFullName())).toEqual(expectedElementFromMap)
      expect(await remoteMap.get(elements[0].elemID.getFullName())).toEqual(expectedElementFromMap)
      expect(await remoteMap.get(elements[0].elemID.getFullName())).toEqual(expectedElementFromMap)

      const locationInfo = remoteMapLocations.get(DB_LOCATION)
      expect(locationInfo.counters.LocationCacheMiss.value()).toEqual(1)
      expect(locationInfo.counters.LocationCacheHit.value()).toEqual(3)
      expect(locationInfo.cache.length).toEqual(1)
    })
    it('should read from cache in concurrent reads', async () => {
      const getResults = await Promise.all([
        remoteMap.get(elements[0].elemID.getFullName()),
        remoteMap.get(elements[0].elemID.getFullName()),
        remoteMap.get(elements[0].elemID.getFullName()),
        remoteMap.get(elements[0].elemID.getFullName()),
      ])
      expect(getResults).toEqual([
        expectedElementFromMap,
        expectedElementFromMap,
        expectedElementFromMap,
        expectedElementFromMap,
      ])
      const locationInfo = remoteMapLocations.get(DB_LOCATION)
      expect(locationInfo.counters.LocationCacheMiss.value()).toEqual(1)
      expect(locationInfo.counters.LocationCacheHit.value()).toEqual(3)
      expect(locationInfo.cache.length).toEqual(1)
    })
    it('should read from cache in concurrent reads, after set', async () => {
      await remoteMap.set(elements[1].elemID.getFullName(), elements[1])

      await Promise.all([
        remoteMap.get(elements[1].elemID.getFullName()),
        remoteMap.get(elements[1].elemID.getFullName()),
        remoteMap.get(elements[1].elemID.getFullName()),
        remoteMap.get(elements[1].elemID.getFullName()),
      ])
      const locationInfo = remoteMapLocations.get(DB_LOCATION)
      expect(locationInfo.counters.LocationCacheMiss.value()).toEqual(0)
      expect(locationInfo.counters.LocationCacheHit.value()).toEqual(4)
    })
  })
  describe('getMany', () => {
    it('should get items after set', async () => {
      // await remoteMap.set(elements[0].elemID.getFullName(), elements[0])
      await remoteMap.set(elements[1].elemID.getFullName(), elements[1])
      expect(await remoteMap.getMany([elements[0].elemID.getFullName(), elements[1].elemID.getFullName()])).toEqual([
        expectedElementFromMap,
        elements[1],
      ])
    })

    it('get non existent key', async () => {
      const id = 'not.exist'
      expect(await remoteMap.getMany([id, elements[0].elemID.getFullName()])).toEqual([
        undefined,
        expectedElementFromMap,
      ])
    })
    describe('read only', () => {
      it('should get items after set', async () => {
        const anotherElemID = 'dummy.bla'
        const res = await readOnlyRemoteMap.getMany([elements[0].elemID.getFullName(), anotherElemID])
        expect(res.map(e => e?.elemID?.getFullName())).toEqual([elements[0].elemID.getFullName(), undefined])
      })
    })
  })
  describe('delete', () => {
    it('should delete an item and not find it anymore', async () => {
      const elemID = elements[0].elemID.getFullName()
      expect(await remoteMap.get(elemID)).toBeDefined()
      await remoteMap.delete(elemID)
      expect(await remoteMap.get(elemID)).toBeUndefined()
    })

    it('deleted elements should not be returned from keys', async () => {
      const elemID = elements[0].elemID.getFullName()
      expect(await awu(remoteMap.keys()).toArray()).toContain(elements[0].elemID.getFullName())
      await remoteMap.delete(elemID)
      expect(await awu(remoteMap.keys()).toArray()).not.toContain(elements[0].elemID.getFullName())
    })

    it('deleted elements should not be returned from keys with pages', async () => {
      const elemID = elements[0].elemID.getFullName()
      expect(
        await awu(remoteMap.keys({ pageSize: 2 }))
          .flat()
          .toArray(),
      ).toContain(elements[0].elemID.getFullName())
      await remoteMap.delete(elemID)
      expect(
        await awu(remoteMap.keys({ pageSize: 2 }))
          .flat()
          .toArray(),
      ).not.toContain(elements[0].elemID.getFullName())
    })

    it('should delete all elements chosen when deleting all', async () => {
      await remoteMap.setAll(createAsyncIterable(elements))
      await remoteMap.deleteAll(awu(createAsyncIterable(elements.slice(1))).map(entry => entry.key))
      const res = await awu(remoteMap.values()).toArray()
      expect(res.map(elem => elem.elemID.getFullName())).toEqual(
        elements.slice(0, 1).map(elem => elem.elemID.getFullName()),
      )
    })

    describe('read only', () => {
      it('should throw an error', async () => {
        await expect(readOnlyRemoteMap.delete(elements[0].elemID.getFullName())).rejects.toThrow()
      })
    })
  })
  describe('clear', () => {
    describe('when called in writeable remote map', () => {
      beforeEach(async () => {
        await remoteMap.set(elements[2].elemID.getFullName(), elements[2])
        expect(await awu(remoteMap.keys()).toArray()).not.toHaveLength(0)
        await remoteMap.clear()
        await remoteMap.set(elements[1].elemID.getFullName(), elements[1])
      })
      it('should return keys that were only set after clear', async () => {
        expect(await awu(remoteMap.keys()).toArray()).toEqual([elements[1].elemID.getFullName()])
      })
      it('should return values that were only set after clear', async () => {
        const vals = await awu(remoteMap.values()).toArray()
        expect(vals).toHaveLength(1)
        expect(vals[0].isEqual(elements[1])).toBeTruthy()
      })
      it('get should not return cleared values', async () => {
        await expect(remoteMap.get(elements[0].elemID.getFullName())).resolves.toBeUndefined()
        await expect(remoteMap.get(elements[2].elemID.getFullName())).resolves.toBeUndefined()
        // We try this twice since we had a bug that in the second call it would return the wrong results
        await expect(remoteMap.get(elements[2].elemID.getFullName())).resolves.toBeUndefined()
      })
      it('should return entries that were only set after clear', async () => {
        const entries = await awu(remoteMap.entries()).toArray()
        expect(entries).toHaveLength(1)
        expect(entries[0].key).toBe(elements[1].elemID.getFullName())
        expect(entries[0].value.isEqual(elements[1])).toBeTruthy()
      })
      it('should return false for cleared keys', async () => {
        expect(await remoteMap.has(elements[0].elemID.getFullName())).toBeFalsy()
        expect(await remoteMap.has(elements[2].elemID.getFullName())).toBeFalsy()
      })

      it('should return true for keys set after clear', async () => {
        expect(await remoteMap.has(elements[1].elemID.getFullName())).toBeTruthy()
      })
      it('should return from get only values set after clear', async () => {
        expect(await remoteMap.get(elements[0].elemID.getFullName())).toBeUndefined()
        expect(await remoteMap.get(elements[2].elemID.getFullName())).toBeUndefined()
        expect((await remoteMap.get(elements[1].elemID.getFullName()))?.isEqual(elements[1])).toBeTruthy()
      })
      it('should return from getMany only values set after clear', async () => {
        const vals = await remoteMap.getMany([
          elements[0].elemID.getFullName(),
          elements[1].elemID.getFullName(),
          elements[2].elemID.getFullName(),
        ])
        expect(vals[0]).toBeUndefined()
        expect(vals[1]?.isEqual(elements[1])).toBeTruthy()
        expect(vals[2]).toBeUndefined()
      })
      it('should return true from flush', async () => {
        expect(await remoteMap.flush()).toBeTruthy()
      })
    })
    describe('read only', () => {
      it('should throw an error', async () => {
        await expect(readOnlyRemoteMap.clear()).rejects.toThrow()
      })
    })
  })

  describe('has', () => {
    it('should return true if key exists', async () => {
      expect(await remoteMap.has(elements[0].elemID.getFullName())).toEqual(true)
    })
    it('should return true if key was set on this map', async () => {
      await remoteMap.set(elements[1].elemID.getFullName(), elements[1])
      expect(await remoteMap.has(elements[1].elemID.getFullName())).toEqual(true)
    })
    it('should return false if key does not exist', async () => {
      expect(await remoteMap.has('not-exist')).toEqual(false)
    })
    describe('read only', () => {
      it('should return true if key exists', async () => {
        expect(await readOnlyRemoteMap.has(elements[0].elemID.getFullName())).toEqual(true)
      })
      it('should return false if key does not exist', async () => {
        expect(await readOnlyRemoteMap.has('not-exist')).toEqual(false)
      })
    })
  })
  describe('isEmpty', () => {
    it('should return true if the remote map is empty', async () => {
      const emptyRemoteMap = (await createMap('test')).remoteMap
      const res = await emptyRemoteMap.isEmpty()
      expect(res).toEqual(true)
    })
    it('should return true if the map was cleared', async () => {
      await remoteMap.clear()
      await expect(remoteMap.isEmpty()).resolves.toBeTrue()
    })
    it('should return false if the remote map is not empty', async () => {
      expect(await remoteMap.isEmpty()).toEqual(false)
    })
    it('should return true after finding a value in the cache', async () => {
      // This test reproduces a bug where we would mark the cache as not empty after finding a value in the cache,
      // even if that value is a Promise that will eventually resolve to undefined.
      await remoteMap.clear()
      const key = elements[1].elemID.getFullName()
      // This `get` adds a Promise to the cache, but the remote map is still empty.
      await remoteMap.get(key)
      // This `get` would find the Promise in the cache, and wrongly mark the cache as not empty.
      await remoteMap.get(key)
      expect(await remoteMap.isEmpty()).toEqual(true)
    })
    describe('read only', () => {
      it('should return true if the remote map is empty', async () => {
        expect(await (await createReadOnlyMap('test')).isEmpty()).toEqual(true)
      })
      it('should return false if the remote map is not empty', async () => {
        expect(await readOnlyRemoteMap.isEmpty()).toEqual(false)
      })
    })
  })
  describe('keys', () => {
    describe('without filter', () => {
      it('should list all keys', async () => {
        await remoteMap.setAll(createAsyncIterable(elements))
        const iter = remoteMap.keys()
        const res = await awu(iter).toArray()
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
        expect(nextPageRes).toHaveLength(5)
        expect(nextPageRes).toEqual(sortedElements.slice(5, 10))
      })

      it('should return a paged iterator', async () => {
        await remoteMap.setAll(createAsyncIterable(elements))
        const pages = await awu(remoteMap.keys({ pageSize: 3 })).toArray()
        expect(pages).toHaveLength(5)
        expect(pages.slice(0, -1).every(page => page.length === 3)).toBeTruthy()
      })

      it('should return a paged iterator with a limit', async () => {
        await remoteMap.setAll(createAsyncIterable(elements))
        const pages = (await awu(
          remoteMap.keys({
            first: 8,
            pageSize: 3,
          }),
        ).toArray()) as unknown as string[][]
        expect(pages).toHaveLength(Math.ceil(8 / 3))
        expect(pages.slice(0, -1).every(page => page.length === 3)).toBeTruthy()
        expect(pages.flatMap(page => page)).toEqual(sortedElements.slice(0, 8))
      })

      it('should return a paged iterator after flush', async () => {
        await remoteMap.setAll(createAsyncIterable(elements))
        await remoteMap.flush()
        const pages = await awu(remoteMap.keys({ pageSize: 3 })).toArray()
        expect(pages).toHaveLength(5)
        expect(pages.slice(0, -1).every(page => page.length === 3)).toBeTruthy()
        expect(_.flatten(pages)).toEqual(sortedElements)
      })

      it('should return an empty iterator when the map is empty', async () => {
        await remoteMap.clear()
        await expect(awu(remoteMap.keys()).toArray()).resolves.toEqual([])
        await expect(awu(remoteMap.keys({ pageSize: 2 })).toArray()).resolves.toEqual([])
      })

      describe('read only', () => {
        it('should list all keys', async () => {
          const res = await awu(readOnlyRemoteMap.keys()).toArray()
          expect(res).toEqual(elements.map(elem => elem.elemID.getFullName()).sort())
        })
      })
    })

    describe('with a filter', () => {
      it('should list the filtered keys', async () => {
        await remoteMap.setAll(createAsyncIterable(elements))
        const iter = remoteMap.keys({ filter: filterFn })
        const res = await awu(iter).toArray()
        expect(res).toEqual(filteredSortedElements)
      })

      it('should list all filtered keys - with limit & after logic', async () => {
        await remoteMap.setAll(createAsyncIterable(elements))
        const firstPageRes: string[] = []
        for await (const elemId of remoteMap.keys({ first: 5, filter: filterFn })) {
          firstPageRes.push(elemId)
        }
        expect(firstPageRes).toHaveLength(5)
        expect(firstPageRes).toEqual(filteredSortedElements.slice(0, 5))
        const nextPageRes: string[] = []
        const after = firstPageRes[firstPageRes.length - 1]
        for await (const elemId of remoteMap.keys({ first: 5, after, filter: filterFn })) {
          nextPageRes.push(elemId)
        }
        expect(nextPageRes).toHaveLength(5)
        expect(nextPageRes).toEqual(filteredSortedElements.slice(5, 10))
      })

      it('should return a paged iterator', async () => {
        await remoteMap.setAll(createAsyncIterable(elements))
        const pages = await awu(remoteMap.keys({ pageSize: 3, filter: filterFn })).toArray()
        expect(pages).toHaveLength(Math.ceil(filteredSortedElements.length / 3))
        expect(pages.slice(0, -1).every(page => page.length === 3)).toBeTruthy()
      })

      it('should return a paged iterator with a limit of filtered elements', async () => {
        await remoteMap.setAll(createAsyncIterable(elements))
        const pages = (await awu(
          remoteMap.keys({
            first: 8,
            pageSize: 3,
            filter: filterFn,
          }),
        ).toArray()) as unknown as string[][]
        expect(pages).toHaveLength(Math.ceil(8 / 3))
        expect(pages.slice(0, -1).every(page => page.length === 3)).toBeTruthy()
        expect(pages.flatMap(page => page)).toEqual(filteredSortedElements.slice(0, 8))
      })

      it('should return a paged iterator after flush', async () => {
        await remoteMap.setAll(createAsyncIterable(elements))
        await remoteMap.flush()
        const pages = await awu(remoteMap.keys({ pageSize: 3, filter: filterFn })).toArray()
        expect(pages).toHaveLength(Math.ceil(filteredSortedElements.length / 3))
        expect(pages.slice(0, -1).every(page => page.length <= 3)).toBeTruthy()
        expect(_.flatten(pages)).toEqual(filteredSortedElements)
      })

      describe('read only', () => {
        it('should list all filtered keys', async () => {
          const res = await awu(readOnlyRemoteMap.keys({ filter: filterFn })).toArray()
          expect(res).toEqual(filteredSortedElements)
        })
      })
    })
  })
  describe('values', () => {
    describe('without a filter', () => {
      it('should get all values', async () => {
        await remoteMap.setAll(createAsyncIterable(elements))
        const iter = remoteMap.values()
        const res: Element[] = []
        for await (const element of iter) {
          res.push(element)
        }
        expect(res.map(elem => elem.elemID.getFullName())).toEqual(
          elements.map(elem => elem.elemID.getFullName()).sort(),
        )
      })

      it('should get all values - paginated', async () => {
        await remoteMap.setAll(createAsyncIterable(elements))
        const firstPageRes: Element[] = []
        for await (const element of remoteMap.values({ first: 5 })) {
          firstPageRes.push(element)
        }
        expect(firstPageRes).toHaveLength(5)
        expect(firstPageRes.map(e => e.elemID.getFullName())).toEqual(sortedElements.slice(0, 5))
        const after = firstPageRes[firstPageRes.length - 1].elemID.getFullName()
        const nextPageRes: Element[] = []
        for await (const element of remoteMap.values({ first: 100, after })) {
          nextPageRes.push(element)
        }
        expect(nextPageRes).toHaveLength(10)
        expect(nextPageRes.map(e => e.elemID.getFullName())).toEqual(sortedElements.slice(5))
      })

      it('should return a paged iterator', async () => {
        await remoteMap.setAll(createAsyncIterable(elements))
        const pages = (await awu(remoteMap.values({ pageSize: 3 })).toArray()) as unknown as Element[][]
        expect(pages).toHaveLength(5)
        expect(pages.slice(0, -1).every(page => page.length === 3)).toBeTruthy()
        expect(pages.flatMap(page => page.map(element => element.elemID.getFullName()))).toEqual(sortedElements)
      })

      it('should return a paged limited iterator', async () => {
        await remoteMap.setAll(createAsyncIterable(elements))
        const pages = (await awu(remoteMap.values({ first: 8, pageSize: 3 })).toArray()) as unknown as Element[][]
        expect(pages).toHaveLength(Math.ceil(8 / 3))
        expect(pages.slice(0, -1).every(page => page.length === 3)).toBeTruthy()
        expect(pages.flatMap(page => page.map(element => element.elemID.getFullName()))).toEqual(
          sortedElements.slice(0, 8),
        )
      })

      it('should return a paged iterator after flush', async () => {
        await remoteMap.setAll(createAsyncIterable(elements))
        await remoteMap.flush()
        const pages = (await awu(remoteMap.values({ pageSize: 3 })).toArray()) as unknown as Element[][]
        expect(pages).toHaveLength(5)
        expect(pages.slice(0, -1).every(page => page.length === 3)).toBeTruthy()
        expect(_.flatten(pages).map(e => e.elemID.getFullName())).toEqual(sortedElements)
      })

      describe('read only', () => {
        it('should get all values', async () => {
          const res = await awu(readOnlyRemoteMap.values()).toArray()
          expect(res.map(elem => elem.elemID.getFullName())).toEqual(sortedElements)
        })
      })
    })

    describe('with a filter', () => {
      it('should get all values', async () => {
        await remoteMap.setAll(createAsyncIterable(elements))
        const iter = remoteMap.values({ filter: filterFn })
        const res: Element[] = []
        for await (const element of iter) {
          res.push(element)
        }
        expect(res.map(elem => elem.elemID.getFullName())).toEqual(filteredSortedElements)
      })

      it('should get all values - paginated', async () => {
        await remoteMap.setAll(createAsyncIterable(elements))
        const firstPageRes: Element[] = []
        for await (const element of remoteMap.values({ first: 5, filter: filterFn })) {
          firstPageRes.push(element)
        }
        expect(firstPageRes).toHaveLength(5)
        expect(firstPageRes.map(e => e.elemID.getFullName())).toEqual(filteredSortedElements.slice(0, 5))
        const after = firstPageRes[firstPageRes.length - 1].elemID.getFullName()
        const nextPageRes: Element[] = []
        for await (const element of remoteMap.values({ first: 100, after, filter: filterFn })) {
          nextPageRes.push(element)
        }
        expect(nextPageRes).toHaveLength(filteredSortedElements.length - 5)
        expect(nextPageRes.map(e => e.elemID.getFullName())).toEqual(filteredSortedElements.slice(5))
      })

      it('should return a paged iterator', async () => {
        await remoteMap.setAll(createAsyncIterable(elements))
        const pages = (await awu(
          remoteMap.values({ pageSize: 3, filter: filterFn }),
        ).toArray()) as unknown as Element[][]
        expect(pages).toHaveLength(Math.ceil(filteredSortedElements.length / 3))
        expect(pages.slice(0, -1).every(page => page.length === 3)).toBeTruthy()
        expect(pages.flatMap(page => page.map(element => element.elemID.getFullName()))).toEqual(filteredSortedElements)
      })

      it('should return a paged limited iterator', async () => {
        await remoteMap.setAll(createAsyncIterable(elements))
        const pages = (await awu(
          remoteMap.values({ first: 8, pageSize: 3, filter: filterFn }),
        ).toArray()) as unknown as Element[][]
        expect(pages).toHaveLength(Math.ceil(8 / 3))
        expect(pages.slice(0, -1).every(page => page.length === 3)).toBeTruthy()
        expect(pages.flatMap(page => page.map(element => element.elemID.getFullName()))).toEqual(
          filteredSortedElements.slice(0, 8),
        )
      })

      it('should return a paged iterator after flush', async () => {
        await remoteMap.setAll(createAsyncIterable(elements))
        await remoteMap.flush()
        const pages = (await awu(
          remoteMap.values({ pageSize: 3, filter: filterFn }),
        ).toArray()) as unknown as Element[][]
        expect(pages).toHaveLength(Math.ceil(filteredSortedElements.length / 3))
        expect(pages.slice(0, -1).every(page => page.length === 3)).toBeTruthy()
        expect(_.flatten(pages).map(e => e.elemID.getFullName())).toEqual(filteredSortedElements)
      })

      describe('read only', () => {
        it('should get all values', async () => {
          const res = await awu(readOnlyRemoteMap.values({ filter: filterFn })).toArray()
          expect(res.map(elem => elem.elemID.getFullName())).toEqual(filteredSortedElements)
        })
      })
    })
  })
  describe('entries', () => {
    describe('without a filter', () => {
      it('should get all entries', async () => {
        await remoteMap.setAll(createAsyncIterable(elements))
        const iter = remoteMap.entries()
        const res: { key: string; value: Element }[] = []
        for await (const element of iter) {
          res.push(element)
        }
        expect(res.map(elem => elem.key)).toEqual(sortedElements)
        expect(res.map(elem => elem.value.elemID.getFullName())).toEqual(sortedElements)
      })

      it('should get all entries after inserting empty string key', async () => {
        await remoteMap.set('', elements[0])
        await remoteMap.setAll(createAsyncIterable(elements))
        const iter = remoteMap.entries()
        const res: { key: string; value: Element }[] = []
        for await (const element of iter) {
          res.push(element)
        }
        expect(res.map(elem => elem.key)).toEqual(['', ...elements.map(elem => elem.elemID.getFullName()).sort()])
        expect(res.map(elem => elem.value.elemID.getFullName())).toEqual(
          [elements[0], ...elements].map(elem => elem.elemID.getFullName()).sort(),
        )
      })

      it('should get all entries - paginated', async () => {
        await remoteMap.setAll(createAsyncIterable(elements))
        const firstPageRes: { key: string; value: Element }[] = []
        for await (const element of remoteMap.entries({ first: 5 })) {
          firstPageRes.push(element)
        }
        expect(firstPageRes).toHaveLength(5)
        expect(firstPageRes.map(e => e.value.elemID.getFullName())).toEqual(sortedElements.slice(0, 5))
        expect(firstPageRes.map(e => e.key)).toEqual(sortedElements.slice(0, 5))
        const after = firstPageRes[firstPageRes.length - 1].key
        const nextPageRes: { key: string; value: Element }[] = []
        for await (const element of remoteMap.entries({ first: 100, after })) {
          nextPageRes.push(element)
        }
        expect(nextPageRes).toHaveLength(10)
        expect(nextPageRes.map(e => e.value.elemID.getFullName())).toEqual(sortedElements.slice(5))
        expect(nextPageRes.map(e => e.key)).toEqual(sortedElements.slice(5))
      })

      it('should return a paged iterator', async () => {
        await remoteMap.setAll(createAsyncIterable(elements))
        const pages = (await awu(
          remoteMap.entries({ pageSize: 3 }),
        ).toArray()) as unknown as rm.RemoteMapEntry<Element>[][]
        expect(pages).toHaveLength(5)
        expect(pages.slice(0, -1).every(page => page.length === 3)).toBeTruthy()
        expect(pages.flatMap(page => page.map(e => e.key))).toEqual(sortedElements)
      })

      it('should return a paged limited iterator', async () => {
        await remoteMap.setAll(createAsyncIterable(elements))
        const pages = (await awu(
          remoteMap.entries({ pageSize: 3, first: 8 }),
        ).toArray()) as unknown as rm.RemoteMapEntry<Element>[][]
        expect(pages).toHaveLength(Math.ceil(8 / 3))
        expect(pages.slice(0, -1).every(page => page.length === 3)).toBeTruthy()
        expect(pages.flatMap(page => page.map(e => e.key))).toEqual(sortedElements.slice(0, 8))
      })

      it('should return a paged iterator after flush', async () => {
        await remoteMap.setAll(createAsyncIterable(elements))
        await remoteMap.flush()
        const pages = (await awu(
          remoteMap.entries({ pageSize: 3 }),
        ).toArray()) as unknown as rm.RemoteMapEntry<Element>[][]
        expect(pages).toHaveLength(5)
        expect(pages.slice(0, -1).every(page => page.length === 3)).toBeTruthy()
        expect(pages.flatMap(page => page.map(e => e.key))).toEqual(sortedElements)
      })

      describe('read only', () => {
        it('should get all entries', async () => {
          const res = await awu(readOnlyRemoteMap.entries()).toArray()
          expect(res.map(elem => elem.key)).toEqual(sortedElements)
          expect(res.map(elem => elem.value.elemID.getFullName())).toEqual(sortedElements)
        })
      })
    })

    describe('with a filter', () => {
      it('should get all entries', async () => {
        await remoteMap.setAll(createAsyncIterable(elements))
        const iter = remoteMap.entries({ filter: filterFn })
        const res: { key: string; value: Element }[] = []
        for await (const element of iter) {
          res.push(element)
        }
        expect(res.map(elem => elem.key)).toEqual(filteredSortedElements)
        expect(res.map(elem => elem.value.elemID.getFullName())).toEqual(filteredSortedElements)
      })

      it('should get all entries after inserting a string that passes the filter key', async () => {
        await remoteMap.set('a', elements[0])
        await remoteMap.setAll(createAsyncIterable(elements))
        const iter = remoteMap.entries({ filter: filterFn })
        const res: { key: string; value: Element }[] = []
        for await (const element of iter) {
          res.push(element)
        }
        expect(res.map(elem => elem.key)).toEqual(['a', ...filteredSortedElements])
        expect(res.map(elem => elem.value.elemID.getFullName())).toEqual([
          elements[0].elemID.getFullName(),
          ...filteredSortedElements,
        ])
      })

      it('should get all entries - paginated', async () => {
        await remoteMap.setAll(createAsyncIterable(elements))
        const firstPageRes: { key: string; value: Element }[] = []
        for await (const element of remoteMap.entries({ first: 5, filter: filterFn })) {
          firstPageRes.push(element)
        }
        expect(firstPageRes).toHaveLength(5)
        expect(firstPageRes.map(e => e.value.elemID.getFullName())).toEqual(filteredSortedElements.slice(0, 5))
        expect(firstPageRes.map(e => e.key)).toEqual(filteredSortedElements.slice(0, 5))
        const after = firstPageRes[firstPageRes.length - 1].key
        const nextPageRes: { key: string; value: Element }[] = []
        for await (const element of remoteMap.entries({ first: 100, after, filter: filterFn })) {
          nextPageRes.push(element)
        }
        expect(nextPageRes).toHaveLength(filteredSortedElements.length - 5)
        expect(nextPageRes.map(e => e.value.elemID.getFullName())).toEqual(filteredSortedElements.slice(5))
        expect(nextPageRes.map(e => e.key)).toEqual(filteredSortedElements.slice(5))
      })

      it('should return a paged iterator', async () => {
        await remoteMap.setAll(createAsyncIterable(elements))
        const pages = (await awu(
          remoteMap.entries({ pageSize: 3, filter: filterFn }),
        ).toArray()) as unknown as rm.RemoteMapEntry<Element>[][]
        expect(pages).toHaveLength(Math.ceil(filteredSortedElements.length / 3))
        expect(pages.slice(0, -1).every(page => page.length === 3)).toBeTruthy()
        expect(pages.flatMap(page => page.map(e => e.key))).toEqual(filteredSortedElements)
      })

      it('should return a paged limited iterator', async () => {
        await remoteMap.setAll(createAsyncIterable(elements))
        const pages = (await awu(
          remoteMap.entries({ pageSize: 3, first: 8, filter: filterFn }),
        ).toArray()) as unknown as rm.RemoteMapEntry<Element>[][]
        expect(pages).toHaveLength(Math.ceil(8 / 3))
        expect(pages.slice(0, -1).every(page => page.length === 3)).toBeTruthy()
        expect(pages.flatMap(page => page.map(e => e.key))).toEqual(filteredSortedElements.slice(0, 8))
      })

      it('should return a paged iterator after flush', async () => {
        await remoteMap.setAll(createAsyncIterable(elements))
        await remoteMap.flush()
        const pages = (await awu(
          remoteMap.entries({ pageSize: 3, filter: filterFn }),
        ).toArray()) as unknown as rm.RemoteMapEntry<Element>[][]
        expect(pages).toHaveLength(Math.ceil(filteredSortedElements.length / 3))
        expect(pages.slice(0, -1).every(page => page.length === 3)).toBeTruthy()
        expect(pages.flatMap(page => page.map(e => e.key))).toEqual(filteredSortedElements)
      })

      describe('read only', () => {
        it('should get all entries', async () => {
          const res = await awu(readOnlyRemoteMap.entries({ filter: filterFn })).toArray()
          expect(res.map(elem => elem.key)).toEqual(filteredSortedElements)
          expect(res.map(elem => elem.value.elemID.getFullName())).toEqual(filteredSortedElements)
        })
      })
    })
  })
  describe('flush', () => {
    describe('read only', () => {
      it('should throw an error', async () => {
        await expect(readOnlyRemoteMap.flush()).rejects.toThrow()
      })
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
    changedElement.fields = { [Object.keys(changedElement.fields)[0].concat('A CHANGE')]: changedValue }
    await remoteMap.set(cloneElements[0].elemID.getFullName(), cloneElements[0])
    const res = await awu(remoteMap.values()).toArray()
    const elemToFieldNameMapping = (elem: Element): string | undefined =>
      isObjectType(elem)
        ? Object.values(elem.fields)
            .map(field => field.name)
            .sort()
            .toString()
        : undefined
    expect(res.map(elemToFieldNameMapping)).toEqual(
      cloneElements
        .sort((a, b) => (a.elemID.getFullName() < b.elemID.getFullName() ? -1 : 1))
        .map(elemToFieldNameMapping),
    )
  })
  it('should throw exception if the namespace is invalid', async () => {
    await expect(createMap('inval:d')).rejects.toThrow()
  })

  describe('closeAllRemoteMaps', () => {
    beforeEach(async () => {
      // Read something to ensure the cache is not empty
      const key = (await awu(remoteMap.keys()).find(values.isDefined)) as string
      await remoteMap.get(key)

      const locationInfo = remoteMapLocations.get(DB_LOCATION)
      expect(locationInfo.cache.itemCount).not.toBe(0)
      remoteMapLocations.return(DB_LOCATION)
      await closeAllRemoteMaps()
    })
    it('should clear all caches', () => {
      const locationInfo = remoteMapLocations.get(DB_LOCATION)
      expect(locationInfo.cache.itemCount).toBe(0)
      remoteMapLocations.return(DB_LOCATION)
    })
  })
})

describe('tmp db deletion', () => {
  const DB_LOCATION_TMP = path.join(DB_LOCATION, 'tmp')
  const TMP_DIR = path.join(DB_LOCATION_TMP, TMP_DB_DIR)
  const EXISTING_LOCATION = path.join(TMP_DIR, 'existing')
  it('should delete existing tmp dbs on startup', async () => {
    // Ensure no leftovers from previous tests.
    mkdirpSync(TMP_DIR)
    expect(readdirSync(TMP_DIR)).toHaveLength(0)

    // We open and close a rocksdb connection to create a DB that simulates an existing tmp db
    // which was not closed in the previous run (For example, Ctrl-C)
    const newDb = rocksdbImpl(EXISTING_LOCATION)
    await promisify(newDb.open.bind(newDb, { readOnly: false }))()
    await promisify(newDb.close.bind(newDb))()
    expect(readdirSync(TMP_DIR)).toHaveLength(1)

    // Creating a new map should delete the old tmp db, and create a new one
    const { close } = await createMap('new_map', true, DB_LOCATION_TMP)
    expect(readdirSync(TMP_DIR)).toHaveLength(1)

    // Closing the map should remove the newly created tmp db
    await close()
    expect(readdirSync(TMP_DIR)).toHaveLength(0)
  })
})

describe('non persistent mode', () => {
  const DB_LOCATION_TMP = path.join(DB_LOCATION, 'tmp')
  it('should throw an error if flush is called', async () => {
    await expect(async () => (await createMap(DB_LOCATION, false)).remoteMap.flush()).rejects.toThrow()
  })

  it('should destroy the tmp storage dirs after the connection is closed', async () => {
    const tmpDir = path.join(DB_LOCATION_TMP, TMP_DB_DIR)
    const { close } = await createMap(DB_LOCATION_TMP, false, DB_LOCATION_TMP)
    expect(readdirSync(tmpDir)).not.toEqual([])
    await close()
    expect(readdirSync(tmpDir)).toEqual([])
  })
})

describe('full integration', () => {
  it('creates keys and values, flushes', async () => {
    const { remoteMap, close } = await createMap('integration')
    const elements = generateElements()
    await remoteMap.set(elements[0].elemID.getFullName(), elements[0])
    await remoteMap.setAll(createAsyncIterable(elements.slice(1, elements.length)))
    await remoteMap.flush()
    const iter = remoteMap.values()
    const res: Element[] = []
    for await (const element of iter) {
      res.push(element)
    }
    expect(_.uniq(res.map(elem => elem.elemID.getFullName()))).toEqual(
      elements.map(elem => elem.elemID.getFullName()).sort(),
    )
    await close()
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
    expect(ids).toEqual(elements.map(elem => 'integration::'.concat(elem.elemID.getFullName())).sort())

    await promisify(db.close.bind(db))()
  })
})

afterAll(async () => {
  await cleanDatabases()
})
