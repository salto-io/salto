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
import 'jest-extended'
import { BuiltinTypes, Element, Field, isObjectType, ObjectType } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/custom_object_split'
import { CUSTOM_OBJECT_TYPE_ID } from '../../src/filters/custom_objects'
import { FilterWith } from '../../src/filter'
import { API_NAME, CUSTOM_OBJECT, METADATA_TYPE, OBJECTS_PATH, SALESFORCE } from '../../src/constants'
import { isCustom } from '../../src/transformers/transformer'


describe('custom object split filter', () => {
  const SPLIT_CUSTOM_OBJECTS_DIR_PATH = [SALESFORCE, OBJECTS_PATH, 'CustomObject']

  const NON_NAMESPACE_OBJECT = new ObjectType({
    elemID: CUSTOM_OBJECT_TYPE_ID,
    fields: {
      standardField: {
        refType: BuiltinTypes.STRING,
      },
      customField__c: {
        refType: BuiltinTypes.STRING,
      },
      custom_namespace__c: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [API_NAME]: 'objectRandom__c.namespace__random__c',
        },
      },
    },
    annotations: {
      [METADATA_TYPE]: CUSTOM_OBJECT,
      [API_NAME]: 'objectRandom__c',
    },
  })

  const NAMESPACE_OBJECT = new ObjectType({
    elemID: CUSTOM_OBJECT_TYPE_ID,
    fields: {
      standardField: {
        refType: BuiltinTypes.STRING,
      },
      customField__c: {
        refType: BuiltinTypes.STRING,
      },
      custom_namespace__c: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [API_NAME]: 'namespace__objectRandom__c.namespace__api_name',
        },
      },
    },
    annotations: {
      [METADATA_TYPE]: CUSTOM_OBJECT,
      [API_NAME]: 'namespace__objectRandom__c',
    },
  })

  const isCustomField = (f: Field): boolean => isCustom(f.elemID.getFullName())
  const isStandardField = (f: Field): boolean => !isCustomField(f)
  const elementHasPath = (e: Element, path: string[]): boolean => _.isEqual(e.path, path)
  const getCustomFields = (e: ObjectType): Field[] => Object.values<Field>(e.fields)
    .filter(isCustomField)
  const getStandardFields = (e: ObjectType): Field[] => Object.values<Field>(e.fields)
    .filter(isStandardField)

  describe.each`
    description                 |   customObject
    ${'non namespace object'}   |   ${NON_NAMESPACE_OBJECT}
    ${'namespace object'}       |   ${NAMESPACE_OBJECT}
  `('$description', ({ customObject }: {customObject: ObjectType}) => {
  let splitElements: Element[]
  let expectedCustomFields: Field[]
  let expectedStandardFields: Field[]

  const runFilter = async (): Promise<Element[]> => {
        type FilterType = FilterWith<'onFetch'>
        const filter = (): FilterType => filterCreator() as FilterType
        const elements = [customObject]
        await filter().onFetch(elements)
        return elements
  }
  beforeAll(async () => {
    splitElements = await runFilter()
    expectedCustomFields = getCustomFields(customObject)
    expectedStandardFields = getStandardFields(customObject)
  })
  it('splits into three objects', () => {
    expect(splitElements).toHaveLength(3)
    expect(splitElements).toSatisfyAll(isObjectType)
  })

  describe('annotations object', () => {
    let annotationsObject: ObjectType
    beforeAll(() => {
      const annotationsObjectPath = SPLIT_CUSTOM_OBJECTS_DIR_PATH.concat('CustomObjectAnnotations')
      annotationsObject = <ObjectType>splitElements
        .find(e => elementHasPath(e, annotationsObjectPath))
    })
    it('contains all annotations', () => {
      expect(annotationsObject.annotations).toMatchObject(customObject.annotations)
    })

    it('contains no fields', () => {
      expect(annotationsObject.fields).toBeEmpty()
    })
  })

  describe('standard fields object', () => {
    let standardFieldsObject: ObjectType

    beforeAll(() => {
      const standardFieldsObjectPath = SPLIT_CUSTOM_OBJECTS_DIR_PATH.concat('CustomObjectStandardFields')
      standardFieldsObject = <ObjectType>splitElements
        .find(e => elementHasPath(e, standardFieldsObjectPath))
    })

    it('only contains all standard fields', () => {
      const receivedFields = Object.values(standardFieldsObject.fields)
      expect(receivedFields).toHaveLength(expectedStandardFields.length)
      _.zip(receivedFields, expectedStandardFields).forEach(([received, expected]) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(received!.isEqual(expected!)).toBeTrue()
      })
    })

    it('contains no annotations', () => {
      expect(standardFieldsObject.annotations).toBeEmpty()
    })
  })

  describe('custom fields object', () => {
    let customFieldsObject: ObjectType

    beforeAll(() => {
      const customFieldsObjectPath = SPLIT_CUSTOM_OBJECTS_DIR_PATH.concat('CustomObjectCustomFields')
      customFieldsObject = <ObjectType>splitElements
        .find(e => elementHasPath(e, customFieldsObjectPath))
    })

    it('only contains all custom fields', () => {
      const receivedFields = Object.values(customFieldsObject.fields)
      expect(receivedFields).toHaveLength(expectedCustomFields.length)
      _.zip(receivedFields, expectedCustomFields).forEach(([received, expected]) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(received!.isEqual(expected!)).toBeTrue()
      })
    })

    it('contains no annotations', () => {
      expect(customFieldsObject.annotations).toBeEmpty()
    })
  })
})
})
