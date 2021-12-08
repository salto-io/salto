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
import 'jest-extended'
import _ from 'lodash'
import { ObjectType, BuiltinTypes, Element, ElemID } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/custom_object_split'
import { CUSTOM_OBJECT_TYPE_ID } from '../../src/filters/custom_objects'
import { FilterWith } from '../../src/filter'
import { METADATA_TYPE, CUSTOM_OBJECT, API_NAME, SALESFORCE, OBJECTS_PATH } from '../../src/constants'


describe('Custom Object Split filter', () => {
  type FilterType = FilterWith<'onFetch'>
  const filter = (): FilterType => filterCreator() as FilterType
  const runFilter = async (...customObjects: ObjectType[]): Promise<Element[]> => {
    const elements = [...customObjects]
    await filter().onFetch(elements)
    return elements
  }

  const noNameSpaceObject = new ObjectType({
    elemID: CUSTOM_OBJECT_TYPE_ID,
    fields: {
      standard: {
        refType: BuiltinTypes.STRING,
      },
      custom__c: {
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
  const namespaceObject = new ObjectType({
    elemID: CUSTOM_OBJECT_TYPE_ID,
    fields: {
      standard: {
        refType: BuiltinTypes.STRING,
      },
      custom__c: {
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

  describe.each`
    description                 |   customObject
    ${'non namespace object'}   |   ${noNameSpaceObject}
    ${'namespace object'}       |   ${namespaceObject}
  `('$description', ({ customObject }: { customObject: ObjectType }) => {
  let elements: Element[]

  beforeEach(async () => {
    elements = await runFilter(customObject)
    expect(elements).toBeDefined()
    expect(elements.length).toEqual(3)
  })

  it('should create annotations object', () => {
    const annotationsObj = elements.find(obj =>
      _.isEqual(obj.path, [SALESFORCE, OBJECTS_PATH,
        'CustomObject', 'CustomObjectAnnotations'])) as ObjectType
    expect(annotationsObj).toBeDefined()
    expect(Object.values(annotationsObj.fields).length).toEqual(0)
    expect(annotationsObj.annotations[METADATA_TYPE]).toEqual(CUSTOM_OBJECT)
  })

  it('should create standard fields object', () => {
    const standardFieldsObj = elements.find(obj =>
      _.isEqual(obj.path, [SALESFORCE, OBJECTS_PATH,
        'CustomObject', 'CustomObjectStandardFields'])) as ObjectType
    expect(standardFieldsObj).toBeDefined()
    expect(Object.values(standardFieldsObj.annotations).length).toEqual(0)
    expect(standardFieldsObj.fields.standard).toBeDefined()
    expect(standardFieldsObj.fields.standard
      .isEqual(customObject.fields.standard)).toBeTruthy()
  })

  it('should create custom fields object', () => {
    const customFieldsObj = elements.find(obj =>
      _.isEqual(obj.path, [SALESFORCE, OBJECTS_PATH,
        'CustomObject', 'CustomObjectCustomFields'])) as ObjectType
    expect(customFieldsObj).toBeDefined()
    expect(Object.values(customFieldsObj.annotations).length).toEqual(0)
    expect(customFieldsObj.fields.custom__c).toBeDefined()
    expect(customFieldsObj.fields.custom__c
      .isEqual(customObject.fields.custom__c)).toBeTruthy()
    expect(customFieldsObj.fields.custom_namespace__c).toBeDefined()
    expect(customFieldsObj.fields.custom_namespace__c
      .isEqual(customObject.fields.custom_namespace__c)).toBeTruthy()
  })
})
  describe('when split elements contains empty objects', () => {
    const getSplitElementsPaths = async (...customObjects: ObjectType[]): Promise<string[][]> => {
      const splitElements = await runFilter(...customObjects)
      return splitElements.map(customObject => customObject.path as string[] ?? [])
    }

    it('should filter out empty standard fields object', async () => {
      const objectWithNoStandardFields = new ObjectType({
        elemID: CUSTOM_OBJECT_TYPE_ID,
        fields: {
          custom__c: {
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
      const splitElementsPaths = await getSplitElementsPaths(objectWithNoStandardFields)
      expect(splitElementsPaths).toIncludeSameMembers([
        [SALESFORCE, OBJECTS_PATH, 'CustomObject', 'CustomObjectCustomFields'],
        [SALESFORCE, OBJECTS_PATH, 'CustomObject', 'CustomObjectAnnotations'],
      ])
    })
    it('should filter out empty custom fields object', async () => {
      const objectWithNoCustomFields = new ObjectType({
        elemID: CUSTOM_OBJECT_TYPE_ID,
        fields: {
          standard: {
            refType: BuiltinTypes.STRING,
          },
        },
        annotations: {
          [METADATA_TYPE]: CUSTOM_OBJECT,
          [API_NAME]: 'objectRandom__c',
        },
      })
      const splitElementsPaths = await getSplitElementsPaths(objectWithNoCustomFields)
      expect(splitElementsPaths).toIncludeSameMembers([
        [SALESFORCE, OBJECTS_PATH, 'CustomObject', 'CustomObjectStandardFields'],
        [SALESFORCE, OBJECTS_PATH, 'CustomObject', 'CustomObjectAnnotations'],
      ])
    })
  })
  it('should not split non-custom object', async () => {
    const nonCustomObject = new ObjectType({
      elemID: new ElemID(SALESFORCE, 'NonCustomObject'),
      fields: {
        standard: {
          refType: BuiltinTypes.STRING,
        },
        custom__c: {
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
        [METADATA_TYPE]: 'NonCustomObject',
        [API_NAME]: 'objectRandom__c',
      },
    })
    const splitElements = await runFilter(nonCustomObject)
    expect(splitElements).toEqual([nonCustomObject])
  })
})
