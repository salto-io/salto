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
import 'jest-extended'
import _ from 'lodash'
import { values } from '@salto-io/lowerdash'
import {
  BuiltinTypes,
  Element,
  ElemID,
  ObjectType,
} from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/custom_type_split'
import { CUSTOM_OBJECT_TYPE_ID } from '../../src/filters/custom_objects_to_object_type'
import {
  API_NAME,
  CUSTOM_OBJECT,
  INSTALLED_PACKAGES_PATH,
  METADATA_TYPE,
  OBJECTS_PATH,
  SALESFORCE,
  OBJECT_FIELDS_PATH,
  CUSTOM_METADATA,
} from '../../src/constants'
import { defaultFilterContext, createCustomObjectType } from '../utils'
import { Types } from '../../src/transformers/transformer'
import { FilterWith } from './mocks'

type FilterType = FilterWith<'onFetch'>

const getElementPaths = (elements: Element[]): string[] =>
  elements
    .map((elem) => elem.path ?? [])
    .map((path) => path.join('/'))
    .sort()

describe('Custom Object Split filter', () => {
  describe('when using default file split', () => {
    const CUSTOM_METADATA_RECORD_TYPE_NAME = 'MDType__mdt'
    const filter = (): FilterType =>
      filterCreator({
        config: defaultFilterContext,
      }) as FilterType

    const runFilter = async (
      ...customObjects: ObjectType[]
    ): Promise<Element[]> => {
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
        // eslint-disable-next-line camelcase
        custom__c: {
          refType: BuiltinTypes.STRING,
        },
        // eslint-disable-next-line camelcase
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
        // eslint-disable-next-line camelcase
        custom__c: {
          refType: BuiltinTypes.STRING,
        },
        // eslint-disable-next-line camelcase
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
    const customMetadataRecordType = new ObjectType({
      elemID: new ElemID(SALESFORCE, CUSTOM_METADATA_RECORD_TYPE_NAME),
      fields: {
        customField__c: { refType: Types.primitiveDataTypes.Picklist },
        standardField: { refType: Types.primitiveDataTypes.Number },
      },
      annotations: {
        [METADATA_TYPE]: CUSTOM_METADATA,
        [API_NAME]: CUSTOM_METADATA_RECORD_TYPE_NAME,
      },
    })

    describe('should split non-Namespace Custom Object to elements', () => {
      let elements: Element[]
      beforeEach(async () => {
        elements = await runFilter(noNameSpaceObject)
      })

      it('should create annotations object', () => {
        const annotationsObj = elements.find((obj) =>
          _.isEqual(obj.path, [
            SALESFORCE,
            OBJECTS_PATH,
            'CustomObject',
            'CustomObjectAnnotations',
          ]),
        ) as ObjectType
        expect(annotationsObj).toBeDefined()
        expect(Object.values(annotationsObj.fields).length).toEqual(0)
        expect(annotationsObj.annotations[METADATA_TYPE]).toEqual(CUSTOM_OBJECT)
      })

      it('should create standard fields object', () => {
        const standardFieldsObj = elements.find((obj) =>
          _.isEqual(obj.path, [
            SALESFORCE,
            OBJECTS_PATH,
            'CustomObject',
            'CustomObjectStandardFields',
          ]),
        ) as ObjectType
        expect(standardFieldsObj).toBeDefined()
        expect(Object.values(standardFieldsObj.annotations).length).toEqual(0)
        expect(standardFieldsObj.fields.standard).toBeDefined()
        expect(
          standardFieldsObj.fields.standard.isEqual(
            noNameSpaceObject.fields.standard,
          ),
        ).toBeTruthy()
      })

      it('should create custom fields object with all custom fields', () => {
        const customFieldsObj = elements.find((obj) =>
          _.isEqual(obj.path, [
            SALESFORCE,
            OBJECTS_PATH,
            'CustomObject',
            'CustomObjectCustomFields',
          ]),
        ) as ObjectType
        expect(customFieldsObj).toBeDefined()
        expect(Object.values(customFieldsObj.annotations).length).toEqual(0)
        expect(customFieldsObj.fields.custom__c).toBeDefined()
        expect(
          customFieldsObj.fields.custom__c.isEqual(
            noNameSpaceObject.fields.custom__c,
          ),
        ).toBeTruthy()
        expect(customFieldsObj.fields.custom_namespace__c).toBeDefined()
        expect(
          customFieldsObj.fields.custom_namespace__c.isEqual(
            noNameSpaceObject.fields.custom_namespace__c,
          ),
        ).toBeTruthy()
      })
    })

    describe('should split namespace Custom Object to elements', () => {
      let elements: Element[]
      beforeEach(async () => {
        elements = await runFilter(namespaceObject)
      })

      it('should create annotations object inside the installed packages folder', () => {
        const annotationsObj = elements.find((obj) =>
          _.isEqual(obj.path, [
            SALESFORCE,
            INSTALLED_PACKAGES_PATH,
            'namespace',
            OBJECTS_PATH,
            'CustomObject',
            'CustomObjectAnnotations',
          ]),
        ) as ObjectType
        expect(annotationsObj).toBeDefined()
        expect(Object.values(annotationsObj.fields).length).toEqual(0)
        expect(annotationsObj.annotations[METADATA_TYPE]).toEqual(CUSTOM_OBJECT)
      })

      it('should create standard fields object inside the installed packages folder', () => {
        const standardFieldsObj = elements.find((obj) =>
          _.isEqual(obj.path, [
            SALESFORCE,
            INSTALLED_PACKAGES_PATH,
            'namespace',
            OBJECTS_PATH,
            'CustomObject',
            'CustomObjectStandardFields',
          ]),
        ) as ObjectType
        expect(standardFieldsObj).toBeDefined()
        expect(Object.values(standardFieldsObj.annotations).length).toEqual(0)
        expect(standardFieldsObj.fields.standard).toBeDefined()
        expect(
          standardFieldsObj.fields.standard.isEqual(
            namespaceObject.fields.standard,
          ),
        ).toBeTruthy()
      })

      it('should create namespace custom fields object with all custom fields inside the installed packages folder', () => {
        const customFieldsObj = elements.find((obj) =>
          _.isEqual(obj.path, [
            SALESFORCE,
            INSTALLED_PACKAGES_PATH,
            'namespace',
            OBJECTS_PATH,
            'CustomObject',
            'CustomObjectCustomFields',
          ]),
        ) as ObjectType
        expect(customFieldsObj).toBeDefined()
        expect(Object.values(customFieldsObj.annotations).length).toEqual(0)
        expect(customFieldsObj.fields.custom_namespace__c).toBeDefined()
        expect(
          customFieldsObj.fields.custom_namespace__c.isEqual(
            namespaceObject.fields.custom_namespace__c,
          ),
        ).toBeTruthy()
        expect(customFieldsObj.fields.custom__c).toBeDefined()
        expect(
          customFieldsObj.fields.custom__c.isEqual(
            namespaceObject.fields.custom__c,
          ),
        ).toBeTruthy()
      })
    })

    describe('when split elements contain empty objects', () => {
      const getSplitElementsPaths = async (
        ...customObjects: ObjectType[]
      ): Promise<(readonly string[])[]> => {
        const splitElements = await runFilter(...customObjects)
        return splitElements
          .map((customObject) => customObject.path)
          .filter(values.isDefined)
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
        const splitElementsPaths = await getSplitElementsPaths(
          objectWithNoStandardFields,
        )
        expect(splitElementsPaths).toIncludeSameMembers([
          [
            SALESFORCE,
            OBJECTS_PATH,
            'CustomObject',
            'CustomObjectCustomFields',
          ],
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
        const splitElementsPaths = await getSplitElementsPaths(
          objectWithNoCustomFields,
        )
        expect(splitElementsPaths).toIncludeSameMembers([
          [
            SALESFORCE,
            OBJECTS_PATH,
            'CustomObject',
            'CustomObjectStandardFields',
          ],
          [SALESFORCE, OBJECTS_PATH, 'CustomObject', 'CustomObjectAnnotations'],
        ])
      })
    })

    describe('should split CustomMetadataRecordType to elements', () => {
      let elements: Element[]
      beforeEach(async () => {
        elements = await runFilter(customMetadataRecordType)
      })

      it('should create annotations object', () => {
        const annotationsObj = elements.find((obj) =>
          _.isEqual(obj.path, [
            SALESFORCE,
            OBJECTS_PATH,
            'MDType__mdt',
            'MDType__mdtAnnotations',
          ]),
        ) as ObjectType
        expect(annotationsObj).toBeDefined()
        expect(Object.values(annotationsObj.fields).length).toEqual(0)
        expect(annotationsObj.annotations[METADATA_TYPE]).toEqual(
          CUSTOM_METADATA,
        )
        expect(annotationsObj.annotations[API_NAME]).toEqual(
          CUSTOM_METADATA_RECORD_TYPE_NAME,
        )
      })

      it('should create standard fields object', () => {
        const standardFieldsObj = elements.find((obj) =>
          _.isEqual(obj.path, [
            SALESFORCE,
            OBJECTS_PATH,
            'MDType__mdt',
            'MDType__mdtStandardFields',
          ]),
        ) as ObjectType
        expect(standardFieldsObj).toBeDefined()
        expect(Object.values(standardFieldsObj.annotations).length).toEqual(0)
        expect(standardFieldsObj.fields.standardField).toBeDefined()
        expect(
          standardFieldsObj.fields.standardField.isEqual(
            customMetadataRecordType.fields.standardField,
          ),
        ).toBeTruthy()
      })

      it('should create custom fields object with all custom fields', () => {
        const customFieldsObj = elements.find((obj) =>
          _.isEqual(obj.path, [
            SALESFORCE,
            OBJECTS_PATH,
            'MDType__mdt',
            'MDType__mdtCustomFields',
          ]),
        ) as ObjectType
        expect(customFieldsObj).toBeDefined()
        expect(Object.values(customFieldsObj.annotations).length).toEqual(0)
        expect(customFieldsObj.fields.customField__c).toBeDefined()
        expect(
          customFieldsObj.fields.customField__c.isEqual(
            customMetadataRecordType.fields.customField__c,
          ),
        ).toBeTruthy()
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
  describe('when using per field file split', () => {
    const filter = (separateFieldToFiles: string[]): FilterType =>
      filterCreator({
        config: { ...defaultFilterContext, separateFieldToFiles },
      }) as FilterType

    const runFilter = async (
      ...customObjects: ObjectType[]
    ): Promise<Element[]> => {
      const elements = [...customObjects]
      await filter(['SpecialObject__c']).onFetch(elements)
      return elements
    }
    const typeToSplit = createCustomObjectType('SpecialObject__c', {
      fields: {
        Standard: {
          refType: BuiltinTypes.STRING,
        },
        // eslint-disable-next-line camelcase
        Custom__c: {
          refType: BuiltinTypes.STRING,
        },
        // eslint-disable-next-line camelcase
        OtherCustom__c: {
          refType: BuiltinTypes.STRING,
        },
      },
    })
    const otherType = createCustomObjectType('OtherType__c', {
      fields: {
        Standard: {
          refType: BuiltinTypes.STRING,
        },
        // eslint-disable-next-line camelcase
        Custom__c: {
          refType: BuiltinTypes.STRING,
        },
        // eslint-disable-next-line camelcase
        OtherCustom__c: {
          refType: BuiltinTypes.STRING,
        },
      },
    })
    let elementsByElemId: Record<string, Element[]>

    beforeEach(async () => {
      const elements = await runFilter(typeToSplit, otherType)
      elementsByElemId = _.groupBy(elements, (value) =>
        value.elemID.getFullName(),
      )
    })

    it('should split the selected type', () => {
      const elements = elementsByElemId['salesforce.SpecialObject__c']
      expect(elements).toBeArrayOfSize(6)
      expect(getElementPaths(elements)).toIncludeSameMembers([
        `${SALESFORCE}/${OBJECTS_PATH}/SpecialObject__c/Fields/Custom__c`,
        `${SALESFORCE}/${OBJECTS_PATH}/SpecialObject__c/Fields/OtherCustom__c`,
        `${SALESFORCE}/${OBJECTS_PATH}/SpecialObject__c/Fields/Standard`,
        `${SALESFORCE}/${OBJECTS_PATH}/SpecialObject__c/Fields/Id`,
        `${SALESFORCE}/${OBJECTS_PATH}/SpecialObject__c/Fields/Name`,
        `${SALESFORCE}/${OBJECTS_PATH}/SpecialObject__c/SpecialObject__cAnnotations`,
      ])
    })
    it('should still split all the annotations to a single file', () => {
      const elements = elementsByElemId['salesforce.SpecialObject__c']
      const annotationsObj = elements.find((obj) =>
        _.isEqual(obj.path, [
          SALESFORCE,
          OBJECTS_PATH,
          'SpecialObject__c',
          'SpecialObject__cAnnotations',
        ]),
      ) as ObjectType
      expect(annotationsObj).toBeDefined()
      expect(Object.values(annotationsObj.annotations).length).toEqual(2)
      expect(Object.values(annotationsObj.fields).length).toEqual(0)
      expect(annotationsObj.annotations[METADATA_TYPE]).toEqual(CUSTOM_OBJECT)
    })

    it('should put a single field into each file', () => {
      const elements = elementsByElemId['salesforce.SpecialObject__c']
      const customField = elements.find((obj) =>
        _.isEqual(obj.path, [
          SALESFORCE,
          OBJECTS_PATH,
          'SpecialObject__c',
          OBJECT_FIELDS_PATH,
          'Custom__c',
        ]),
      ) as ObjectType
      expect(customField).toBeDefined()
      expect(Object.values(customField.fields).length).toEqual(1)
      expect(customField.fields.Custom__c).toBeDefined()
      expect(Object.values(customField.annotations).length).toEqual(0)
    })
    it('should not split any other type', () => {
      const elements = elementsByElemId['salesforce.OtherType__c']
      expect(elements).toBeArrayOfSize(3)
      expect(getElementPaths(elements)).toEqual([
        `${SALESFORCE}/${OBJECTS_PATH}/OtherType__c/OtherType__cAnnotations`,
        `${SALESFORCE}/${OBJECTS_PATH}/OtherType__c/OtherType__cCustomFields`,
        `${SALESFORCE}/${OBJECTS_PATH}/OtherType__c/OtherType__cStandardFields`,
      ])
    })
  })
})
