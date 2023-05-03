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
import _ from 'lodash'
import { WriteResponseError } from '../../../../src/client/suiteapp_client/soap_client/types'
import { getModifiedInstances } from '../../../../src/client/suiteapp_client/soap_client/filter_uneditable_locked_field'
import { CRM_CUSTOM_FIELD, CRM_CUSTOM_FIELD_PREFIX, CUSTOM_FIELD_LIST, ENTITY_CUSTOM_FIELD,
  ENTITY_CUSTOM_FIELD_PREFIX, ITEM_CUSTOM_FIELD, ITEM_CUSTOM_FIELD_PREFIX, NETSUITE, OTHER_CUSTOM_FIELD,
  OTHER_CUSTOM_FIELD_PREFIX, PLATFORM_CORE_CUSTOM_FIELD, PLATFORM_CORE_NAME, PLATFORM_CORE_NULL_FIELD_LIST, SOAP_SCRIPT_ID } from '../../../../src/constants'

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

  const allInstances = [otherInstance, entityInstance, itemInstance, crmInstance]
  const allErrors = [otherError, entityError, itemError, crmError]

  describe('Should return a modified instance - without the locked field', () => {
    const elementsSource = buildElementsSourceFromElements([])

    it('Sanity - all custom record fields', async () => {
      const { modifiedInstances, allInstancesUpdated, indicesMap } = await getModifiedInstances(
        allInstances,
        allErrors,
        elementsSource.has,
      )
      expect(modifiedInstances).toHaveLength(4)
      expect(
        modifiedInstances
          .map(modifiedInstance => modifiedInstance.value[CUSTOM_FIELD_LIST])
          .filter(_.isUndefined)
      ).toHaveLength(4)
      const nullFieldsList = modifiedInstances
        .map(modifiedInstance => modifiedInstance.value['platformCore:nullFieldList']?.['platformCore:name'])
      expect(nullFieldsList.filter(nullFields => Array.isArray(nullFields))).toHaveLength(4)
      expect(nullFieldsList.filter(nullFields => nullFields.length === 1)).toHaveLength(4)
      expect(nullFieldsList.map(nullFields => nullFields[0])).toEqual(expect.arrayContaining(
        [
          otherCustomField.attributes[SOAP_SCRIPT_ID],
          entityCustomField.attributes[SOAP_SCRIPT_ID],
          itemCustomField.attributes[SOAP_SCRIPT_ID],
          crmCustomField.attributes[SOAP_SCRIPT_ID],
        ]
      ))

      expect(allInstancesUpdated).toEqual(modifiedInstances)
      expect(indicesMap).toEqual(new Map([[0, 0], [1, 1], [2, 2], [3, 3]]))
    })


    it('Should append to null list of custom records if such exists', async () => {
      const otherComplexInstance = new InstanceElement('testOther', testType, {
        attributes: {
          internalId: '1',
        },
        [CUSTOM_FIELD_LIST]: {
          [PLATFORM_CORE_CUSTOM_FIELD]: [otherCustomField],
        },
        [PLATFORM_CORE_NULL_FIELD_LIST]: {
          [PLATFORM_CORE_NAME]: ['randomField'],
        },
      })
      const { modifiedInstances } = await getModifiedInstances([otherComplexInstance], [otherError], elementsSource.has)
      expect(modifiedInstances).toHaveLength(1)
      expect(modifiedInstances[0].value[CUSTOM_FIELD_LIST]).toBeUndefined()
      expect(modifiedInstances[0].value[PLATFORM_CORE_NULL_FIELD_LIST]?.[PLATFORM_CORE_NAME]).toBeInstanceOf(Array)
      expect(modifiedInstances[0].value[PLATFORM_CORE_NULL_FIELD_LIST][PLATFORM_CORE_NAME]).toHaveLength(2)
      expect(modifiedInstances[0].value[PLATFORM_CORE_NULL_FIELD_LIST][PLATFORM_CORE_NAME]).toEqual(
        expect.arrayContaining(['randomField', otherCustomField.attributes[SOAP_SCRIPT_ID]])
      )
    })
  })

  it('Should return no modified instances when the INSUFFICIENT PERMISSION error is caused by unlocked element', async () => {
    const elementsSource = buildElementsSourceFromElements([
      otherCustomFieldInstance,
      entityCustomFieldInstance,
      itemCustomFieldInstance,
      crmCustomFieldInstance,
    ])

    const { modifiedInstances, allInstancesUpdated, indicesMap } = await getModifiedInstances(
      allInstances,
      allErrors,
      elementsSource.has,
    )

    expect(modifiedInstances).toHaveLength(0)
    expect(allInstancesUpdated).toEqual(allInstances)
    expect(indicesMap.size).toBe(0)
  })

  it('Should return undefined when error code is different than \'INSUFFICIENT PERMISSION\'', async () => {
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

    const { modifiedInstances, allInstancesUpdated, indicesMap } = await getModifiedInstances(
      allInstances,
      [error, error, error, error],
      elementsSource.has,
    )

    expect(modifiedInstances).toHaveLength(0)
    expect(allInstancesUpdated).toEqual(allInstances)
    expect(indicesMap.size).toBe(0)
  })
})
