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
import { collections } from '@salto-io/lowerdash'
import { InMemoryRemoteMap, RemoteMap } from '../../src/workspace/remote_map'

const { awu } = collections.asynciterable

describe('remote map', () => {
  describe('in memory', () => {
    let inMemRemoteMap: RemoteMap<string, string>
    const testKey1 = 'testKey'
    const testVal1 = 'data'
    const testKey2 = 'key2'
    const testVal2 = 'data2'
    beforeEach(async () => {
      inMemRemoteMap = new InMemoryRemoteMap<string, string>([
        { key: testKey1, value: testVal1 },
        { key: testKey2, value: testVal2 },
      ])
    })
    describe('get', () => {
      it('should return correct value', async () => {
        expect(await inMemRemoteMap.get(testKey1)).toEqual(testVal1)
      })
      it('should return undefined if key does not exist', async () => {
        expect(await inMemRemoteMap.get('not-exist')).toEqual(undefined)
      })
    })
    describe('has', () => {
      it('should return true if key exists', async () => {
        expect(await inMemRemoteMap.has(testKey1)).toEqual(true)
      })
      it('should return false if key does not exist', async () => {
        expect(await inMemRemoteMap.has('not-exist')).toEqual(false)
      })
    })
    describe('delete', () => {
      it('should delete the key', async () => {
        expect(await inMemRemoteMap.has(testKey1)).toEqual(true)
        await inMemRemoteMap.delete(testKey1)
        expect(await inMemRemoteMap.has(testKey1)).toEqual(false)
      })
    })
    describe('set', () => {
      it('should set specific key', async () => {
        await inMemRemoteMap.set(testKey1, testVal2)
        expect(await inMemRemoteMap.get(testKey1)).toEqual(testVal2)
      })
    })
    describe('setAll', () => {
      it('should set all keys', async () => {
        await inMemRemoteMap.setAll(
          awu([
            { key: testKey1, value: testVal2 },
            { key: testKey2, value: testVal1 },
          ])
        )
        expect(await inMemRemoteMap.get(testKey1)).toEqual(testVal2)
        expect(await inMemRemoteMap.get(testKey2)).toEqual(testVal1)
      })
    })
    describe('clear', () => {
      it('should delete all keys', async () => {
        await inMemRemoteMap.clear()
        expect(await awu(inMemRemoteMap.values()).toArray()).toHaveLength(0)
      })
    })
    describe('keys', () => {
      it('should return all keys', async () => {
        expect(await awu(inMemRemoteMap.keys()).toArray()).toEqual([testKey1, testKey2])
      })
    })
    describe('values', () => {
      it('should return all values', async () => {
        expect(await awu(inMemRemoteMap.values()).toArray()).toEqual([testVal1, testVal2])
      })
    })
    describe('entries', () => {
      it('should return all entries', async () => {
        expect(await awu(inMemRemoteMap.entries()).toArray())
          .toEqual([{ key: testKey1, value: testVal1 }, { key: testKey2, value: testVal2 }])
      })
    })
    describe('flush', () => {
      it('should do nothing', async () => {
        await inMemRemoteMap.flush()
      })
    })
    describe('revert', () => {
      it('should do nothing', async () => {
        await inMemRemoteMap.revert()
      })
    })
    describe('close', () => {
      it('should do nothing', async () => {
        await inMemRemoteMap.close()
      })
    })
  })
})
