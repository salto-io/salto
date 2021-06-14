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
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
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


export const getFieldInstanceTypes = (fieldInstance: InstanceElement): string[] => {
  if (fieldInstance.elemID.typeName in CUSTOM_FIELD_TO_TYPE) {
    return _(CUSTOM_FIELD_TO_TYPE[fieldInstance.elemID.typeName])
      .pickBy((_typeName, field) => fieldInstance.value[field])
      .values()
      .filter(values.isDefined)
      .flatten()
      .value()
  }

  if (fieldInstance.elemID.typeName === othercustomfield.elemID.name
    && fieldInstance.value.rectype in INTERNAL_ID_TO_TYPES) {
    return INTERNAL_ID_TO_TYPES[fieldInstance.value.rectype]
  }
  return []
}
