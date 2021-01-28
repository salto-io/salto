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
import path from 'path'
import { generateElements } from '../src/generator'
import testParams from './test_params'

const mockProgressReporter = { reportProgress: jest.fn() }
const EXTRA_NACL_PATH = path.join(__dirname, '../../test/mocks')
describe('elements generator', () => {
  describe('consistency', () => {
    it('should create the same set of elements when invoked with the same seed and params', async () => {
      const run1 = await generateElements(testParams, mockProgressReporter)
      const run2 = await generateElements(testParams, mockProgressReporter)
      expect(run1).toEqual(run2)
    })
    it('should create different results when invoked with different seeds', async () => {
      const run1 = await generateElements(testParams, mockProgressReporter)
      const run2 = await generateElements({
        ...testParams,
        seed: 3.14,
      }, mockProgressReporter)
      expect(run1).not.toEqual(run2)
    })
    it('should create the amount of elements as the params specified', async () => {
      const elements = await generateElements(testParams, mockProgressReporter)
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
      ).toHaveLength(testParams.numOfObjs + 6) // 5 default types + 1 additional type
      expect(profiles).toHaveLength(testParams.numOfProfiles * 4)
      expect(_.uniq(profiles.map(p => p.elemID.getFullName()))).toHaveLength(
        testParams.numOfProfiles
      )
      expect(records).toHaveLength(testParams.numOfRecords + 5) // 5 default instance fragments
    })
    it('should create list and map types', async () => {
      const run1 = await generateElements({
        ...testParams,
        listFieldFreq: 1,
        mapFieldFreq: 0,
      }, mockProgressReporter)
      const run2 = await generateElements({
        ...testParams,
        listFieldFreq: 0,
        mapFieldFreq: 1,
      }, mockProgressReporter)
      const [maps, lists] = _.partition(
        [...run1, ...run2].filter(isObjectType).flatMap(e => _.values(e.fields)).filter(
          f => isContainerType(f.getType())
        ),
        f => isMapType(f.getType()),
      )
      expect(lists.length).toBeGreaterThan(0)
      expect(maps.length).toBeGreaterThan(0)
    })
    it('should support old profiles', async () => {
      const elements = await generateElements({
        ...testParams,
        useOldProfiles: true,
      }, mockProgressReporter)
      const profiles = elements.filter(isInstanceElement).filter(
        e => e.path !== undefined && e.path[2] === 'Profile'
      )
      expect(profiles).toHaveLength(testParams.numOfProfiles)
    })

    it('should return elements in the extra nacl dir', async () => {
      const elements = await generateElements({
        ...testParams,
        extraNaclPath: EXTRA_NACL_PATH,
      }, mockProgressReporter)
      const singleFileObj = elements.find(e => e.elemID.getFullName() === 'dummy.singleFileObj')
      const multiFilesObj = elements.filter(e => e.elemID.getFullName() === 'dummy.multiFilesObj')
      expect(singleFileObj).toBeDefined()
      expect(multiFilesObj).toHaveLength(2)
      expect(singleFileObj?.path).toEqual(['dummy', 'extra', 'single'])
      expect(multiFilesObj.map(e => e.path)).toEqual([
        ['dummy', 'extra', 'multi1'],
        ['dummy', 'extra', 'multi2'],
      ])
    })

    it('should generate a set of fixture elements', async () => {
      const elements = await generateElements(testParams, mockProgressReporter)
      const expectedFixtures = [
        { fullName: 'dummy.Full.instance.FullInst1', numOfFragments: 1 },
        { fullName: 'dummy.Full.instance.FullInst2', numOfFragments: 1 },
        { fullName: 'dummy.Full', numOfFragments: 1 },
        { fullName: 'dummy.Partial', numOfFragments: 2 },
        { fullName: 'dummy.Partial.instance.PartialInst', numOfFragments: 2 },
      ]
      expectedFixtures.forEach(fixture => {
        const fragments = elements.filter(e => e.elemID.getFullName() === fixture.fullName)
        expect(fragments).toHaveLength(fixture.numOfFragments)
      })
    })
  })
  describe('env data', () => {
    it('should create env variables if the env variable is set', async () => {
      const envName = 'env'
      process.env.SALTO_ENV = envName
      const elements = await generateElements(testParams)
      expect(elements.find(e => e.elemID.getFullName() === 'dummy.envEnvObj'))
        .toBeDefined()
      expect(elements.find(e => e.elemID.getFullName() === 'dummy.envEnvObj.instance.envEnvInst'))
        .toBeDefined()
      expect(elements.find(e => e.elemID.getFullName() === 'dummy.EnvObj'))
        .toBeDefined()
      expect(elements.find(e => e.elemID.getFullName() === 'dummy.EnvObj.instance.EnvInst'))
        .toBeDefined()
    })
  })
})
