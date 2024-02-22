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
import _ from 'lodash'
import {
  InstanceElement,
  ObjectType,
  ElemID,
  BuiltinTypes,
  ReferenceExpression,
  ListType,
} from '@salto-io/adapter-api'
import {
  INSTANCE_FULL_NAME_FIELD,
  SALESFORCE,
  FOREIGN_KEY_DOMAIN,
} from '../../src/constants'
import referenceAnnotationfilterCreator from '../../src/filters/reference_annotations'
import filterCreator from '../../src/filters/foreign_key_references'
import { defaultFilterContext, createMetadataTypeElement } from '../utils'
import { FilterWith } from './mocks'

// Based on the instance_reference test scenarios
describe('foregin_key_references filter', () => {
  const refAnnotationFilter = referenceAnnotationfilterCreator({
    config: defaultFilterContext,
  }) as FilterWith<'onFetch'>
  const filter = filterCreator({
    config: defaultFilterContext,
  }) as FilterWith<'onFetch'>

  const parentObjFullName = 'parentFullName'
  const parentObjFieldName = 'parentObj'
  const invalidRefFieldName = 'invalidRef'
  const objTypeID = new ElemID(SALESFORCE, 'obj')

  let objType: ObjectType
  let nestedType: ObjectType
  let parentInstance: InstanceElement
  let referrerInstance: InstanceElement
  let instanceWithoutReferences: InstanceElement
  let objTypeElements: ObjectType[]
  let instanceElements: InstanceElement[]

  const generateElements = (): void => {
    nestedType = createMetadataTypeElement('nested', {
      fields: {
        [parentObjFieldName]: {
          annotations: {
            [FOREIGN_KEY_DOMAIN]: [objTypeID.typeName],
          },
          refType: BuiltinTypes.STRING,
        },
        [invalidRefFieldName]: {
          annotations: {
            [FOREIGN_KEY_DOMAIN]: ['nonExistingType'],
          },
          refType: BuiltinTypes.STRING,
        },
      },
    })
    objType = createMetadataTypeElement('obj', {
      fields: {
        reg: { refType: BuiltinTypes.STRING },
        [parentObjFieldName]: {
          annotations: {
            [FOREIGN_KEY_DOMAIN]: [objTypeID.typeName],
          },
          refType: BuiltinTypes.STRING,
        },
        [invalidRefFieldName]: {
          annotations: {
            [FOREIGN_KEY_DOMAIN]: ['nonExistingType'],
          },
          refType: BuiltinTypes.STRING,
        },
        parentObjNested: { refType: nestedType },
        parentObjArr: {
          annotations: {
            [FOREIGN_KEY_DOMAIN]: [objTypeID.typeName],
          },
          refType: new ListType(BuiltinTypes.STRING),
        },
      },
    })

    // Instances
    parentInstance = new InstanceElement('parentInstance', objType, {
      [INSTANCE_FULL_NAME_FIELD]: parentObjFullName,
      reg: 'orig',
      parentObjNested: {
        nestedInst: 'InstRef',
      },
      parentObjArr: ['arrValue'],
    })
    referrerInstance = new InstanceElement('referrerInstance', objType, {
      [INSTANCE_FULL_NAME_FIELD]: 'referrerInstance',
      [parentObjFieldName]: parentObjFullName,
      [invalidRefFieldName]: parentObjFullName,
      reg: 'someRegularValue',
      parentObjNested: {
        [parentObjFieldName]: parentObjFullName,
      },
      parentObjArr: [parentObjFullName],
    })
    instanceWithoutReferences = new InstanceElement(
      'instanceWithoutReferences',
      objType,
      {
        [INSTANCE_FULL_NAME_FIELD]: 'noChangesInstance',
        reg: 'somevalue',
        [parentObjFieldName]: 'someRef',
      },
    )
  }

  beforeAll(async () => {
    generateElements()
    objTypeElements = [nestedType, objType].map((elem) => elem)
    instanceElements = [
      parentInstance,
      referrerInstance,
      instanceWithoutReferences,
    ].map((elem) => elem)

    const elements = [...objTypeElements, ...instanceElements]

    // run the reference annotation filter to resolve the FOREIGN_KEY_DOMAIN references
    await refAnnotationFilter.onFetch(elements)
    await filter.onFetch(elements)
  })

  // Test the results
  describe('convert values to references', () => {
    it('should convert regular values to references', () => {
      expect(instanceElements[1].value.parentObj).toBeInstanceOf(
        ReferenceExpression,
      )
      expect(instanceElements[1].value.parentObj.elemID.typeName).toEqual(
        objTypeID.typeName,
      )
    })

    it('should convert nested objects to references', () => {
      expect(
        instanceElements[1].value.parentObjNested.parentObj,
      ).toBeInstanceOf(ReferenceExpression)
    })

    it('should convert objects in arrays to references', () => {
      expect(_.head(instanceElements[1].value.parentObjArr)).toBeInstanceOf(
        ReferenceExpression,
      )
    })

    it('should not change an instance without valid references', () => {
      expect(instanceElements[0]).toStrictEqual(parentInstance)
      expect(instanceElements[2]).toStrictEqual(instanceWithoutReferences)
    })

    it('should not replace regular values', () => {
      expect(instanceElements[0].value.reg).toEqual(parentInstance.value.reg)
      expect(instanceElements[1].value.reg).toEqual(referrerInstance.value.reg)
    })

    it('should not replace a ref that has a foreign key annotation for a non-existing type', () => {
      expect(instanceElements[1].value[invalidRefFieldName]).toEqual(
        parentObjFullName,
      )
    })

    it('should convert foreignKeyDomain annotations to references when valid', () => {
      expect(
        objTypeElements[0].fields[parentObjFieldName].annotations[
          FOREIGN_KEY_DOMAIN
        ][0],
      ).toBeInstanceOf(ReferenceExpression)
      expect(
        objTypeElements[1].fields[parentObjFieldName].annotations[
          FOREIGN_KEY_DOMAIN
        ][0],
      ).toBeInstanceOf(ReferenceExpression)
    })

    it('should not convert foreignKeyDomain annotations to references when not valid', () => {
      expect(
        objTypeElements[0].fields[invalidRefFieldName].annotations[
          FOREIGN_KEY_DOMAIN
        ],
      ).toEqual(['nonExistingType'])
      expect(
        objTypeElements[1].fields[invalidRefFieldName].annotations[
          FOREIGN_KEY_DOMAIN
        ],
      ).toEqual(['nonExistingType'])
    })
  })
})
