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
import { BuiltinTypes, Element, Field, isObjectType, ObjectType } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/custom_object_split'
import { CUSTOM_OBJECT_TYPE_ID } from '../../src/filters/custom_objects'
import { FilterWith } from '../../src/filter'
import { API_NAME, CUSTOM_OBJECT, METADATA_TYPE, OBJECTS_PATH, SALESFORCE } from '../../src/constants'
import { isCustom } from '../../src/transformers/transformer'


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


describe('custom object split filter', () => {
  describe.each`
    description                 |   customObject
    ${'non namespace object'}   |   ${NON_NAMESPACE_OBJECT}
    ${'namespace object'}       |   ${NAMESPACE_OBJECT}
  `('$description', ({ customObject }: {customObject: ObjectType}) => {
  let splitElements: Element[]
  let objectCustomFields: Field[]
  let objectStandardFields: Field[]

  const runFilter = async (): Promise<Element[]> => {
        type FilterType = FilterWith<'onFetch'>
        const filter = (): FilterType => filterCreator() as FilterType
        const elements = [customObject]
        await filter().onFetch(elements)
        return elements
  }
  beforeAll(async () => {
    splitElements = await runFilter()
    objectCustomFields = getCustomFields(customObject)
    objectStandardFields = getStandardFields(customObject)
  })
  test('splits into three objects', () => {
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
    test('contains all annotations', () => {
      expect(annotationsObject.annotations).toMatchObject(customObject.annotations)
    })

    test('contains no fields', () => {
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

    test('contains all standard fields', () => {
      expect(standardFieldsObject).toContainFields(objectStandardFields)
    })

    test('contains no custom fields', () => {
      expect(standardFieldsObject).not.toContainAnyField(objectCustomFields)
    })

    test('contains no annotations', () => {
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

    test('contains all custom fields', () => {
      expect(customFieldsObject).toContainFields(objectCustomFields)
    })

    test('contains no standard fields', () => {
      expect(customFieldsObject).not.toContainAnyField(objectStandardFields)
    })

    test('contains no annotations', () => {
      expect(customFieldsObject.annotations).toBeEmpty()
    })
  })
})
})
