/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import {
  isObjectType,
  isInstanceElement,
  isPrimitiveType,
  isMapType,
  isListType,
  CORE_ANNOTATIONS,
  StaticFile,
  isTemplateExpression,
  Element,
  isStaticFile,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import path from 'path'
import { ImportantValue } from '@salto-io/adapter-utils'
import { defaultParams, generateElements, GeneratorParams } from '../src/generator'
import testParams from './test_params'

const { awu } = collections.asynciterable
const mockProgressReporter = { reportProgress: jest.fn() }
const EXTRA_NACL_PATH = path.join(__dirname, '../test/mocks')
describe('elements generator', () => {
  describe('consistency', () => {
    it('should create the same set of elements when invoked with the same seed and params', async () => {
      const run1 = await generateElements(testParams, mockProgressReporter)
      const run2 = await generateElements(testParams, mockProgressReporter)
      expect(run1).toEqual(run2)
    })
    it('should create the same set of elements when invoked with the same seed and params concurrently', async () => {
      const [run1, run2] = await Promise.all([
        generateElements(testParams, mockProgressReporter),
        generateElements(testParams, mockProgressReporter),
      ])
      expect(run1).toEqual(run2)
    })
    it('should create different results when invoked with different seeds', async () => {
      const run1 = await generateElements(testParams, mockProgressReporter)
      const run2 = await generateElements(
        {
          ...testParams,
          seed: 3.14,
        },
        mockProgressReporter,
      )
      expect(run1).not.toEqual(run2)
    })
    it('should create the amount of elements as the params specified', async () => {
      const elements = await generateElements(testParams, mockProgressReporter)
      const primitives = elements.filter(isPrimitiveType)
      const [types, objects] = _.partition(
        elements.filter(isObjectType),
        e => e.path !== undefined && e.path[1] === 'Types',
      )
      const [profiles, records] = _.partition(
        elements.filter(isInstanceElement),
        e => e.path !== undefined && e.path[2] === 'Profile',
      )
      expect(primitives).toHaveLength(testParams.numOfPrimitiveTypes)
      expect(types).toHaveLength(testParams.numOfTypes)
      expect(_.uniq(objects.map(obj => obj.elemID.getFullName()))).toHaveLength(testParams.numOfObjs + 7) // 5 default types + 2q additional type
      expect(profiles).toHaveLength(testParams.numOfProfiles * 4)
      expect(_.uniq(profiles.map(p => p.elemID.getFullName()))).toHaveLength(testParams.numOfProfiles)
      expect(records).toHaveLength(testParams.numOfRecords + 5) // 5 default instance fragments
    })
    // eslint-disable-next-line
    it.skip('should create list and map types', async () => {
      const run1 = await generateElements(
        {
          ...testParams,
          listFieldFreq: 1,
          mapFieldFreq: 0,
        },
        mockProgressReporter,
      )
      const run2 = await generateElements(
        {
          ...testParams,
          listFieldFreq: 0,
          mapFieldFreq: 1,
        },
        mockProgressReporter,
      )
      const fields = [...run1, ...run2].filter(isObjectType).flatMap(e => _.values(e.fields))
      const maps = await awu(fields)
        .filter(async f => isMapType(await f.getType()))
        .toArray()
      const lists = await awu(fields)
        .filter(async f => isListType(await f.getType()))
        .toArray()
      expect(lists.length).toBeGreaterThan(0)
      expect(maps.length).toBeGreaterThan(0)
    })

    it('should return elements in the extra nacl dir and handle static file correctly', async () => {
      const elements = await generateElements(
        {
          ...testParams,
          extraNaclPaths: [EXTRA_NACL_PATH, 'should/handle/path/not/exists'],
        },
        mockProgressReporter,
      )
      const singleFileObj = elements.find(e => e.elemID.getFullName() === 'dummy.singleFileObj')
      const multiFilesObj = elements.filter(e => e.elemID.getFullName() === 'dummy.multiFilesObj')
      const instWithStatic1 = elements.find(
        e => e.elemID.getFullName() === 'dummy.multiFilesObj.instance.InstWithStatic1',
      )
      const instWithStatic2 = elements.find(
        e => e.elemID.getFullName() === 'dummy.multiFilesObj.instance.InstWithStatic2',
      )
      expect(singleFileObj).toBeDefined()
      expect(multiFilesObj).toHaveLength(2)
      expect(singleFileObj?.path).toEqual(['dummy', 'extra', 'single'])
      expect(multiFilesObj.map(e => e.path)).toEqual([
        ['dummy', 'extra', 'multi1'],
        ['dummy', 'extra', 'multi2'],
      ])
      expect(isInstanceElement(instWithStatic1)).toBeTruthy()
      if (isInstanceElement(instWithStatic1)) {
        const staticFile = instWithStatic1.value.aField as StaticFile
        const content = await staticFile.getContent()
        expect(content?.toString(staticFile.encoding)).toEqual('CONTENT OF REAL FILE')
      }
      expect(isInstanceElement(instWithStatic2)).toBeTruthy()
      if (isInstanceElement(instWithStatic2)) {
        const staticFile = instWithStatic2.value.aField as StaticFile
        const content = await staticFile.getContent()
        expect(content?.toString(staticFile.encoding)).toEqual('THIS IS STATIC FILE') // fall back content
      }
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
  describe('important values', () => {
    const isValidImportantValue = (importantValue: ImportantValue): boolean => {
      const { value, highlighted, indexed } = importantValue
      return _.isString(value) && _.isBoolean(highlighted) && _.isBoolean(indexed)
    }
    it('should not create important values if importantValuesFreq is 0', async () => {
      const importantValuesTestParams: GeneratorParams = {
        ...defaultParams,
        numOfObjs: 10,
        numOfPrimitiveTypes: 0,
        numOfProfiles: 0,
        numOfRecords: 0,
        numOfTypes: 10,
        importantValuesFreq: 0,
      }
      const elements = await generateElements(importantValuesTestParams, mockProgressReporter)
      const elementsWithImportantValues = elements
        .filter(isObjectType)
        .filter(
          obj =>
            (obj.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES] !== undefined &&
              obj.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES].every(isValidImportantValue)) ||
            (obj.annotations[CORE_ANNOTATIONS.SELF_IMPORTANT_VALUES] !== undefined &&
              obj.annotations[CORE_ANNOTATIONS.SELF_IMPORTANT_VALUES].every(isValidImportantValue)),
        )
      expect(_.isEmpty(elementsWithImportantValues)).toBeTruthy()
    })
    it('should create some important values if importantValuesFreq is 0.75', async () => {
      const importantValuesTestParams: GeneratorParams = {
        ...defaultParams,
        numOfObjs: 10,
        numOfPrimitiveTypes: 0,
        numOfProfiles: 0,
        numOfRecords: 0,
        numOfTypes: 10,
      }
      const elements = await generateElements(importantValuesTestParams, mockProgressReporter)
      const elementsWithImportantValues = elements
        .filter(isObjectType)
        .filter(
          obj =>
            (obj.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES] !== undefined &&
              obj.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES].every(isValidImportantValue)) ||
            (obj.annotations[CORE_ANNOTATIONS.SELF_IMPORTANT_VALUES] !== undefined &&
              obj.annotations[CORE_ANNOTATIONS.SELF_IMPORTANT_VALUES].every(isValidImportantValue)),
        )
      expect(_.isEmpty(elementsWithImportantValues)).toBeFalsy()
    })
    it('should create some important values if importantValuesFreq is undefined', async () => {
      const importantValuesTestParams: GeneratorParams = {
        ...defaultParams,
        numOfObjs: 10,
        numOfPrimitiveTypes: 0,
        numOfProfiles: 0,
        numOfRecords: 0,
        numOfTypes: 10,
        importantValuesFreq: undefined,
      }
      const elements = await generateElements(importantValuesTestParams, mockProgressReporter)
      const elementsWithImportantValues = elements
        .filter(isObjectType)
        .filter(
          obj =>
            (obj.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES] !== undefined &&
              obj.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES].every(isValidImportantValue)) ||
            (obj.annotations[CORE_ANNOTATIONS.SELF_IMPORTANT_VALUES] !== undefined &&
              obj.annotations[CORE_ANNOTATIONS.SELF_IMPORTANT_VALUES].every(isValidImportantValue)),
        )
      expect(_.isEmpty(elementsWithImportantValues)).toBeFalsy()
    })
  })
  describe('template expression', () => {
    const hasTemplate = (elements: Element[]): boolean =>
      elements
        .filter(isObjectType)
        .map(obj => Object.values(obj.annotations))
        .map(values => values.filter(isTemplateExpression))
        .some(templateValues => !_.isEmpty(templateValues))

    it('should create template expression correctly if freq is 1', async () => {
      const templateExpressionParams: GeneratorParams = {
        ...defaultParams,
        numOfObjs: 100,
        numOfPrimitiveTypes: 30,
        numOfProfiles: 0,
        numOfRecords: 0,
        numOfTypes: 0,
        templateExpressionFreq: 1,
      }
      const elements = await generateElements(templateExpressionParams, mockProgressReporter)
      expect(hasTemplate(elements)).toBeTruthy()
    })
    it('should not create template expression if frq is 0', async () => {
      const templateExpressionParams: GeneratorParams = {
        ...defaultParams,
        numOfObjs: 100,
        numOfPrimitiveTypes: 30,
        numOfProfiles: 0,
        numOfRecords: 0,
        numOfTypes: 0,
        templateExpressionFreq: 0,
      }
      const elements = await generateElements(templateExpressionParams, mockProgressReporter)
      expect(hasTemplate(elements)).toBeFalsy()
    })
  })
  describe('template static file', () => {
    const hasTemplateStaticFile = (elements: Element[]): boolean =>
      elements
        .filter(isObjectType)
        .map(obj => Object.values(obj.annotations))
        .map(values => values.filter(isStaticFile).filter(file => file.isTemplate))
        .some(templateFiles => !_.isEmpty(templateFiles))
    it('should create template static file correctly if freq is 1', async () => {
      const templateStaticFileParams: GeneratorParams = {
        ...defaultParams,
        numOfObjs: 100,
        numOfPrimitiveTypes: 30,
        numOfProfiles: 0,
        numOfRecords: 0,
        numOfTypes: 0,
        templateExpressionFreq: 0,
        templateStaticFileFreq: 1,
      }
      const elements = await generateElements(templateStaticFileParams, mockProgressReporter)
      expect(hasTemplateStaticFile(elements)).toBeTruthy()
    })
    it('should not create template static files if frq is 0', async () => {
      const templateStaticFileParams: GeneratorParams = {
        ...defaultParams,
        numOfObjs: 100,
        numOfPrimitiveTypes: 30,
        numOfProfiles: 0,
        numOfRecords: 0,
        numOfTypes: 0,
        templateExpressionFreq: 0,
        templateStaticFileFreq: 0,
      }
      const elements = await generateElements(templateStaticFileParams, mockProgressReporter)
      expect(hasTemplateStaticFile(elements)).toBeFalsy()
    })
  })
  describe('env data', () => {
    it('should create env variables if the env variable is set', async () => {
      const envName = 'env'
      process.env.SALTO_ENV = envName
      const elements = await generateElements(testParams, mockProgressReporter)
      expect(elements.find(e => e.elemID.getFullName() === 'dummy.envEnvObj')).toBeDefined()
      expect(elements.find(e => e.elemID.getFullName() === 'dummy.envEnvObj.instance.envEnvInst')).toBeDefined()
      expect(elements.find(e => e.elemID.getFullName() === 'dummy.EnvObj')).toBeDefined()
      expect(elements.find(e => e.elemID.getFullName() === 'dummy.EnvObj.instance.EnvInst')).toBeDefined()
    })
  })
})
