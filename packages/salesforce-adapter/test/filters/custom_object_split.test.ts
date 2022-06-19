/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { BuiltinTypes, Element, ElemID, ObjectType } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/custom_object_split'
import { CUSTOM_OBJECT_TYPE_ID } from '../../src/filters/custom_objects'
import { FilterWith } from '../../src/filter'
import {
  API_NAME,
  CUSTOM_OBJECT,
  INSTALLED_PACKAGES_PATH,
  METADATA_TYPE,
  OBJECTS_PATH,
  SALESFORCE,
  OBJECT_FIELDS_PATH,
} from '../../src/constants'
import mockClient from '../client'
import { defaultFilterContext, createCustomObjectType } from '../utils'

type FilterType = FilterWith<'onFetch'>

describe('Custom Object Split filter', () => {
  describe('when using default file split', () => {
    const filter = (): FilterType => filterCreator({
      client: mockClient().client,
      config: defaultFilterContext,
    }) as FilterType

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

    describe('should change non-Namespace Custom Object to include the correct pathIndex', () => {
      let elements: Element[]
      beforeEach(async () => {
        elements = await runFilter(noNameSpaceObject.clone())
      })

      it('should create the correct path index', () => {
        const { typeName } = CUSTOM_OBJECT_TYPE_ID
        const customObjects = elements.filter(obj => obj.elemID.isEqual(CUSTOM_OBJECT_TYPE_ID))
        expect(customObjects).toHaveLength(1)
        const [customObject] = customObjects
        expect(Array.from(customObject.pathIndex?.entries() ?? []))
          .toEqual([
            [
              customObject.elemID.getFullName(),
              [SALESFORCE, OBJECTS_PATH, typeName, 'CustomObjectAnnotations'],
            ],
            [
              customObject.elemID.createNestedID('field', 'standard').getFullName(),
              [SALESFORCE, OBJECTS_PATH, typeName, 'CustomObjectStandardFields'],
            ],
            [
              customObject.elemID.createNestedID('field', 'custom__c').getFullName(),
              [SALESFORCE, OBJECTS_PATH, typeName, 'CustomObjectCustomFields'],
            ],
            [
              customObject.elemID.createNestedID('field', 'custom_namespace__c').getFullName(),
              [SALESFORCE, OBJECTS_PATH, typeName, 'CustomObjectCustomFields'],
            ],
          ])
        expect(noNameSpaceObject.isEqual(customObject as ObjectType)).toEqual(true)
      })
    })

    describe('should change Namespace Custom Object to include the correct pathIndex', () => {
      let elements: Element[]
      beforeEach(async () => {
        elements = await runFilter(namespaceObject.clone())
      })

      it('should create the correct path index', () => {
        const { typeName } = CUSTOM_OBJECT_TYPE_ID
        const customObjects = elements.filter(obj => obj.elemID.isEqual(CUSTOM_OBJECT_TYPE_ID))
        expect(customObjects).toHaveLength(1)
        const [customObject] = customObjects
        expect(Array.from(customObject.pathIndex?.entries() ?? []))
          .toEqual([
            [
              customObject.elemID.getFullName(),
              [SALESFORCE, INSTALLED_PACKAGES_PATH, 'namespace', OBJECTS_PATH, typeName, 'CustomObjectAnnotations'],
            ],
            [
              customObject.elemID.createNestedID('field', 'standard').getFullName(),
              [SALESFORCE, INSTALLED_PACKAGES_PATH, 'namespace', OBJECTS_PATH, typeName, 'CustomObjectStandardFields'],
            ],
            [
              customObject.elemID.createNestedID('field', 'custom__c').getFullName(),
              [SALESFORCE, INSTALLED_PACKAGES_PATH, 'namespace', OBJECTS_PATH, typeName, 'CustomObjectCustomFields'],
            ],
            [
              customObject.elemID.createNestedID('field', 'custom_namespace__c').getFullName(),
              [SALESFORCE, INSTALLED_PACKAGES_PATH, 'namespace', OBJECTS_PATH, typeName, 'CustomObjectCustomFields'],
            ],
          ])
        expect(namespaceObject.isEqual(customObject as ObjectType)).toEqual(true)
      })

      describe('when split elements contain empty objects', () => {
        it('should filter out empty standard fields object', async () => {
          const { typeName } = CUSTOM_OBJECT_TYPE_ID
          const objectWithNoStandardFields = new ObjectType({
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
              [METADATA_TYPE]: 'NonCustomObject',
              [API_NAME]: 'objectRandom__c',
            },
          })
          const elements = await runFilter(objectWithNoStandardFields.clone())
          expect(elements).toHaveLength(1)
          const [customObject] = elements
          expect(Array.from(customObject.pathIndex?.entries() ?? []))
            .toEqual([
              [
                customObject.elemID.getFullName(),
                [SALESFORCE, OBJECTS_PATH, typeName, 'CustomObjectAnnotations'],
              ],
              [
                customObject.elemID.createNestedID('field', 'custom__c').getFullName(),
                [SALESFORCE, OBJECTS_PATH, typeName, 'CustomObjectCustomFields'],
              ],
              [
                customObject.elemID.createNestedID('field', 'custom_namespace__c').getFullName(),
                [SALESFORCE, OBJECTS_PATH, typeName, 'CustomObjectCustomFields'],
              ],
            ])
          expect(objectWithNoStandardFields.isEqual(customObject as ObjectType)).toEqual(true)
        })
        it('should filter out empty custom fields object', async () => {
          const { typeName } = CUSTOM_OBJECT_TYPE_ID
          const objectWithNoCustomFields = new ObjectType({
            elemID: CUSTOM_OBJECT_TYPE_ID,
            fields: {
              Standard: {
                refType: BuiltinTypes.STRING,
              },
            },
            annotations: {
              [METADATA_TYPE]: CUSTOM_OBJECT,
              [API_NAME]: 'objectRandom__c',
            },
          })
          const elements = await runFilter(objectWithNoCustomFields.clone())
          expect(elements).toHaveLength(1)
          const [customObject] = elements
          expect(Array.from(customObject.pathIndex?.entries() ?? []))
            .toEqual([
              [
                customObject.elemID.getFullName(),
                [SALESFORCE, OBJECTS_PATH, typeName, 'CustomObjectAnnotations'],
              ],
              [
                customObject.elemID.createNestedID('field', 'standard').getFullName(),
                [SALESFORCE, OBJECTS_PATH, typeName, 'CustomObjectStandardFields'],
              ],
            ])
          expect(objectWithNoCustomFields.isEqual(customObject as ObjectType)).toEqual(true)
        })

        it('should not split paths of non-custom object', async () => {
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
          })
          const splitElements = await runFilter(nonCustomObject)
          expect(splitElements).toEqual([nonCustomObject])
          expect(splitElements[0].pathIndex).toEqual(nonCustomObject.pathIndex)
        })
      })
    })
  })
  describe('when using per field file split', () => {
    const filter = (separateFieldToFiles: string[]): FilterType => filterCreator({
      client: mockClient().client,
      config: { ...defaultFilterContext, separateFieldToFiles },
    }) as FilterType

    const runFilter = async (...customObjects: ObjectType[]): Promise<Element[]> => {
      const elements = [...customObjects]
      await filter(['SpecialObject__c']).onFetch(elements)
      return elements
    }
    const typeToSplit = createCustomObjectType(
      'SpecialObject__c',
      {
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
      },
    )
    const otherType = createCustomObjectType(
      'OtherType__c',
      {
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
      },
    )
    let elementsByElemId: Record<string, Element[]>

    beforeEach(async () => {
      const elements = await runFilter(typeToSplit, otherType)
      elementsByElemId = _.groupBy(elements, value => value.elemID.getFullName())
    })

    it('should split the selected type', () => {
      const typeName = 'SpecialObject__c'
      const elemId = new ElemID(SALESFORCE, typeName)
      const elements = elementsByElemId[elemId.getFullName()]
      expect(elements).toBeArrayOfSize(1)
      expect(Array.from(elements[0].pathIndex?.entries() ?? []))
        .toEqual([
          [
            elemId.getFullName(),
            [SALESFORCE, OBJECTS_PATH, typeName, OBJECT_FIELDS_PATH, `${typeName}Annotations`],
          ],
          [
            elemId.createNestedID('field', 'Custom__c').getFullName(),
            [SALESFORCE, OBJECTS_PATH, typeName, OBJECT_FIELDS_PATH, 'Custom__c'],
          ],
          [
            elemId.createNestedID('field', 'OtherCustom__c').getFullName(),
            [SALESFORCE, OBJECTS_PATH, typeName, OBJECT_FIELDS_PATH, 'OtherCustom__c'],
          ],
          [
            elemId.createNestedID('field', 'Standard').getFullName(),
            [SALESFORCE, OBJECTS_PATH, typeName, OBJECT_FIELDS_PATH, 'Standard'],
          ],
        ])
    })
    it('should not split any other type', () => {
      const typeName = 'OtherType__c'
      const elemId = new ElemID(SALESFORCE, typeName)
      const elements = elementsByElemId[elemId.getFullName()]
      expect(elements).toBeArrayOfSize(1)
      expect(Array.from(elements[0].pathIndex?.entries() ?? []))
        .toEqual([
          [
            elemId.getFullName(),
            [SALESFORCE, OBJECTS_PATH, typeName, OBJECT_FIELDS_PATH, `${typeName}Annotations`],
          ],
          [
            elemId.createNestedID('field', 'Custom__c').getFullName(),
            [SALESFORCE, OBJECTS_PATH, typeName, 'OtherType__cCustomFields'],
          ],
          [
            elemId.createNestedID('field', 'OtherCustom__c').getFullName(),
            [SALESFORCE, OBJECTS_PATH, typeName, 'OtherType__cCustomFields'],
          ],
          [
            elemId.createNestedID('field', 'Standard').getFullName(),
            [SALESFORCE, OBJECTS_PATH, typeName, 'OtherType__cStandardFields'],
          ],
        ])
    })
  })
})
