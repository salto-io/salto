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
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { WriteResponseError } from '../../../../src/client/suiteapp_client/soap_client/types'
import { getModifiedInstance } from '../../../../src/client/suiteapp_client/soap_client/filter_uneditable_locked_field'
import { CRM_CUSTOM_FIELD, CRM_CUSTOM_FIELD_PREFIX, ENTITY_CUSTOM_FIELD, ENTITY_CUSTOM_FIELD_PREFIX, ITEM_CUSTOM_FIELD, ITEM_CUSTOM_FIELD_PREFIX, NETSUITE, OTHER_CUSTOM_FIELD, OTHER_CUSTOM_FIELD_PREFIX, SOAP_SCRIPT_ID } from '../../../../src/constants'

describe('Filter uneditable locked fields', () => {
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
    new ObjectType({ elemID: new ElemID(NETSUITE, ITEM_CUSTOM_FIELD) })
  )
  const crmCustomFieldInstance = new InstanceElement(
    crmCustomField.attributes[SOAP_SCRIPT_ID],
    new ObjectType({ elemID: new ElemID(NETSUITE, CRM_CUSTOM_FIELD) }),
  )

  const testType = new ObjectType({ elemID: new ElemID(NETSUITE, 'testType') })

  const otherInstance = new InstanceElement('testOther', testType, {
    attributes: {
      internalId: '1',
    },
    customFieldList: {
      'platformCore:customField': [otherCustomField],
    },
  })
  const entityInstance = new InstanceElement('testEntity', testType, {
    attributes: {
      internalId: '2',
    },
    customFieldList: {
      'platformCore:customField': [entityCustomField],
    },
  })
  const itemInstance = new InstanceElement('testItem', testType, {
    attributes: {
      internalId: '3',
    },
    customFieldList: {
      'platformCore:customField': [itemCustomField],
    },
  })
  const crmInstance = new InstanceElement('testCRM', testType, {
    attributes: {
      internalId: '4',
    },
    customFieldList: {
      'platformCore:customField': [crmCustomField],
    },
  })

  const getWriteResponseError = (fieldName: string): WriteResponseError => ({
    status: {
      attributes: {
        isSuccess: 'false',
      },
      statusDetail: [
        {
          code: 'INSUFFICIENT_PERMISSION',
          message: `You do not have permissions to set a value for element ${fieldName} due to one of the following reasons:`
              + ' 1) The field is read-only;'
              + ' 2) An associated feature is disabled;'
              + ' 3) The field is available either when a record is created or updated, but not in both cases.',
        },
      ],
    },
  })

  const otherError = getWriteResponseError(
    otherCustomField.attributes[SOAP_SCRIPT_ID]
  )
  const entityError = getWriteResponseError(
    entityCustomField.attributes[SOAP_SCRIPT_ID]
  )
  const itemError = getWriteResponseError(
    itemCustomField.attributes[SOAP_SCRIPT_ID]
  )
  const crmError = getWriteResponseError(
    crmCustomField.attributes[SOAP_SCRIPT_ID]
  )

  describe('Should return a modified instance - without the locked field', () => {
    const elementsSource = buildElementsSourceFromElements([])

    describe('Sanity - all custom record fields', () => {
      it('Other Custom Field - should return a modified instance', async () => {
        const modifiedInstance = await getModifiedInstance(otherError, otherInstance, elementsSource.has)
        expect(modifiedInstance).toBeDefined()
        expect((modifiedInstance as InstanceElement).value.customFieldList).toBeUndefined()
        expect((modifiedInstance as InstanceElement).value['platformCore:nullFieldList']?.['platformCore:name']).toBeInstanceOf(Array)
        expect((modifiedInstance as InstanceElement).value['platformCore:nullFieldList']['platformCore:name']).toHaveLength(1)
        expect((modifiedInstance as InstanceElement).value['platformCore:nullFieldList']['platformCore:name'][0]).toEqual(otherCustomField.attributes[SOAP_SCRIPT_ID])
      })

      it('Entity Custom Field - should return a modified instance', async () => {
        const modifiedInstance = await getModifiedInstance(entityError, entityInstance, elementsSource.has)
        expect(modifiedInstance).toBeDefined()
        expect((modifiedInstance as InstanceElement).value.customFieldList).toBeUndefined()
        expect((modifiedInstance as InstanceElement).value['platformCore:nullFieldList']?.['platformCore:name']).toBeInstanceOf(Array)
        expect((modifiedInstance as InstanceElement).value['platformCore:nullFieldList']['platformCore:name']).toHaveLength(1)
        expect((modifiedInstance as InstanceElement).value['platformCore:nullFieldList']['platformCore:name'][0]).toEqual(entityCustomField.attributes[SOAP_SCRIPT_ID])
      })

      it('Item Custom Field - should return a modified instance', async () => {
        const modifiedInstance = await getModifiedInstance(itemError, itemInstance, elementsSource.has)
        expect(modifiedInstance).toBeDefined()
        expect((modifiedInstance as InstanceElement).value.customFieldList).toBeUndefined()
        expect((modifiedInstance as InstanceElement).value['platformCore:nullFieldList']?.['platformCore:name']).toBeInstanceOf(Array)
        expect((modifiedInstance as InstanceElement).value['platformCore:nullFieldList']['platformCore:name']).toHaveLength(1)
        expect((modifiedInstance as InstanceElement).value['platformCore:nullFieldList']['platformCore:name'][0]).toEqual(itemCustomField.attributes[SOAP_SCRIPT_ID])
      })

      it('CRM Custom Field - should return a modified instance', async () => {
        const modifiedInstance = await getModifiedInstance(crmError, crmInstance, elementsSource.has)
        expect(modifiedInstance).toBeDefined()
        expect((modifiedInstance as InstanceElement).value.customFieldList).toBeUndefined()
        expect((modifiedInstance as InstanceElement).value['platformCore:nullFieldList']?.['platformCore:name']).toBeInstanceOf(Array)
        expect((modifiedInstance as InstanceElement).value['platformCore:nullFieldList']['platformCore:name']).toHaveLength(1)
        expect((modifiedInstance as InstanceElement).value['platformCore:nullFieldList']['platformCore:name'][0]).toEqual(crmCustomField.attributes[SOAP_SCRIPT_ID])
      })
    })

    it('Should append to null list of custom records if such exists', async () => {
      const otherComplexInstance = new InstanceElement('testOther', testType, {
        attributes: {
          internalId: '1',
        },
        customFieldList: {
          'platformCore:customField': [otherCustomField],
        },
        'platformCore:nullFieldList': {
          'platformCore:name': ['randomField'],
        },
      })
      const modifiedInstance = await getModifiedInstance(otherError, otherComplexInstance, elementsSource.has)
      expect(modifiedInstance).toBeDefined()
      expect((modifiedInstance as InstanceElement).value.customFieldList).toBeUndefined()
      expect((modifiedInstance as InstanceElement).value['platformCore:nullFieldList']?.['platformCore:name']).toBeInstanceOf(Array)
      expect((modifiedInstance as InstanceElement).value['platformCore:nullFieldList']['platformCore:name']).toHaveLength(2)
      expect((modifiedInstance as InstanceElement).value['platformCore:nullFieldList']['platformCore:name']).toEqual(
        expect.arrayContaining(['randomField', otherCustomField.attributes[SOAP_SCRIPT_ID]])
      )
    })
  })

  describe('Should return undefined when the INSUFFICIENT PERMISSION error is caused by unlocked element', () => {
    const elementsSource = buildElementsSourceFromElements([
      otherCustomFieldInstance,
      entityCustomFieldInstance,
      itemCustomFieldInstance,
      crmCustomFieldInstance,
    ])

    it('Other Custom Field - should return undefined', async () => {
      const modifiedInstance = await getModifiedInstance(otherError, otherInstance, elementsSource.has)
      expect(modifiedInstance).toBeUndefined()
    })

    it('Entity Custom Field - should return undefined', async () => {
      const modifiedInstance = await getModifiedInstance(entityError, entityInstance, elementsSource.has)
      expect(modifiedInstance).toBeUndefined()
    })

    it('Item Custom Field - should return undefined', async () => {
      const modifiedInstance = await getModifiedInstance(itemError, itemInstance, elementsSource.has)
      expect(modifiedInstance).toBeUndefined()
    })

    it('CRM Custom Field - should return undefined', async () => {
      const modifiedInstance = await getModifiedInstance(crmError, crmInstance, elementsSource.has)
      expect(modifiedInstance).toBeUndefined()
    })
  })

  describe('Should return undefined when error code is different than \'INSUFFICIENT PERMISSION\'', () => {
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
    const elementsSource = buildElementsSourceFromElements([])

    it('Other Custom Field - should return undefined', async () => {
      const modifiedInstance = await getModifiedInstance(error, otherInstance, elementsSource.has)
      expect(modifiedInstance).toBeUndefined()
    })

    it('Entity Custom Field - should return undefined', async () => {
      const modifiedInstance = await getModifiedInstance(error, entityInstance, elementsSource.has)
      expect(modifiedInstance).toBeUndefined()
    })

    it('Item Custom Field - should return undefined', async () => {
      const modifiedInstance = await getModifiedInstance(error, itemInstance, elementsSource.has)
      expect(modifiedInstance).toBeUndefined()
    })

    it('CRM Custom Field - should return undefined', async () => {
      const modifiedInstance = await getModifiedInstance(error, crmInstance, elementsSource.has)
      expect(modifiedInstance).toBeUndefined()
    })
  })
})
