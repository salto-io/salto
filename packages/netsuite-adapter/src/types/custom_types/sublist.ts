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
/* eslint-disable max-len */
/* eslint-disable camelcase */
import {
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, ObjectType, createRestriction,
} from '@salto-io/adapter-api'
import * as constants from '../../constants'
import { enums } from '../enums'

export const sublistInnerTypes: ObjectType[] = []

const sublistElemID = new ElemID(constants.NETSUITE, 'sublist')

export const sublist = new ObjectType({
  elemID: sublistElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^custsublist[0-9a-z_]+' }),
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘custsublist’. */
    label: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the string custom type. */
    savedsearch: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    sublisttype: {
      refType: enums.generic_tab_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_tab_type. */
    tab: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the subtab custom type.   For information about other possible values, see generic_tab_parent. */
    field: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   transactionbodycustomfield   itemcustomfield   entitycustomfield   crmcustomfield   For information about other possible values, see sublist_standard_fields. */
    purchase: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to TRANSACTION.   The default value is F. */
    sale: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to TRANSACTION.   The default value is F. */
    opportunity: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to TRANSACTION.   The default value is F. */
    journal: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to TRANSACTION.   The default value is F. */
    expensereport: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to TRANSACTION.   The default value is F. */
    inventoryadjustment: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to TRANSACTION.   The default value is F. */
    assemblybuild: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to TRANSACTION.   The default value is F. */
    fulfillmentrequest: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to TRANSACTION.   The default value is F. */
    storepickup: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to TRANSACTION.   The default value is F. */
    itemreceipt: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to TRANSACTION.   The default value is F. */
    itemfulfillment: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to TRANSACTION.   The default value is F. */
    payment: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to TRANSACTION.   The default value is F. */
    vendorpayment: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to TRANSACTION.   The default value is F. */
    deposit: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to TRANSACTION.   The default value is F. */
    depositapplication: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to TRANSACTION.   The default value is F. */
    customer: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to ENTITY.   The default value is F. */
    job: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to ENTITY.   The default value is F. */
    vendor: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to ENTITY.   The default value is F. */
    employee: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to ENTITY.   The default value is F. */
    partner: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to ENTITY.   The default value is F. */
    contact: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to ENTITY.   The default value is F. */
    inventoryitem: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to ITEM.   The default value is F. */
    noninventoryitem: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to ITEM.   The default value is F. */
    service: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to ITEM.   The default value is F. */
    othercharge: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to ITEM.   The default value is F. */
    itemgroup: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to ITEM.   The default value is F. */
    kit: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to ITEM.   The default value is F. */
    billofmaterials: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to ITEM.   The default value is F. */
    case: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to CRM.   The default value is F. */
    task: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to CRM.   The default value is F. */
    call: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to CRM.   The default value is F. */
    event: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to CRM.   The default value is F. */
    solution: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to CRM.   The default value is F. */
    campaign: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to CRM.   The default value is F. */
    issue: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to CRM.   The default value is F. */
    customtransactions: {
      refType: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: This field is available when the sublisttype value is equal to TRANSACTION.   You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the customtransactiontype custom type.   If this field appears in the project, you must reference the CUSTOMTRANSACTIONS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CUSTOMTRANSACTIONS must be enabled for this field to appear in your account. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, sublistElemID.name],
})
