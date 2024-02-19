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
import { ObjectType, ElemID, InstanceElement, BuiltinTypes } from '@salto-io/adapter-api'
import { ZUORA_BILLING } from '../src/constants'
import { isObjectDef, isCustomField, metadataType } from '../src/element_utils'

describe('element utils', () => {
  describe('isObjectDef', () => {
    it('should return true for object types with the right value in the metadata type annotation', async () => {
      expect(
        await isObjectDef(
          new ObjectType({
            elemID: new ElemID(ZUORA_BILLING, 'anything'),
            annotations: {
              metadataType: 'CustomObject',
            },
          }),
        ),
      ).toBeTruthy()
      expect(
        await isObjectDef(
          new ObjectType({
            elemID: new ElemID(ZUORA_BILLING, 'anything'),
            annotations: {
              metadataType: 'StandardObject',
            },
          }),
        ),
      ).toBeTruthy()
    })
    it('should return false for elements that are not object types', async () => {
      const type = new ObjectType({
        elemID: new ElemID(ZUORA_BILLING, 'CustomObject'),
        fields: {
          f: {
            refType: BuiltinTypes.STRING,
            annotations: { metadataType: 'CustomObject' },
          },
        },
        annotations: { metadataType: 'CustomObject' },
      })
      expect(
        await isObjectDef(new InstanceElement('CustomObject', type, {}, undefined, { metadataType: 'CustomObject' })),
      ).toBeFalsy()
      expect(await isObjectDef(type.fields.f)).toBeFalsy()
    })
  })

  describe('metadataType', () => {
    it('should return the metadataType annotation value for object types', async () => {
      expect(
        await metadataType(
          new ObjectType({
            elemID: new ElemID(ZUORA_BILLING, 'anything'),
            annotations: {
              metadataType: 'AAA',
            },
          }),
        ),
      ).toEqual('AAA')
      expect(
        await metadataType(
          new ObjectType({
            elemID: new ElemID(ZUORA_BILLING, 'anything'),
          }),
        ),
      ).toBeUndefined()
    })
    it("should return the type's metadata type for instances", async () => {
      const type = new ObjectType({
        elemID: new ElemID(ZUORA_BILLING, 'anything'),
        annotations: {
          metadataType: 'AAA',
        },
      })
      expect(await metadataType(new InstanceElement('a', type, {}, undefined, { metadataType: 'BBB' }))).toEqual('AAA')
    })
    it('should return CustomField for fields', async () => {
      const type = new ObjectType({
        elemID: new ElemID(ZUORA_BILLING, 'anything'),
        fields: {
          f: {
            refType: BuiltinTypes.STRING,
            annotations: { metadataType: 'CCC' },
          },
        },
        annotations: { metadataType: 'AAA' },
      })
      expect(await metadataType(type.fields.f)).toEqual('CustomField')
    })
  })

  describe('isCustomField', () => {
    let type: ObjectType
    beforeAll(() => {
      type = new ObjectType({
        elemID: new ElemID(ZUORA_BILLING, 'anything'),
        fields: {
          f1: {
            refType: BuiltinTypes.STRING,
            annotations: { origin: 'custom' },
          },
          f2__c: { refType: BuiltinTypes.STRING },
          f3: { refType: BuiltinTypes.STRING },
        },
      })
    })
    it('should return true for custom fields', () => {
      expect(isCustomField(type.fields.f1)).toBeTruthy()
      expect(isCustomField(type.fields.f2__c)).toBeTruthy()
    })
    it('should return false for fields not identified as custom', () => {
      expect(isCustomField(type.fields.f3)).toBeFalsy()
    })
  })
})
