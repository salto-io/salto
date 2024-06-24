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
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import {
  INSUFFICIENT_PERMISSION_ERROR,
  PLATFORM_CORE_CUSTOM_FIELD,
} from '../../../../src/client/suiteapp_client/constants'
import { WriteResponse, WriteResponseError } from '../../../../src/client/suiteapp_client/soap_client/types'
import { removeUneditableLockedField } from '../../../../src/client/suiteapp_client/soap_client/filter_uneditable_locked_field'
import {
  CRM_CUSTOM_FIELD,
  CRM_CUSTOM_FIELD_PREFIX,
  CUSTOM_FIELD_LIST,
  CUSTOM_RECORD_TYPE,
  ENTITY_CUSTOM_FIELD,
  ENTITY_CUSTOM_FIELD_PREFIX,
  ITEM_CUSTOM_FIELD,
  ITEM_CUSTOM_FIELD_PREFIX,
  METADATA_TYPE,
  NETSUITE,
  OTHER_CUSTOM_FIELD,
  OTHER_CUSTOM_FIELD_PREFIX,
  SOAP,
  SOAP_SCRIPT_ID,
} from '../../../../src/constants'

const { awu } = collections.asynciterable

describe('Filter uneditable locked fields', () => {
  const emptyElementsSource = buildElementsSourceFromElements([])

  const otherCustomField = {
    attributes: {
      [SOAP_SCRIPT_ID]: `${OTHER_CUSTOM_FIELD_PREFIX}test`,
      'xsi:type': 'platformCore:BooleanCustomFieldRef',
      'platformCore:value': true,
    },
  }

  const entityCustomField = {
    attributes: {
      [SOAP_SCRIPT_ID]: `${ENTITY_CUSTOM_FIELD_PREFIX}test`,
      'xsi:type': 'platformCore:BooleanCustomFieldRef',
      'platformCore:value': true,
    },
  }

  const itemCustomField = {
    attributes: {
      [SOAP_SCRIPT_ID]: `${ITEM_CUSTOM_FIELD_PREFIX}test`,
      'xsi:type': 'platformCore:BooleanCustomFieldRef',
      'platformCore:value': true,
    },
  }

  const crmCustomField = {
    attributes: {
      [SOAP_SCRIPT_ID]: `${CRM_CUSTOM_FIELD_PREFIX}test`,
      'xsi:type': 'platformCore:BooleanCustomFieldRef',
      'platformCore:value': true,
    },
  }

  const otherCustomFieldInstance = new InstanceElement(
    otherCustomField.attributes[SOAP_SCRIPT_ID],
    new ObjectType({ elemID: new ElemID(NETSUITE, OTHER_CUSTOM_FIELD) }),
  )
  const entityCustomFieldInstance = new InstanceElement(
    entityCustomField.attributes[SOAP_SCRIPT_ID],
    new ObjectType({ elemID: new ElemID(NETSUITE, ENTITY_CUSTOM_FIELD) }),
  )
  const itemCustomFieldInstance = new InstanceElement(
    itemCustomField.attributes[SOAP_SCRIPT_ID],
    new ObjectType({ elemID: new ElemID(NETSUITE, ITEM_CUSTOM_FIELD) }),
  )
  const crmCustomFieldInstance = new InstanceElement(
    crmCustomField.attributes[SOAP_SCRIPT_ID],
    new ObjectType({ elemID: new ElemID(NETSUITE, CRM_CUSTOM_FIELD) }),
  )

  const testType = new ObjectType({ elemID: new ElemID(NETSUITE, 'testType') })

  const getWriteResponseError = (fieldName: string): WriteResponseError => ({
    status: {
      attributes: {
        isSuccess: 'false',
      },
      statusDetail: [
        {
          code: INSUFFICIENT_PERMISSION_ERROR,
          message:
            `You do not have permissions to set a value for element ${fieldName} due to one of the following reasons:` +
            ' 1) The field is read-only;' +
            ' 2) An associated feature is disabled;' +
            ' 3) The field is available either when a record is created or updated, but not in both cases.',
        },
      ],
    },
  })

  const otherError = getWriteResponseError(otherCustomField.attributes[SOAP_SCRIPT_ID])
  const entityError = getWriteResponseError(entityCustomField.attributes[SOAP_SCRIPT_ID])
  const itemError = getWriteResponseError(itemCustomField.attributes[SOAP_SCRIPT_ID])
  const crmError = getWriteResponseError(crmCustomField.attributes[SOAP_SCRIPT_ID])

  const allErrors = [otherError, entityError, itemError, crmError]

  const otherInstance = new InstanceElement('testOther', testType, {
    attributes: {
      internalId: '1',
    },
    [CUSTOM_FIELD_LIST]: {
      [PLATFORM_CORE_CUSTOM_FIELD]: [otherCustomField],
    },
  })
  const entityInstance = new InstanceElement('testEntity', testType, {
    attributes: {
      internalId: '2',
    },
    [CUSTOM_FIELD_LIST]: {
      [PLATFORM_CORE_CUSTOM_FIELD]: [entityCustomField],
    },
  })
  const itemInstance = new InstanceElement('testItem', testType, {
    attributes: {
      internalId: '3',
    },
    [CUSTOM_FIELD_LIST]: {
      [PLATFORM_CORE_CUSTOM_FIELD]: [itemCustomField],
    },
  })
  const crmInstance = new InstanceElement('testCRM', testType, {
    attributes: {
      internalId: '4',
    },
    [CUSTOM_FIELD_LIST]: {
      [PLATFORM_CORE_CUSTOM_FIELD]: [crmCustomField],
    },
  })

  const allInstancesOriginal = [otherInstance, entityInstance, itemInstance, crmInstance]

  let allInstances: InstanceElement[]
  beforeEach(() => {
    allInstances = allInstancesOriginal.map(instance => instance.clone())
  })

  describe("Modify instances that have a locked field that failed with 'INSUFFICIENT_PERMISSION'", () => {
    it('Should remove all locked custom fields of all field types', async () => {
      const areModified = await awu(allInstances)
        .map((instance, index) => removeUneditableLockedField(instance, allErrors[index], emptyElementsSource.has))
        .toArray()

      expect(areModified).toEqual([true, true, true, true])
      expect(
        allInstances.map(modifiedInstance => modifiedInstance.value[CUSTOM_FIELD_LIST]).filter(_.isUndefined),
      ).toHaveLength(4)
    })

    it('Should not delete customFieldList if more than 1 custom field exist', async () => {
      const instance = new InstanceElement('testOther', testType, {
        attributes: {
          internalId: '1',
        },
        [CUSTOM_FIELD_LIST]: {
          [PLATFORM_CORE_CUSTOM_FIELD]: [otherCustomField, entityCustomField],
        },
      })

      const isModified = await removeUneditableLockedField(instance, otherError, emptyElementsSource.has)
      expect(isModified).toBeTruthy()
      expect(instance.value[CUSTOM_FIELD_LIST]).toBeDefined()
      expect(instance.value[CUSTOM_FIELD_LIST][PLATFORM_CORE_CUSTOM_FIELD]).toEqual([entityCustomField])
    })
  })

  it('Should not modify custom record instances', async () => {
    const customRecordType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord1'),
      annotations: {
        source: SOAP,
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      },
    })
    const customRecordInstanceOriginal = new InstanceElement('customRecordInstance', customRecordType, {
      attributes: {
        internalId: '5',
      },
      [CUSTOM_FIELD_LIST]: {
        [PLATFORM_CORE_CUSTOM_FIELD]: [crmCustomField],
      },
    })

    const customRecordInstance = customRecordInstanceOriginal.clone()
    const isModified = await removeUneditableLockedField(customRecordInstance, crmError, emptyElementsSource.has)
    expect(isModified).toBeFalsy()
    expect(customRecordInstance).toEqual(customRecordInstanceOriginal)
  })

  it('Should not modify the instances when the INSUFFICIENT PERMISSION error is caused by unlocked element', async () => {
    const elementsSource = buildElementsSourceFromElements([
      otherCustomFieldInstance,
      entityCustomFieldInstance,
      itemCustomFieldInstance,
      crmCustomFieldInstance,
    ])

    const areModified = await awu(allInstances)
      .map((instance, index) => removeUneditableLockedField(instance, allErrors[index], elementsSource.has))
      .toArray()

    expect(areModified).toEqual([false, false, false, false])
    expect(allInstances).toEqual(allInstancesOriginal)
  })

  it("Should not modify the instances when the error code is different than 'INSUFFICIENT PERMISSION'", async () => {
    const error: WriteResponseError = {
      status: {
        attributes: {
          isSuccess: 'false',
        },
        statusDetail: [
          {
            code: 'random error',
            message: 'should ignore me',
          },
        ],
      },
    }

    const areModified = await awu(allInstances)
      .map(instance => removeUneditableLockedField(instance, error, emptyElementsSource.has))
      .toArray()

    expect(areModified).toEqual([false, false, false, false])
    expect(allInstances).toEqual(allInstancesOriginal)
  })

  it("Should not modify instance with field name that doesn't match any known field instance", async () => {
    const instanceOriginal = new InstanceElement('testUnknown', testType, {
      attributes: {
        internalId: '6',
      },
      [CUSTOM_FIELD_LIST]: {
        [PLATFORM_CORE_CUSTOM_FIELD]: [
          {
            attributes: {
              [SOAP_SCRIPT_ID]: 'NotARealPrefixTest',
              'xsi:type': 'platformCore:BooleanCustomFieldRef',
              'platformCore:value': true,
            },
          },
        ],
      },
    })

    const instance = instanceOriginal.clone()
    const error = getWriteResponseError('NotARealPrefixTest')
    const isModified = await removeUneditableLockedField(instance, error, emptyElementsSource.has)
    expect(isModified).toBeFalsy()
    expect(instance).toEqual(instanceOriginal)
  })

  it("Should not modify instance that doesn't contain the matched field", async () => {
    const error = getWriteResponseError(`${OTHER_CUSTOM_FIELD_PREFIX}someRandomField`)

    const instance = otherInstance.clone()
    const isModified = await removeUneditableLockedField(instance, error, emptyElementsSource.has)
    expect(isModified).toBeFalsy()
    expect(instance).toEqual(otherInstance)
  })

  it('Should not modify instance with no custom fields', async () => {
    const instanceOriginal = new InstanceElement('testUnknown', testType, {
      attributes: {
        internalId: '6',
      },
    })

    const instance = instanceOriginal.clone()
    const isModified = await removeUneditableLockedField(instance, otherError, emptyElementsSource.has)
    expect(isModified).toBeFalsy()
    expect(instance).toEqual(instanceOriginal)
  })

  it('Should not modify instance when the error message contains 2 fields', async () => {
    const error = getWriteResponseError(otherCustomField.attributes[SOAP_SCRIPT_ID])
    error.status.statusDetail[0].message += error.status.statusDetail[0].message
    const instance = otherInstance.clone()
    const isModified = await removeUneditableLockedField(instance, error, emptyElementsSource.has)
    expect(isModified).toBeFalsy()
    expect(instance).toEqual(otherInstance)
  })

  it('Should not modify instance with WriteResponseSuccess', async () => {
    const writeResponseSuccess: WriteResponse = {
      status: {
        attributes: {
          isSuccess: 'true',
        },
      },
      baseRef: {
        attributes: {
          internalId: '1',
        },
      },
    }

    const instance = otherInstance.clone()
    const isModified = await removeUneditableLockedField(instance, writeResponseSuccess, emptyElementsSource.has)
    expect(isModified).toBeFalsy()
    expect(instance).toEqual(otherInstance)
  })
})
