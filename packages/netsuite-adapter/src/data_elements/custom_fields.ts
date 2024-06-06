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

import { BuiltinTypes, Field, InstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { SOAP_FIELDS_TYPES } from '../client/suiteapp_client/soap_client/types'
import { INTERNAL_ID_TO_TYPES } from './types'
import { EMPLOYEE, OTHER_CUSTOM_FIELD } from '../constants'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/

const CUSTOM_FIELD_TO_TYPE: Record<string, Record<string, string[]>> = {
  entitycustomfield: {
    appliestocontact: ['contact'],
    appliestocustomer: ['customer'],
    appliestoemployee: [EMPLOYEE],
    appliestopartner: ['partner'],
    appliestovendor: ['vendor'],
    appliestopricelist: ['priceList'],
  },
  itemcustomfield: {
    appliestogroup: ['groupItem'],
    appliestoinventory: ['inventoryItem'],
    appliestoitemassembly: ['assemblyItem'],
    appliestokit: ['kitItem'],
    appliestononinventory: ['nonInventoryPurchaseItem', 'nonInventorySaleItem', 'nonInventoryResaleItem'],
    appliestoothercharge: ['otherChargeSaleItem', 'otherChargeResaleItem', 'otherChargePurchaseItem'],
  },
  crmcustomfield: {
    appliestocampaign: ['campaign'],
    appliestoprojecttask: ['projectTask'],
    appliestophonecall: ['phoneCall'],
    appliestosolution: ['solution'],
    appliestotask: ['task'],
  },
}

/**
 * @param instance an instance of a field type (e.g., entitycustomfield, crmcustomfield, etc...)
 * @returns All the names of types a certain field instance applies to
 */
export const getFieldInstanceTypes = (instance: InstanceElement): string[] => {
  if (instance.elemID.typeName in CUSTOM_FIELD_TO_TYPE) {
    return Object.entries(CUSTOM_FIELD_TO_TYPE[instance.elemID.typeName])
      .filter(([fieldName]) => instance.value[fieldName])
      .flatMap(([_fieldName, typeNames]) => typeNames)
  }

  if (instance.elemID.typeName === OTHER_CUSTOM_FIELD && instance.value.rectype in INTERNAL_ID_TO_TYPES) {
    return INTERNAL_ID_TO_TYPES[instance.value.rectype]
  }
  return []
}

export const castFieldValue = async (value: unknown, field?: Field): Promise<unknown> => {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === 'string') {
    const fieldType = await field?.getType()
    if (fieldType?.elemID.isEqual(BuiltinTypes.BOOLEAN.elemID)) {
      return value === 'true'
    }
    if (fieldType?.elemID.isEqual(BuiltinTypes.NUMBER.elemID)) {
      return parseFloat(value)
    }
  }
  return value
}

export const getSoapType = (value: unknown): string => {
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return SOAP_FIELDS_TYPES.LONG
    }
    return SOAP_FIELDS_TYPES.DOUBLE
  }

  if (_.isPlainObject(value)) {
    return SOAP_FIELDS_TYPES.SELECT
  }

  if (Array.isArray(value)) {
    return SOAP_FIELDS_TYPES.MULTISELECT
  }

  if (typeof value === 'boolean') {
    return SOAP_FIELDS_TYPES.BOOLEAN
  }

  if (typeof value === 'string' && DATE_REGEX.test(value)) {
    return SOAP_FIELDS_TYPES.DATE
  }

  return SOAP_FIELDS_TYPES.STRING
}
