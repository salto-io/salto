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
import {
  BuiltinTypes, ElemID, InstanceElement, ObjectType,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterWith } from '../../src/filter'
import {
  IS_ATTRIBUTE, METADATA_TYPE, SALESFORCE, XML_ATTRIBUTE_PREFIX, INSTANCE_FULL_NAME_FIELD,
} from '../../src/constants'
import filterCreator from '../../src/filters/xml_attributes'

const isAttributeTrue = 'isAttributeTrue'
const isAttributeFalse = 'isAttributeFalse'
const noIsAttribute = 'noIsAttribute'

const withAttributePrefix = (str: string): string => `${XML_ATTRIBUTE_PREFIX}${str}`

describe('XML Attributes Filter', () => {
  const typeWithAttributes = new ObjectType({
    elemID: new ElemID(SALESFORCE, 'someType'),
    fields: {
      [isAttributeTrue]: {
        type: BuiltinTypes.STRING,
        annotations: {
          [IS_ATTRIBUTE]: true,
        },
      },
      [isAttributeFalse]: {
        type: BuiltinTypes.STRING,
        annotations: {
          [IS_ATTRIBUTE]: false,
        },
      },
      [noIsAttribute]: {
        type: BuiltinTypes.STRING,
      },
    },
    annotations: {
      [METADATA_TYPE]: 'LightningComponentBundle',
    },
  })

  const typeWithoutAttributes = typeWithAttributes.clone(
    { [METADATA_TYPE]: 'TypeWithoutAttributes' }
  )

  const filter = filterCreator() as FilterWith<'onFetch'>


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

    beforeAll(async () => {
      await filter.onFetch([instanceWithAttributes, instanceWithoutAttributes])
    })

    it('should remove the XML_ATTRIBUTE_PREFIX prefix from keys when type has attributes', async () => {
      expect(instanceWithAttributes.value[isAttributeTrue]).toEqual(isAttributeTrue)
      expect(instanceWithAttributes.value[isAttributeFalse]).toEqual(isAttributeFalse)
      expect(instanceWithAttributes.value[noIsAttribute]).toEqual(noIsAttribute)
      expect(instanceWithAttributes.value[withAttributePrefix(isAttributeTrue)]).toBeUndefined()
      expect(instanceWithAttributes.value[withAttributePrefix(isAttributeFalse)]).toBeUndefined()
      expect(instanceWithAttributes.value[withAttributePrefix(noIsAttribute)]).toBeUndefined()
    })

    it('should not remove the XML_ATTRIBUTE_PREFIX prefix from keys when type has no attributes', async () => {
      expect(instanceWithoutAttributes.value[isAttributeTrue]).toBeUndefined()
      expect(instanceWithoutAttributes.value[isAttributeFalse]).toBeUndefined()
      expect(instanceWithoutAttributes.value[noIsAttribute]).toBeUndefined()
      expect(instanceWithoutAttributes.value[withAttributePrefix(isAttributeTrue)])
        .toEqual(isAttributeTrue)
      expect(instanceWithoutAttributes.value[withAttributePrefix(isAttributeFalse)])
        .toEqual(isAttributeFalse)
      expect(instanceWithoutAttributes.value[withAttributePrefix(noIsAttribute)])
        .toEqual(noIsAttribute)
    })
  })
})
