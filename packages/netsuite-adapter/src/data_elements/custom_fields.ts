/*
*                      Copyright 2021 Salto Labs Ltd.
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

import { InstanceElement } from '@salto-io/adapter-api'
import { othercustomfield } from '../types/custom_types/othercustomfield'
import { INTERNAL_ID_TO_TYPES } from './types'

const CUSTOM_FIELD_TO_TYPE: Record<string, Record<string, string[]>> = {
  entitycustomfield: {
    appliestocontact: ['Contact'],
    appliestocustomer: ['Customer'],
    appliestoemployee: ['Employee'],
    appliestopartner: ['Partner'],
    appliestovendor: ['Vendor'],
    appliestopricelist: ['PriceList'],
  },
  itemcustomfield: {
    appliestogroup: ['GroupItem'],
    appliestoinventory: ['InventoryItem'],
    appliestoitemassembly: ['AssemblyItem'],
    appliestokit: ['KitItem'],
    appliestononinventory: [
      'NonInventoryPurchaseItem',
      'NonInventorySaleItem',
      'NonInventoryResaleItem',
    ],
    appliestoothercharge: [
      'OtherChargeSaleItem',
      'OtherChargeResaleItem',
      'OtherChargePurchaseItem',
    ],
  },
  crmcustomfield: {
    appliestocampaign: ['Campaign'],
    appliestoprojecttask: ['ProjectTask'],
    appliestophonecall: ['PhoneCall'],
    appliestosolution: ['Solution'],
    appliestotask: ['Task'],
  },
}


/**
 * @param instance an instance if a field type (e.g., entitycustomfield, crmcustomfield, etc...)
 * @returns All the names of types a certain field instance applies too
 */
export const getFieldInstanceTypes = (instance: InstanceElement): string[] => {
  if (instance.elemID.typeName in CUSTOM_FIELD_TO_TYPE) {
    return Object.entries(CUSTOM_FIELD_TO_TYPE[instance.elemID.typeName])
      .filter(([fieldName]) => instance.value[fieldName])
      .flatMap(([_fieldName, typeNames]) => typeNames)
  }

  if (instance.elemID.typeName === othercustomfield.elemID.name
    && instance.value.rectype in INTERNAL_ID_TO_TYPES) {
    return INTERNAL_ID_TO_TYPES[instance.value.rectype]
  }
  return []
}
