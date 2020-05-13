/*
*                      Copyright 2020 Salto Labs Ltd.
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
/* eslint-disable @typescript-eslint/camelcase */
import {
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, ObjectType,
} from '@salto-io/adapter-api'
import * as constants from '../../constants'
import { enums } from '../enums'

export const sublistInnerTypes: ObjectType[] = []

const sublistElemID = new ElemID(constants.NETSUITE, 'sublist')

export const sublist = new ObjectType({
  elemID: sublistElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'custsublist_',
  },
  fields: {
    scriptid: new Field(
      sublistElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘custsublist’. */
    label: new Field(
      sublistElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
      },
    ),
    savedsearch: new Field(
      sublistElemID,
      'savedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    sublisttype: new Field(
      sublistElemID,
      'sublisttype',
      enums.generic_tab_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_tab_type. */
    tab: new Field(
      sublistElemID,
      'tab',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the subtab custom type.   For information about other possible values, see generic_tab_parent. */
    field: new Field(
      sublistElemID,
      'field',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   transactionbodycustomfield   itemcustomfield   entitycustomfield   crmcustomfield   For information about other possible values, see sublist_standard_fields. */
    purchase: new Field(
      sublistElemID,
      'purchase',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    sale: new Field(
      sublistElemID,
      'sale',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    opportunity: new Field(
      sublistElemID,
      'opportunity',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    journal: new Field(
      sublistElemID,
      'journal',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    expensereport: new Field(
      sublistElemID,
      'expensereport',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    inventoryadjustment: new Field(
      sublistElemID,
      'inventoryadjustment',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    assemblybuild: new Field(
      sublistElemID,
      'assemblybuild',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fulfillmentrequest: new Field(
      sublistElemID,
      'fulfillmentrequest',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    storepickup: new Field(
      sublistElemID,
      'storepickup',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    itemreceipt: new Field(
      sublistElemID,
      'itemreceipt',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    itemfulfillment: new Field(
      sublistElemID,
      'itemfulfillment',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    payment: new Field(
      sublistElemID,
      'payment',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    vendorpayment: new Field(
      sublistElemID,
      'vendorpayment',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    deposit: new Field(
      sublistElemID,
      'deposit',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    depositapplication: new Field(
      sublistElemID,
      'depositapplication',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    customtransactions: new Field(
      sublistElemID,
      'customtransactions',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: This field is available when the sublisttype value is equal to TRANSACTION.   You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the customtransactiontype custom type.   If this field appears in the project, you must reference the CUSTOMTRANSACTIONS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CUSTOMTRANSACTIONS must be enabled for this field to appear in your account. */
    customer: new Field(
      sublistElemID,
      'customer',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    job: new Field(
      sublistElemID,
      'job',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    vendor: new Field(
      sublistElemID,
      'vendor',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    employee: new Field(
      sublistElemID,
      'employee',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    partner: new Field(
      sublistElemID,
      'partner',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    contact: new Field(
      sublistElemID,
      'contact',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    inventoryitem: new Field(
      sublistElemID,
      'inventoryitem',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    noninventoryitem: new Field(
      sublistElemID,
      'noninventoryitem',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    service: new Field(
      sublistElemID,
      'service',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    othercharge: new Field(
      sublistElemID,
      'othercharge',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    itemgroup: new Field(
      sublistElemID,
      'itemgroup',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    kit: new Field(
      sublistElemID,
      'kit',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    billofmaterials: new Field(
      sublistElemID,
      'billofmaterials',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    case: new Field(
      sublistElemID,
      'case',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    task: new Field(
      sublistElemID,
      'task',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    call: new Field(
      sublistElemID,
      'call',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    event: new Field(
      sublistElemID,
      'event',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    solution: new Field(
      sublistElemID,
      'solution',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    campaign: new Field(
      sublistElemID,
      'campaign',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    issue: new Field(
      sublistElemID,
      'issue',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, sublistElemID.name],
})
