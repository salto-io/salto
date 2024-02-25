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
  BuiltinTypes,
  ElemID,
  InstanceElement,
  ObjectType,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import {
  IS_ATTRIBUTE,
  METADATA_TYPE,
  SALESFORCE,
  XML_ATTRIBUTE_PREFIX,
  INSTANCE_FULL_NAME_FIELD,
  LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE,
} from '../../src/constants'
import filterCreator from '../../src/filters/xml_attributes'
import { defaultFilterContext } from '../utils'
import { FilterWith } from './mocks'

const isAttributeTrue = 'isAttributeTrue'
const isAttributeFalse = 'isAttributeFalse'
const noIsAttribute = 'noIsAttribute'
const fieldWithAttributes = 'fieldWithAttributes'
const fieldWithoutAttributes = 'fieldWithoutAttributes'

const withAttributePrefix = (str: string): string =>
  `${XML_ATTRIBUTE_PREFIX}${str}`

describe('XML Attributes Filter', () => {
  const typeWithAttributes = new ObjectType({
    elemID: new ElemID(SALESFORCE, 'someType'),
    fields: {
      [isAttributeTrue]: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [IS_ATTRIBUTE]: true,
        },
      },
      [isAttributeFalse]: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [IS_ATTRIBUTE]: false,
        },
      },
      [noIsAttribute]: {
        refType: BuiltinTypes.STRING,
      },
    },
    annotations: {
      [METADATA_TYPE]: LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE,
    },
  })

  const typeWithoutAttributes = typeWithAttributes.clone({
    [METADATA_TYPE]: 'TypeWithoutAttributes',
  })

  const nestedTypeWithAttributes = new ObjectType({
    elemID: new ElemID(SALESFORCE, 'parentType'),
    fields: {
      [fieldWithAttributes]: {
        refType: typeWithAttributes,
      },
      [fieldWithoutAttributes]: {
        refType: typeWithoutAttributes,
      },
    },
    annotations: {
      [METADATA_TYPE]: LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE,
    },
  })

  const filter = filterCreator({
    config: defaultFilterContext,
  }) as FilterWith<'onFetch'>

  describe('onFetch', () => {
    const instanceValues = {
      [INSTANCE_FULL_NAME_FIELD]: 'instanceWithAttributes',
      [withAttributePrefix(isAttributeTrue)]: isAttributeTrue,
      [withAttributePrefix(isAttributeFalse)]: isAttributeFalse,
      [withAttributePrefix(noIsAttribute)]: noIsAttribute,
    }

    const instanceWithAttributes = new InstanceElement(
      'instanceWithAttributes',
      typeWithAttributes,
      _.clone(instanceValues),
    )

    const instanceWithoutAttributes = new InstanceElement(
      'instanceWithAttributes',
      typeWithoutAttributes,
      _.clone(instanceValues),
    )

    const instanceWithNestedAttributes = new InstanceElement(
      'instanceWithNestedAttributes',
      nestedTypeWithAttributes,
      {
        [fieldWithAttributes]: _.clone(instanceValues),
        [fieldWithoutAttributes]: _.clone(instanceValues),
      },
    )

    beforeAll(async () => {
      await filter.onFetch([
        instanceWithAttributes,
        instanceWithoutAttributes,
        instanceWithNestedAttributes,
      ])
    })

    it('should remove the XML_ATTRIBUTE_PREFIX prefix from keys when type has attributes', async () => {
      expect(instanceWithAttributes.value[isAttributeTrue]).toEqual(
        isAttributeTrue,
      )
      expect(instanceWithAttributes.value[isAttributeFalse]).toBeUndefined()
      expect(instanceWithAttributes.value[noIsAttribute]).toBeUndefined()
      expect(
        instanceWithAttributes.value[withAttributePrefix(isAttributeTrue)],
      ).toBeUndefined()
      expect(
        instanceWithAttributes.value[withAttributePrefix(isAttributeFalse)],
      ).toEqual(isAttributeFalse)
      expect(
        instanceWithAttributes.value[withAttributePrefix(noIsAttribute)],
      ).toEqual(noIsAttribute)
    })

    it('should not remove the XML_ATTRIBUTE_PREFIX prefix from keys when type has no attributes', async () => {
      expect(instanceWithoutAttributes.value[isAttributeTrue]).toBeUndefined()
      expect(instanceWithoutAttributes.value[isAttributeFalse]).toBeUndefined()
      expect(instanceWithoutAttributes.value[noIsAttribute]).toBeUndefined()
      expect(
        instanceWithoutAttributes.value[withAttributePrefix(isAttributeTrue)],
      ).toEqual(isAttributeTrue)
      expect(
        instanceWithoutAttributes.value[withAttributePrefix(isAttributeFalse)],
      ).toEqual(isAttributeFalse)
      expect(
        instanceWithoutAttributes.value[withAttributePrefix(noIsAttribute)],
      ).toEqual(noIsAttribute)
    })

    it('should remove the XML_ATTRIBUTE_PREFIX prefix from nested fields', async () => {
      const nestedField =
        instanceWithNestedAttributes.value[fieldWithAttributes]
      expect(nestedField[isAttributeTrue]).toEqual(isAttributeTrue)
      expect(nestedField[isAttributeFalse]).toBeUndefined()
      expect(nestedField[noIsAttribute]).toBeUndefined()
      expect(nestedField[withAttributePrefix(isAttributeTrue)]).toBeUndefined()
      expect(nestedField[withAttributePrefix(isAttributeFalse)]).toEqual(
        isAttributeFalse,
      )
      expect(nestedField[withAttributePrefix(noIsAttribute)]).toEqual(
        noIsAttribute,
      )
    })

    it('should remove the XML_ATTRIBUTE_PREFIX prefix from nested fields even for a type without attributes', async () => {
      const nestedField =
        instanceWithNestedAttributes.value[fieldWithoutAttributes]
      expect(nestedField[isAttributeTrue]).toEqual(isAttributeTrue)
      expect(nestedField[isAttributeFalse]).toBeUndefined()
      expect(nestedField[noIsAttribute]).toBeUndefined()
      expect(nestedField[withAttributePrefix(isAttributeTrue)]).toBeUndefined()
      expect(nestedField[withAttributePrefix(isAttributeFalse)]).toEqual(
        isAttributeFalse,
      )
      expect(nestedField[withAttributePrefix(noIsAttribute)]).toEqual(
        noIsAttribute,
      )
    })
  })
})
