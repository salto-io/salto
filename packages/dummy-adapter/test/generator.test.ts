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
import { isObjectType, isInstanceElement, isPrimitiveType, isMapType, isContainerType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { generateElements } from '../src/generator'
import testParams from './test_params'

const mockProgressReporter = { reportProgress: jest.fn() }

describe('elements generator', () => {
  describe('consistency', () => {
    it('should create the same set of elements when invoked with the same seed and params', () => {
      const run1 = generateElements(testParams, mockProgressReporter)
      const run2 = generateElements(testParams, mockProgressReporter)
      expect(run1).toEqual(run2)
    })
    it('should create different results when invoked with different seeds', () => {
      const run1 = generateElements(testParams, mockProgressReporter)
      const run2 = generateElements({
        ...testParams,
        seed: 3.14,
      }, mockProgressReporter)
      expect(run1).not.toEqual(run2)
    })
    it('should create the amount of elements as the params specified', () => {
      const elements = generateElements(testParams, mockProgressReporter)
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
    it('should create list and map types', () => {
      const run1 = generateElements({
        ...testParams,
        listFieldFreq: 1,
        mapFieldFreq: 0,
      }, mockProgressReporter)
      const run2 = generateElements({
        ...testParams,
        listFieldFreq: 0,
        mapFieldFreq: 1,
      }, mockProgressReporter)
      const [maps, lists] = _.partition(
        [...run1, ...run2].filter(isObjectType).flatMap(e => _.values(e.fields)).filter(
          f => isContainerType(f.type)
        ),
        f => isMapType(f.type),
      )
      expect(lists.length).toBeGreaterThan(0)
      expect(maps.length).toBeGreaterThan(0)
    })
    it('should support old profiles', () => {
      const elements = generateElements({
        ...testParams,
        useOldProfiles: true,
      }, mockProgressReporter)
      const profiles = elements.filter(isInstanceElement).filter(
        e => e.path !== undefined && e.path[2] === 'Profile'
      )
      expect(profiles).toHaveLength(testParams.numOfProfiles)
    })
  })
})
