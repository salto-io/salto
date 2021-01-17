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
import { isObjectType, isInstanceElement, isPrimitiveType, isMapType, isContainerType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections, promises } from '@salto-io/lowerdash'
import { generateElements } from '../src/generator'
import testParams from './test_params'

const { awu } = collections.asynciterable
const { partition } = promises.array

describe('elements generator', () => {
  describe('consistency', () => {
    it('should create the same set of elements when invoked with the same seed and params', async () => {
      const run1 = await generateElements(testParams)
      const run2 = await generateElements(testParams)
      expect(run1).toEqual(run2)
    })
    it('should create different results when invoked with different seeds', async () => {
      const run1 = await generateElements(testParams)
      const run2 = await generateElements({
        ...testParams,
        seed: 3.14,
      })
      expect(run1).not.toEqual(run2)
    })
    it('should create the amount of elements as the params specified', async () => {
      const elements = await generateElements(testParams)
      const primitives = elements.filter(isPrimitiveType)
      const [types, objects] = _.partition(
        elements.filter(isObjectType),
        e => e.path !== undefined && e.path[1] === 'Types'
      )
      const [profiles, records] = _.partition(
        elements.filter(isInstanceElement),
        e => e.path !== undefined && e.path[2] === 'Profile'
      )
      expect(primitives).toHaveLength(testParams.numOfPrimitiveTypes)
      expect(types).toHaveLength(testParams.numOfTypes)
      expect(
        _.uniq(objects.map(obj => obj.elemID.getFullName()))
      ).toHaveLength(testParams.numOfObjs + 3) // 3 default types
      expect(profiles).toHaveLength(testParams.numOfProfiles * 4)
      expect(_.uniq(profiles.map(p => p.elemID.getFullName()))).toHaveLength(
        testParams.numOfProfiles
      )
      expect(records).toHaveLength(testParams.numOfRecords)
    })
    it('should create list and map types', async () => {
      const run1 = await generateElements({
        ...testParams,
        listFieldFreq: 1,
        mapFieldFreq: 0,
      })
      const run2 = await generateElements({
        ...testParams,
        listFieldFreq: 0,
        mapFieldFreq: 1,
      })
      const [maps, lists] = await partition(
        await awu([...run1, ...run2])
          .filter(isObjectType)
          .flatMap(e => _.values(e.fields)).filter(
            async f => isContainerType(await f.getType())
          )
          .toArray(),
        async f => isMapType(await f.getType()),
      )
      expect(lists.length).toBeGreaterThan(0)
      expect(maps.length).toBeGreaterThan(0)
    })
    it('should support old profiles', async () => {
      const elements = await generateElements({
        ...testParams,
        useOldProfiles: true,
      })
      const profiles = elements.filter(isInstanceElement).filter(
        e => e.path !== undefined && e.path[2] === 'Profile'
      )
      expect(profiles).toHaveLength(testParams.numOfProfiles)
    })
  })
})
