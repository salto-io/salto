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
import _ from 'lodash'
import { ObjectType, BuiltinTypes, Element } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/custom_object_split'
import { CUSTOM_OBJECT_TYPE_ID } from '../../src/filters/custom_objects'
import { FilterWith } from '../../src/filter'
import { METADATA_TYPE, CUSTOM_OBJECT, API_NAME, SALESFORCE, INSTALLED_PACKAGES_PATH, OBJECTS_PATH } from '../../src/constants'


describe('Custom Object Split filter', () => {
  type FilterType = FilterWith<'onFetch'>
  const filter = (): FilterType => filterCreator() as FilterType
  const noNameSpaceObject = new ObjectType({
    elemID: CUSTOM_OBJECT_TYPE_ID,
    fields: {
      standard: {
        type: BuiltinTypes.STRING,
      },
      // eslint-disable-next-line @typescript-eslint/camelcase
      custom__c: {
        type: BuiltinTypes.STRING,
      },
      // eslint-disable-next-line @typescript-eslint/camelcase
      custom_namespace__c: {
        type: BuiltinTypes.STRING,
        annotations: {
          [API_NAME]: 'namespace__random__c',
        },
      },
    },
    annotations: {
      [METADATA_TYPE]: CUSTOM_OBJECT,
    },
  })
  const withNamespaceOject = new ObjectType({
    elemID: CUSTOM_OBJECT_TYPE_ID,
    fields: {
      standard: {
        type: BuiltinTypes.STRING,
      },
      // eslint-disable-next-line @typescript-eslint/camelcase
      custom__c: {
        type: BuiltinTypes.STRING,
      },
      // eslint-disable-next-line @typescript-eslint/camelcase
      custom_namespace__c: {
        type: BuiltinTypes.STRING,
        annotations: {
          [API_NAME]: 'api-name',
        },
      },
    },
    annotations: {
      [METADATA_TYPE]: CUSTOM_OBJECT,
      [API_NAME]: 'namespace__objectRandom__c',
    },
  })

  describe('should split non-Namespace Custom Object to elements', () => {
    let elements: Element[]
    beforeEach(async () => {
      elements = [noNameSpaceObject]
      await filter().onFetch(elements)
      expect(elements).toBeDefined()
      expect(elements.length).toEqual(4)
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
        .isEqual(noNameSpaceObject.fields.standard)).toBeTruthy()
    })

    it('should create custom fields object', () => {
      const customFieldsObj = elements.find(obj =>
        _.isEqual(obj.path, [SALESFORCE, OBJECTS_PATH,
          'CustomObject', 'CustomObjectCustomFields'])) as ObjectType
      expect(customFieldsObj).toBeDefined()
      expect(Object.values(customFieldsObj.annotations).length).toEqual(0)
      expect(customFieldsObj.fields.custom__c).toBeDefined()
      expect(customFieldsObj.fields.custom__c
        .isEqual(noNameSpaceObject.fields.custom__c)).toBeTruthy()
    })

    it('should create namespace custom fields object', () => {
      const packageCustomFieldsObj = elements.find(obj =>
        _.isEqual(obj.path, [SALESFORCE, INSTALLED_PACKAGES_PATH, 'namespace', OBJECTS_PATH,
          'CustomObject', 'CustomObjectCustomFields'])) as ObjectType
      expect(packageCustomFieldsObj).toBeDefined()
      expect(Object.values(packageCustomFieldsObj.annotations).length).toEqual(0)
      expect(packageCustomFieldsObj.fields.custom_namespace__c).toBeDefined()
      expect(packageCustomFieldsObj.fields.custom_namespace__c
        .isEqual(noNameSpaceObject.fields.custom_namespace__c)).toBeTruthy()
    })
  })


  describe('should split namespace Custom Object to elements', () => {
    let elements: Element[]
    beforeEach(async () => {
      elements = [withNamespaceOject]
      await filter().onFetch(elements)
      expect(elements).toBeDefined()
      expect(elements.length).toEqual(3)
    })

    it('should create annotations object inside the installed packages folder', () => {
      const annotationsObj = elements.find(obj =>
        _.isEqual(obj.path, [SALESFORCE, INSTALLED_PACKAGES_PATH, 'namespace', OBJECTS_PATH,
          'CustomObject', 'CustomObjectAnnotations'])) as ObjectType
      expect(annotationsObj).toBeDefined()
      expect(Object.values(annotationsObj.fields).length).toEqual(0)
      expect(annotationsObj.annotations[METADATA_TYPE]).toEqual(CUSTOM_OBJECT)
    })

    it('should create standard fields object inside the installed packages folder', () => {
      const standardFieldsObj = elements.find(obj =>
        _.isEqual(obj.path, [SALESFORCE, INSTALLED_PACKAGES_PATH, 'namespace', OBJECTS_PATH,
          'CustomObject', 'CustomObjectStandardFields'])) as ObjectType
      expect(standardFieldsObj).toBeDefined()
      expect(Object.values(standardFieldsObj.annotations).length).toEqual(0)
      expect(standardFieldsObj.fields.standard).toBeDefined()
      expect(standardFieldsObj.fields.standard
        .isEqual(withNamespaceOject.fields.standard)).toBeTruthy()
    })

    it('should create namespace custom fields object with all custom fields inside the installed packages folder', () => {
      const customFieldsObj = elements.find(obj =>
        _.isEqual(obj.path, [SALESFORCE, INSTALLED_PACKAGES_PATH, 'namespace', OBJECTS_PATH,
          'CustomObject', 'CustomObjectCustomFields'])) as ObjectType
      expect(customFieldsObj).toBeDefined()
      expect(Object.values(customFieldsObj.annotations).length).toEqual(0)
      expect(customFieldsObj.fields.custom_namespace__c).toBeDefined()
      expect(customFieldsObj.fields.custom_namespace__c
        .isEqual(withNamespaceOject.fields.custom_namespace__c)).toBeTruthy()
      expect(customFieldsObj.fields.custom__c).toBeDefined()
      expect(customFieldsObj.fields.custom__c
        .isEqual(withNamespaceOject.fields.custom__c)).toBeTruthy()
    })
  })
})
