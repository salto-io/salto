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
import { isObjectType, isInstanceElement, isPrimitiveType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { generateElements, defaultParams } from '../src/generator'


describe('elements generator', () => {
  describe('consistency', () => {
    it('should create the same set of elements when invoked with the same seed and params', () => {
      const run1 = generateElements(defaultParams)
      const run2 = generateElements(defaultParams)
      expect(run1).toEqual(run2)
    })
    it('should create different results when invoked with different seeds', () => {
      const run1 = generateElements(defaultParams)
      const run2 = generateElements({
        ...defaultParams,
        seed: 3.14,
      })
      expect(run1).not.toEqual(run2)
    })
    it('should create the amount of elements as the params specified', () => {
      const elements = generateElements(defaultParams)
      const primitives = elements.filter(isPrimitiveType)
      const [types, objects] = _.partition(
        elements.filter(isObjectType),
        e => e.path !== undefined && e.path[1] === 'Types'
      )
      const [profiles, records] = _.partition(
        elements.filter(isInstanceElement),
        e => e.path !== undefined && e.path[2] === 'Profile'
      )
      expect(primitives).toHaveLength(defaultParams.numOfPrimitiveTypes)
      expect(types).toHaveLength(defaultParams.numOfTypes)
      expect(
        _.uniq(objects.map(obj => obj.elemID.getFullName()))
      ).toHaveLength(defaultParams.numOfObjs + 3) // 3 default types
      expect(profiles).toHaveLength(defaultParams.numOfProfiles)
      expect(records).toHaveLength(defaultParams.numOfRecords)
    })
  })
})
