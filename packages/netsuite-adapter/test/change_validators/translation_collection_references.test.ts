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
import { BuiltinTypes, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import translationCollectionValidator from '../../src/change_validators/translation_collection_references'
import { addressFormType } from '../../src/autogen/types/standard_types/addressForm'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE } from '../../src/constants'

describe('translation collection change validator', () => {
  const addressFormInstance = new InstanceElement('test', addressFormType().type, {
    field: '[scriptid=custcollection1]',
  })
  const nestedRefInstance = new InstanceElement('test1', addressFormType().type, {
    field: '[type=custcollection, scriptid=custcollection2]',
    field2: '[scriptid=custcollection3.inner]',
  })
  const noReferenceInstance = new InstanceElement('test2', addressFormType().type, {})
  it("should return changeError in case there's a NS reference to a translation collection", async () => {
    const changes = [{ after: addressFormInstance }, { after: noReferenceInstance }, { after: nestedRefInstance }].map(
      toChange,
    )
    const changeErrors = await translationCollectionValidator(changes)
    expect(changeErrors).toHaveLength(2)
    expect(changeErrors[0]).toEqual({
      elemID: addressFormInstance.elemID,
      severity: 'Error',
      message: 'Cannot deploy element with invalid translation reference',
      detailedMessage:
        "Cannot deploy this element because it contains a reference to the following translation collection that do not exist in your environment: 'custcollection1'." +
        ' To proceed with the deployment, please edit the NACL and replace the reference with a valid string. After the deployment, you can reconnect the elements in the NetSuite UI.',
    })
    expect(changeErrors[1]).toEqual({
      elemID: nestedRefInstance.elemID,
      severity: 'Error',
      message: 'Cannot deploy element with invalid translation reference',
      detailedMessage:
        "Cannot deploy this element because it contains references to the following translation collections that do not exist in your environment: 'custcollection2', 'custcollection3'." +
        ' To proceed with the deployment, please edit the NACL and replace the references with valid strings. After the deployment, you can reconnect the elements in the NetSuite UI.',
    })
  })
  describe('when have field changes', () => {
    let customRecordType: ObjectType
    beforeEach(() => {
      customRecordType = new ObjectType({
        elemID: new ElemID(NETSUITE, 'customrecord123'),
        fields: {
          fieldWithRef: {
            refType: BuiltinTypes.STRING,
            annotations: {
              ref: '[scriptid=custcollection1]',
            },
          },
          fieldWithoutRef: {
            refType: BuiltinTypes.STRING,
          },
        },
        annotations: {
          ref: '[scriptid=custcollection2]',
          [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
        },
      })
    })
    it('should have change error on parent only when it is a change', async () => {
      const changes = [{ after: customRecordType }, { after: customRecordType.fields.fieldWithoutRef }].map(toChange)
      const changeErrors = await translationCollectionValidator(changes)
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0]).toEqual({
        elemID: customRecordType.elemID,
        severity: 'Error',
        message: 'Cannot deploy element with invalid translation reference',
        detailedMessage:
          "Cannot deploy this element because it contains references to the following translation collections that do not exist in your environment: 'custcollection2', 'custcollection1'." +
          ' To proceed with the deployment, please edit the NACL and replace the references with valid strings. After the deployment, you can reconnect the elements in the NetSuite UI.',
      })
    })
    it('should have change error on field only when it has invalid reference', async () => {
      const changes = [{ after: customRecordType.fields.fieldWithRef }].map(toChange)
      delete customRecordType.annotations.ref
      const changeErrors = await translationCollectionValidator(changes)
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0]).toEqual({
        elemID: customRecordType.fields.fieldWithRef.elemID,
        severity: 'Error',
        message: 'Cannot deploy element with invalid translation reference',
        detailedMessage:
          "Cannot deploy this element because it contains a reference to the following translation collection that do not exist in your environment: 'custcollection1'." +
          ' To proceed with the deployment, please edit the NACL and replace the reference with a valid string. After the deployment, you can reconnect the elements in the NetSuite UI.',
      })
    })
    it('should have change error on field when parent has invalid reference', async () => {
      const changes = [{ after: customRecordType.fields.fieldWithoutRef }].map(toChange)
      const changeErrors = await translationCollectionValidator(changes)
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0]).toEqual({
        elemID: customRecordType.fields.fieldWithoutRef.elemID,
        severity: 'Error',
        message: 'Cannot deploy element with invalid translation reference',
        detailedMessage:
          "Cannot deploy this field because its parent type contains references to the following translation collections that do not exist in your environment: 'custcollection2', 'custcollection1'." +
          ' To proceed with the deployment, please edit the NACL and replace the references with valid strings. After the deployment, you can reconnect the elements in the NetSuite UI.',
      })
    })
    it('should have change error on field when field and parent have invalid reference', async () => {
      const changes = [{ after: customRecordType.fields.fieldWithRef }].map(toChange)
      const changeErrors = await translationCollectionValidator(changes)
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0]).toEqual({
        elemID: customRecordType.fields.fieldWithRef.elemID,
        severity: 'Error',
        message: 'Cannot deploy element with invalid translation reference',
        detailedMessage:
          "Cannot deploy this field because it contains a reference to the following translation collection that do not exist in your environment: 'custcollection1'." +
          " In addition, its parent type contains a reference to the following translation collection that do not exist in your environment: 'custcollection2'." +
          ' To proceed with the deployment, please edit the NACL and replace the references with valid strings. After the deployment, you can reconnect the elements in the NetSuite UI.',
      })
    })
  })
})
