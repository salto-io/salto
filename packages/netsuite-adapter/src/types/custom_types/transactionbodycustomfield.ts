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
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, ObjectType, ListType,
} from '@salto-io/adapter-api'
import * as constants from '../../constants'
import { enums } from '../enums'

export const transactionbodycustomfieldInnerTypes: ObjectType[] = []

const transactionbodycustomfieldElemID = new ElemID(constants.NETSUITE, 'transactionbodycustomfield')
const transactionbodycustomfield_customfieldfilters_customfieldfilterElemID = new ElemID(constants.NETSUITE, 'transactionbodycustomfield_customfieldfilters_customfieldfilter')

const transactionbodycustomfield_customfieldfilters_customfieldfilter = new ObjectType({
  elemID: transactionbodycustomfield_customfieldfilters_customfieldfilterElemID,
  annotations: {
  },
  fields: {
    fldfilter: new Field(
      transactionbodycustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilter',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    fldfilterchecked: new Field(
      transactionbodycustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilterchecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldfiltercomparetype: new Field(
      transactionbodycustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfiltercomparetype',
      enums.generic_customfield_fldfiltercomparetype,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_fldfiltercomparetype.   The default value is 'EQ'. */
    fldfiltersel: new Field(
      transactionbodycustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfiltersel',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    fldfilterval: new Field(
      transactionbodycustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilterval',
      BuiltinTypes.STRING,
      {
      },
    ),
    fldfilternotnull: new Field(
      transactionbodycustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilternotnull',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldfilternull: new Field(
      transactionbodycustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilternull',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldcomparefield: new Field(
      transactionbodycustomfield_customfieldfilters_customfieldfilterElemID,
      'fldcomparefield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionbodycustomfieldElemID.name],
})

transactionbodycustomfieldInnerTypes.push(transactionbodycustomfield_customfieldfilters_customfieldfilter)

const transactionbodycustomfield_customfieldfiltersElemID = new ElemID(constants.NETSUITE, 'transactionbodycustomfield_customfieldfilters')

const transactionbodycustomfield_customfieldfilters = new ObjectType({
  elemID: transactionbodycustomfield_customfieldfiltersElemID,
  annotations: {
  },
  fields: {
    customfieldfilter: new Field(
      transactionbodycustomfield_customfieldfiltersElemID,
      'customfieldfilter',
      new ListType(transactionbodycustomfield_customfieldfilters_customfieldfilter),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionbodycustomfieldElemID.name],
})

transactionbodycustomfieldInnerTypes.push(transactionbodycustomfield_customfieldfilters)

const transactionbodycustomfield_roleaccesses_roleaccessElemID = new ElemID(constants.NETSUITE, 'transactionbodycustomfield_roleaccesses_roleaccess')

const transactionbodycustomfield_roleaccesses_roleaccess = new ObjectType({
  elemID: transactionbodycustomfield_roleaccesses_roleaccessElemID,
  annotations: {
  },
  fields: {
    role: new Field(
      transactionbodycustomfield_roleaccesses_roleaccessElemID,
      'role',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */
    accesslevel: new Field(
      transactionbodycustomfield_roleaccesses_roleaccessElemID,
      'accesslevel',
      enums.generic_accesslevel_searchlevel,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
    searchlevel: new Field(
      transactionbodycustomfield_roleaccesses_roleaccessElemID,
      'searchlevel',
      enums.generic_accesslevel_searchlevel,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionbodycustomfieldElemID.name],
})

transactionbodycustomfieldInnerTypes.push(transactionbodycustomfield_roleaccesses_roleaccess)

const transactionbodycustomfield_roleaccessesElemID = new ElemID(constants.NETSUITE, 'transactionbodycustomfield_roleaccesses')

const transactionbodycustomfield_roleaccesses = new ObjectType({
  elemID: transactionbodycustomfield_roleaccessesElemID,
  annotations: {
  },
  fields: {
    roleaccess: new Field(
      transactionbodycustomfield_roleaccessesElemID,
      'roleaccess',
      new ListType(transactionbodycustomfield_roleaccesses_roleaccess),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionbodycustomfieldElemID.name],
})

transactionbodycustomfieldInnerTypes.push(transactionbodycustomfield_roleaccesses)


export const transactionbodycustomfield = new ObjectType({
  elemID: transactionbodycustomfieldElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'custbody_',
  },
  fields: {
    scriptid: new Field(
      transactionbodycustomfieldElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 38 characters long.   The default value is ‘custbody’. */
    fieldtype: new Field(
      transactionbodycustomfieldElemID,
      'fieldtype',
      enums.generic_customfield_fieldtype,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_customfield_fieldtype.   The default value is 'TEXT'. */
    label: new Field(
      transactionbodycustomfieldElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    ), /* Original description: This field value can be up to 200 characters long. */
    selectrecordtype: new Field(
      transactionbodycustomfieldElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is mandatory when the fieldtype value is equal to any of the following lists or values: SELECT, MULTISELECT.   This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
    applyformatting: new Field(
      transactionbodycustomfieldElemID,
      'applyformatting',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    defaultchecked: new Field(
      transactionbodycustomfieldElemID,
      'defaultchecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    defaultselection: new Field(
      transactionbodycustomfieldElemID,
      'defaultselection',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    defaultvalue: new Field(
      transactionbodycustomfieldElemID,
      'defaultvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    description: new Field(
      transactionbodycustomfieldElemID,
      'description',
      BuiltinTypes.STRING,
      {
      },
    ),
    displaytype: new Field(
      transactionbodycustomfieldElemID,
      'displaytype',
      enums.generic_customfield_displaytype,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_displaytype.   The default value is 'NORMAL'. */
    dynamicdefault: new Field(
      transactionbodycustomfieldElemID,
      'dynamicdefault',
      enums.generic_customfield_dynamicdefault,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_dynamicdefault. */
    help: new Field(
      transactionbodycustomfieldElemID,
      'help',
      BuiltinTypes.STRING,
      {
      },
    ),
    linktext: new Field(
      transactionbodycustomfieldElemID,
      'linktext',
      BuiltinTypes.STRING,
      {
      },
    ),
    minvalue: new Field(
      transactionbodycustomfieldElemID,
      'minvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    maxvalue: new Field(
      transactionbodycustomfieldElemID,
      'maxvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    storevalue: new Field(
      transactionbodycustomfieldElemID,
      'storevalue',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    accesslevel: new Field(
      transactionbodycustomfieldElemID,
      'accesslevel',
      enums.generic_accesslevel_searchlevel,
      {
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    checkspelling: new Field(
      transactionbodycustomfieldElemID,
      'checkspelling',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    encryptatrest: new Field(
      transactionbodycustomfieldElemID,
      'encryptatrest',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    displayheight: new Field(
      transactionbodycustomfieldElemID,
      'displayheight',
      BuiltinTypes.NUMBER,
      {
      },
    ), /* Original description: This field value must be greater than or equal to 0. */
    displaywidth: new Field(
      transactionbodycustomfieldElemID,
      'displaywidth',
      BuiltinTypes.NUMBER,
      {
      },
    ), /* Original description: This field value must be greater than or equal to 0. */
    globalsearch: new Field(
      transactionbodycustomfieldElemID,
      'globalsearch',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    isformula: new Field(
      transactionbodycustomfieldElemID,
      'isformula',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    ismandatory: new Field(
      transactionbodycustomfieldElemID,
      'ismandatory',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    maxlength: new Field(
      transactionbodycustomfieldElemID,
      'maxlength',
      BuiltinTypes.STRING,
      {
      },
    ),
    onparentdelete: new Field(
      transactionbodycustomfieldElemID,
      'onparentdelete',
      enums.generic_customfield_onparentdelete,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_onparentdelete. */
    searchcomparefield: new Field(
      transactionbodycustomfieldElemID,
      'searchcomparefield',
      enums.generic_standard_field,
      {
      },
    ), /* Original description: For information about possible values, see generic_standard_field. */
    searchdefault: new Field(
      transactionbodycustomfieldElemID,
      'searchdefault',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    searchlevel: new Field(
      transactionbodycustomfieldElemID,
      'searchlevel',
      enums.generic_accesslevel_searchlevel,
      {
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    showhierarchy: new Field(
      transactionbodycustomfieldElemID,
      'showhierarchy',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    showinlist: new Field(
      transactionbodycustomfieldElemID,
      'showinlist',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    sourcefilterby: new Field(
      transactionbodycustomfieldElemID,
      'sourcefilterby',
      enums.generic_standard_field,
      {
      },
    ), /* Original description: For information about possible values, see generic_standard_field. */
    sourcefrom: new Field(
      transactionbodycustomfieldElemID,
      'sourcefrom',
      BuiltinTypes.STRING /* Original type was enums.generic_standard_field but it can also be reference */,
      {
      },
    ), /* Original description: For information about possible values, see generic_standard_field. */
    sourcelist: new Field(
      transactionbodycustomfieldElemID,
      'sourcelist',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the transactionbodycustomfield custom type.   For information about other possible values, see generic_standard_field. */
    isparent: new Field(
      transactionbodycustomfieldElemID,
      'isparent',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    parentsubtab: new Field(
      transactionbodycustomfieldElemID,
      'parentsubtab',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   subtab   subtab   For information about other possible values, see generic_tab_parent. */
    subtab: new Field(
      transactionbodycustomfieldElemID,
      'subtab',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the subtab custom type.   For information about other possible values, see generic_body_tab. */
    bodyassemblybuild: new Field(
      transactionbodycustomfieldElemID,
      'bodyassemblybuild',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the ASSEMBLIES feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ASSEMBLIES must be enabled for this field to appear in your account. */
    bodybom: new Field(
      transactionbodycustomfieldElemID,
      'bodybom',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the WORKORDERS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. WORKORDERS must be enabled for this field to appear in your account. */
    bodycustomerpayment: new Field(
      transactionbodycustomfieldElemID,
      'bodycustomerpayment',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the RECEIVABLES feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. RECEIVABLES must be enabled for this field to appear in your account. */
    bodydeposit: new Field(
      transactionbodycustomfieldElemID,
      'bodydeposit',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    bodydepositapplication: new Field(
      transactionbodycustomfieldElemID,
      'bodydepositapplication',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    bodyexpensereport: new Field(
      transactionbodycustomfieldElemID,
      'bodyexpensereport',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the EXPREPORTS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. EXPREPORTS must be enabled for this field to appear in your account. */
    bodyinventoryadjustment: new Field(
      transactionbodycustomfieldElemID,
      'bodyinventoryadjustment',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the INVENTORY feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. INVENTORY must be enabled for this field to appear in your account. */
    bodyfulfillmentrequest: new Field(
      transactionbodycustomfieldElemID,
      'bodyfulfillmentrequest',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the FULFILLMENTREQUEST feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. FULFILLMENTREQUEST must be enabled for this field to appear in your account. */
    bodystorepickup: new Field(
      transactionbodycustomfieldElemID,
      'bodystorepickup',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the STOREPICKUP feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. STOREPICKUP must be enabled for this field to appear in your account. */
    bodyitemfulfillment: new Field(
      transactionbodycustomfieldElemID,
      'bodyitemfulfillment',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the ACCOUNTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ACCOUNTING must be enabled for this field to appear in your account. */
    bodyitemfulfillmentorder: new Field(
      transactionbodycustomfieldElemID,
      'bodyitemfulfillmentorder',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the ACCOUNTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ACCOUNTING must be enabled for this field to appear in your account. */
    bodyitemreceipt: new Field(
      transactionbodycustomfieldElemID,
      'bodyitemreceipt',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the ADVRECEIVING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ADVRECEIVING must be enabled for this field to appear in your account. */
    bodyitemreceiptorder: new Field(
      transactionbodycustomfieldElemID,
      'bodyitemreceiptorder',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the ADVRECEIVING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ADVRECEIVING must be enabled for this field to appear in your account. */
    bodyjournal: new Field(
      transactionbodycustomfieldElemID,
      'bodyjournal',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the ACCOUNTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ACCOUNTING must be enabled for this field to appear in your account. */
    bodyperiodendjournal: new Field(
      transactionbodycustomfieldElemID,
      'bodyperiodendjournal',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the PERIODENDJOURNALENTRIES feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. PERIODENDJOURNALENTRIES must be enabled for this field to appear in your account. */
    bodyopportunity: new Field(
      transactionbodycustomfieldElemID,
      'bodyopportunity',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the OPPORTUNITIES feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. OPPORTUNITIES must be enabled for this field to appear in your account. */
    bodyothertransaction: new Field(
      transactionbodycustomfieldElemID,
      'bodyothertransaction',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    bodypaycheck: new Field(
      transactionbodycustomfieldElemID,
      'bodypaycheck',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the PAYCHECKJOURNAL feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. PAYCHECKJOURNAL must be enabled for this field to appear in your account. */
    bodypickingticket: new Field(
      transactionbodycustomfieldElemID,
      'bodypickingticket',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    bodyprintflag: new Field(
      transactionbodycustomfieldElemID,
      'bodyprintflag',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    bodyprintpackingslip: new Field(
      transactionbodycustomfieldElemID,
      'bodyprintpackingslip',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the ACCOUNTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ACCOUNTING must be enabled for this field to appear in your account. */
    bodyprintstatement: new Field(
      transactionbodycustomfieldElemID,
      'bodyprintstatement',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the ACCOUNTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ACCOUNTING must be enabled for this field to appear in your account. */
    bodypurchase: new Field(
      transactionbodycustomfieldElemID,
      'bodypurchase',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the ACCOUNTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ACCOUNTING must be enabled for this field to appear in your account. */
    bodysale: new Field(
      transactionbodycustomfieldElemID,
      'bodysale',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    bodystore: new Field(
      transactionbodycustomfieldElemID,
      'bodystore',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the WEBSTORE feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. WEBSTORE must be enabled for this field to appear in your account. */
    bodytransferorder: new Field(
      transactionbodycustomfieldElemID,
      'bodytransferorder',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the MULTILOCINVT feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. MULTILOCINVT must be enabled for this field to appear in your account. */
    bodyvendorpayment: new Field(
      transactionbodycustomfieldElemID,
      'bodyvendorpayment',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the PAYABLES feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. PAYABLES must be enabled for this field to appear in your account. */
    bodybtegata: new Field(
      transactionbodycustomfieldElemID,
      'bodybtegata',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the ACCOUNTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ACCOUNTING must be enabled for this field to appear in your account. */
    fldsizelabel: new Field(
      transactionbodycustomfieldElemID,
      'fldsizelabel',
      BuiltinTypes.STRING,
      {
      },
    ),
    bodycustomtransactions: new Field(
      transactionbodycustomfieldElemID,
      'bodycustomtransactions',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the customtransactiontype custom type.   If this field appears in the project, you must reference the CUSTOMTRANSACTIONS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CUSTOMTRANSACTIONS must be enabled for this field to appear in your account. */
    customfieldfilters: new Field(
      transactionbodycustomfieldElemID,
      'customfieldfilters',
      transactionbodycustomfield_customfieldfilters,
      {
      },
    ),
    roleaccesses: new Field(
      transactionbodycustomfieldElemID,
      'roleaccesses',
      transactionbodycustomfield_roleaccesses,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionbodycustomfieldElemID.name],
})
