/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ElemID, Field, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { workflowType } from '../../src/autogen/types/standard_types/workflow'
import { entitycustomfieldType } from '../../src/autogen/types/standard_types/entitycustomfield'
import removeSdfElementsValidator from '../../src/change_validators/remove_sdf_elements'
import { CUSTOM_RECORD_TYPE, INTERNAL_ID, METADATA_TYPE, NETSUITE } from '../../src/constants'

describe('remove sdf object change validator', () => {
  const customRecordType = new ObjectType({
    elemID: new ElemID(NETSUITE, 'customrecord1'),
    annotations: { [METADATA_TYPE]: CUSTOM_RECORD_TYPE, [INTERNAL_ID]: '1' },
  })
  const customRecordTypeInstance = new InstanceElement('test', customRecordType)
  const elementsSource = buildElementsSourceFromElements([])

  describe('remove instance of standard type', () => {
    it('should have change error when removing an instance of an unsupported standard type', async () => {
      const standardInstanceNoInternalId = new InstanceElement('test', workflowType().type)

      const changeErrors = await removeSdfElementsValidator([
        toChange({ before: standardInstanceNoInternalId }),
      ], undefined, elementsSource)
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(standardInstanceNoInternalId.elemID)
      expect(changeErrors[0].message).toEqual('Can\'t remove instances of type workflow')
    })

    it('should have change error when removing an instance of standard type with no internal id', async () => {
      const standardInstanceNoInternalId = new InstanceElement('test', entitycustomfieldType().type)

      const changeErrors = await removeSdfElementsValidator([
        toChange({ before: standardInstanceNoInternalId }),
      ], undefined, elementsSource)
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(standardInstanceNoInternalId.elemID)
      expect(changeErrors[0].message).toEqual('Can\'t remove instance of type entitycustomfield')
    })

    it('should not have change error when removing an instance of standard type with internal id', async () => {
      const standardInstance = new InstanceElement('test', entitycustomfieldType().type, { [INTERNAL_ID]: '11' })

      const changeErrors = await removeSdfElementsValidator([
        toChange({ before: standardInstance }),
      ], undefined, elementsSource)
      expect(changeErrors).toHaveLength(0)
    })
  })

  describe('remove instance of custom record type', () => {
    it('should not have change error when removing an instance with non standard type', async () => {
      const changeErrors = await removeSdfElementsValidator([
        toChange({ before: customRecordTypeInstance }),
      ], undefined, elementsSource)
      expect(changeErrors).toHaveLength(0)
    })
  })

  describe('remove custom record type', () => {
    it('should have change error when removing a custom record type with no internal id', async () => {
      const customRecordTypeNoInternalID = new ObjectType({
        elemID: new ElemID(NETSUITE, 'customrecord2'),
        annotations: { [METADATA_TYPE]: CUSTOM_RECORD_TYPE },
      })

      const changeErrors = await removeSdfElementsValidator([
        toChange({ before: customRecordTypeNoInternalID }),
      ], undefined, elementsSource)
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(customRecordTypeNoInternalID.elemID)
    })

    it('should have change warning when removing a custom record type with internal id', async () => {
      const instanceOfAnotherType = new InstanceElement('test', new ObjectType({
        elemID: new ElemID(NETSUITE, 'another_customrecord1'),
        annotations: { [METADATA_TYPE]: CUSTOM_RECORD_TYPE, [INTERNAL_ID]: '1' },
      }))

      const changeErrors = await removeSdfElementsValidator([
        toChange({ before: customRecordType }),
        toChange({ before: instanceOfAnotherType }),
      ], undefined, elementsSource)
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Warning')
      expect(changeErrors[0].elemID).toEqual(customRecordType.elemID)
    })

    it('should have change error when removing a custom record type with internal id when instances exists in the index', async () => {
      const elementsSourceInstance = buildElementsSourceFromElements([customRecordTypeInstance])

      const changeErrors = await removeSdfElementsValidator([
        toChange({ before: customRecordType }),
      ], undefined, elementsSourceInstance)
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(customRecordType.elemID)
    })
  })

  describe('remove fields', () => {
    const field = new Field(customRecordType, 'internalId', customRecordType)

    it('should have change error on the field when removing a field without its custom record type', async () => {
      const anotherCustomRecordType = new ObjectType({
        elemID: new ElemID(NETSUITE, 'another_customrecord1'),
        annotations: { [METADATA_TYPE]: CUSTOM_RECORD_TYPE, [INTERNAL_ID]: '1' },
      })

      const changeErrors = await removeSdfElementsValidator([
        toChange({ before: field }),
        toChange({ before: anotherCustomRecordType }),
      ], undefined, elementsSource)
      expect(changeErrors).toHaveLength(2)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(field.elemID)
      expect(changeErrors[1].severity).toEqual('Warning')
      expect(changeErrors[1].elemID).toEqual(anotherCustomRecordType.elemID)
    })

    it('should have change warning on the custom record type when removing a field with its custom record type', async () => {
      const changeErrors = await removeSdfElementsValidator([
        toChange({ before: field }),
        toChange({ before: customRecordType }),
      ], undefined, elementsSource)
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Warning')
      expect(changeErrors[0].elemID).toEqual(customRecordType.elemID)
    })
  })
})
