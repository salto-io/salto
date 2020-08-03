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
import { ObjectType, ElemID, BuiltinTypes, ReferenceExpression } from '@salto-io/adapter-api'
import { SALESFORCE, METADATA_TYPE, FIELD_ANNOTATIONS, FOREIGN_KEY_DOMAIN } from '../../src/constants'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'
import filterCreator from '../../src/filters/reference_annotations'

describe('reference_annotations filter', () => {
  // Definitions
  const parentObjFieldName = 'parentObj'
  const nestedId = new ElemID(SALESFORCE, 'nested')
  const objTypeID = new ElemID(SALESFORCE, 'obj')

  const { client } = mockClient()
  const filter = filterCreator({ client, config: {} }) as FilterWith<'onFetch'>

  let nestedType: ObjectType
  let objType: ObjectType
  beforeAll(async () => {
    nestedType = new ObjectType({
      elemID: nestedId,
      fields: {
        [parentObjFieldName]: {
          annotations: {
            [FIELD_ANNOTATIONS.REFERENCE_TO]: [
              'obj',
              'unknown',
            ],
            [FOREIGN_KEY_DOMAIN]: [
              objTypeID.typeName,
              'something',
            ],
          },
          type: BuiltinTypes.STRING,
        },
      },
    })
    objType = new ObjectType({
      annotations: { [METADATA_TYPE]: 'obj' },
      elemID: objTypeID,
      fields: {
        reg: { type: BuiltinTypes.STRING },
      },
    })
    const elements = [nestedType, objType]
    await filter.onFetch(elements)
  })

  describe('replace values', () => {
    it('should convert REFERENCE_TO to reference when found', () => {
      expect(
        nestedType.fields[parentObjFieldName].annotations[FIELD_ANNOTATIONS.REFERENCE_TO]
      ).toHaveLength(2)
      expect(
        nestedType.fields[parentObjFieldName].annotations[FIELD_ANNOTATIONS.REFERENCE_TO][0]
      ).toBeInstanceOf(ReferenceExpression)
      expect(
        nestedType.fields[parentObjFieldName].annotations[FIELD_ANNOTATIONS.REFERENCE_TO][0].elemId
      ).toEqual(objTypeID)
      expect(nestedType.fields[parentObjFieldName].annotations[FIELD_ANNOTATIONS.REFERENCE_TO][1]).toEqual('unknown')
    })
    it('should convert FOREIGN_KEY_DOMAIN to reference when found', () => {
      expect(
        nestedType.fields[parentObjFieldName].annotations[FOREIGN_KEY_DOMAIN]
      ).toHaveLength(2)
      expect(
        nestedType.fields[parentObjFieldName].annotations[FOREIGN_KEY_DOMAIN][0]
      ).toBeInstanceOf(ReferenceExpression)
      expect(
        nestedType.fields[parentObjFieldName].annotations[FOREIGN_KEY_DOMAIN][0].elemId
      ).toEqual(objTypeID)
      expect(nestedType.fields[parentObjFieldName].annotations[FOREIGN_KEY_DOMAIN][1]).toEqual('something')
    })
  })
})
