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

export const transactioncolumncustomfieldInnerTypes: ObjectType[] = []

const transactioncolumncustomfieldElemID = new ElemID(constants.NETSUITE, 'transactioncolumncustomfield')
const transactioncolumncustomfield_customfieldfilters_customfieldfilterElemID = new ElemID(constants.NETSUITE, 'transactioncolumncustomfield_customfieldfilters_customfieldfilter')

const transactioncolumncustomfield_customfieldfilters_customfieldfilter = new ObjectType({
  elemID: transactioncolumncustomfield_customfieldfilters_customfieldfilterElemID,
  annotations: {
  },
  fields: {
    fldfilter: new Field(
      transactioncolumncustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilter',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    fldfilterchecked: new Field(
      transactioncolumncustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilterchecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldfiltercomparetype: new Field(
      transactioncolumncustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfiltercomparetype',
      enums.generic_customfield_fldfiltercomparetype,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_fldfiltercomparetype.   The default value is 'EQ'. */
    fldfiltersel: new Field(
      transactioncolumncustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfiltersel',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    fldfilterval: new Field(
      transactioncolumncustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilterval',
      BuiltinTypes.STRING,
      {
      },
    ),
    fldfilternotnull: new Field(
      transactioncolumncustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilternotnull',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldfilternull: new Field(
      transactioncolumncustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilternull',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldcomparefield: new Field(
      transactioncolumncustomfield_customfieldfilters_customfieldfilterElemID,
      'fldcomparefield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactioncolumncustomfieldElemID.name],
})

transactioncolumncustomfieldInnerTypes.push(transactioncolumncustomfield_customfieldfilters_customfieldfilter)

const transactioncolumncustomfield_customfieldfiltersElemID = new ElemID(constants.NETSUITE, 'transactioncolumncustomfield_customfieldfilters')

const transactioncolumncustomfield_customfieldfilters = new ObjectType({
  elemID: transactioncolumncustomfield_customfieldfiltersElemID,
  annotations: {
  },
  fields: {
    customfieldfilter: new Field(
      transactioncolumncustomfield_customfieldfiltersElemID,
      'customfieldfilter',
      new ListType(transactioncolumncustomfield_customfieldfilters_customfieldfilter),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactioncolumncustomfieldElemID.name],
})

transactioncolumncustomfieldInnerTypes.push(transactioncolumncustomfield_customfieldfilters)

const transactioncolumncustomfield_roleaccesses_roleaccessElemID = new ElemID(constants.NETSUITE, 'transactioncolumncustomfield_roleaccesses_roleaccess')

const transactioncolumncustomfield_roleaccesses_roleaccess = new ObjectType({
  elemID: transactioncolumncustomfield_roleaccesses_roleaccessElemID,
  annotations: {
  },
  fields: {
    role: new Field(
      transactioncolumncustomfield_roleaccesses_roleaccessElemID,
      'role',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */
    accesslevel: new Field(
      transactioncolumncustomfield_roleaccesses_roleaccessElemID,
      'accesslevel',
      enums.generic_accesslevel_searchlevel,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
    searchlevel: new Field(
      transactioncolumncustomfield_roleaccesses_roleaccessElemID,
      'searchlevel',
      enums.generic_accesslevel_searchlevel,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactioncolumncustomfieldElemID.name],
})

transactioncolumncustomfieldInnerTypes.push(transactioncolumncustomfield_roleaccesses_roleaccess)

const transactioncolumncustomfield_roleaccessesElemID = new ElemID(constants.NETSUITE, 'transactioncolumncustomfield_roleaccesses')

const transactioncolumncustomfield_roleaccesses = new ObjectType({
  elemID: transactioncolumncustomfield_roleaccessesElemID,
  annotations: {
  },
  fields: {
    roleaccess: new Field(
      transactioncolumncustomfield_roleaccessesElemID,
      'roleaccess',
      new ListType(transactioncolumncustomfield_roleaccesses_roleaccess),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactioncolumncustomfieldElemID.name],
})

transactioncolumncustomfieldInnerTypes.push(transactioncolumncustomfield_roleaccesses)


export const transactioncolumncustomfield = new ObjectType({
  elemID: transactioncolumncustomfieldElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'custcol_',
  },
  fields: {
    scriptid: new Field(
      transactioncolumncustomfieldElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 37 characters long.   The default value is ‘custcol’. */
    fieldtype: new Field(
      transactioncolumncustomfieldElemID,
      'fieldtype',
      enums.generic_customfield_fieldtype,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_customfield_fieldtype.   The default value is 'TEXT'. */
    label: new Field(
      transactioncolumncustomfieldElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    ), /* Original description: This field value can be up to 200 characters long. */
    selectrecordtype: new Field(
      transactioncolumncustomfieldElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is mandatory when the fieldtype value is equal to any of the following lists or values: SELECT, MULTISELECT.   This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
    applyformatting: new Field(
      transactioncolumncustomfieldElemID,
      'applyformatting',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    defaultchecked: new Field(
      transactioncolumncustomfieldElemID,
      'defaultchecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    defaultselection: new Field(
      transactioncolumncustomfieldElemID,
      'defaultselection',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    defaultvalue: new Field(
      transactioncolumncustomfieldElemID,
      'defaultvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    description: new Field(
      transactioncolumncustomfieldElemID,
      'description',
      BuiltinTypes.STRING,
      {
      },
    ),
    displaytype: new Field(
      transactioncolumncustomfieldElemID,
      'displaytype',
      enums.generic_customfield_displaytype,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_displaytype.   The default value is 'NORMAL'. */
    dynamicdefault: new Field(
      transactioncolumncustomfieldElemID,
      'dynamicdefault',
      enums.generic_customfield_dynamicdefault,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_dynamicdefault. */
    help: new Field(
      transactioncolumncustomfieldElemID,
      'help',
      BuiltinTypes.STRING,
      {
      },
    ),
    linktext: new Field(
      transactioncolumncustomfieldElemID,
      'linktext',
      BuiltinTypes.STRING,
      {
      },
    ),
    minvalue: new Field(
      transactioncolumncustomfieldElemID,
      'minvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    maxvalue: new Field(
      transactioncolumncustomfieldElemID,
      'maxvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    storevalue: new Field(
      transactioncolumncustomfieldElemID,
      'storevalue',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    accesslevel: new Field(
      transactioncolumncustomfieldElemID,
      'accesslevel',
      enums.generic_accesslevel_searchlevel,
      {
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    encryptatrest: new Field(
      transactioncolumncustomfieldElemID,
      'encryptatrest',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    displayheight: new Field(
      transactioncolumncustomfieldElemID,
      'displayheight',
      BuiltinTypes.NUMBER,
      {
      },
    ), /* Original description: This field value must be greater than or equal to 0. */
    displaywidth: new Field(
      transactioncolumncustomfieldElemID,
      'displaywidth',
      BuiltinTypes.NUMBER,
      {
      },
    ), /* Original description: This field value must be greater than or equal to 0. */
    isformula: new Field(
      transactioncolumncustomfieldElemID,
      'isformula',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    ismandatory: new Field(
      transactioncolumncustomfieldElemID,
      'ismandatory',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    maxlength: new Field(
      transactioncolumncustomfieldElemID,
      'maxlength',
      BuiltinTypes.STRING,
      {
      },
    ),
    onparentdelete: new Field(
      transactioncolumncustomfieldElemID,
      'onparentdelete',
      enums.generic_customfield_onparentdelete,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_onparentdelete. */
    searchcomparefield: new Field(
      transactioncolumncustomfieldElemID,
      'searchcomparefield',
      enums.generic_standard_field,
      {
      },
    ), /* Original description: For information about possible values, see generic_standard_field. */
    searchdefault: new Field(
      transactioncolumncustomfieldElemID,
      'searchdefault',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    searchlevel: new Field(
      transactioncolumncustomfieldElemID,
      'searchlevel',
      enums.generic_accesslevel_searchlevel,
      {
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    showhierarchy: new Field(
      transactioncolumncustomfieldElemID,
      'showhierarchy',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    sourcefilterby: new Field(
      transactioncolumncustomfieldElemID,
      'sourcefilterby',
      enums.generic_standard_field,
      {
      },
    ), /* Original description: For information about possible values, see generic_standard_field. */
    sourcefrom: new Field(
      transactioncolumncustomfieldElemID,
      'sourcefrom',
      BuiltinTypes.STRING /* Original type was enums.generic_standard_field but it can also be reference */,
      {
      },
    ), /* Original description: For information about possible values, see generic_standard_field. */
    sourcelist: new Field(
      transactioncolumncustomfieldElemID,
      'sourcelist',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the transactioncolumncustomfield custom type.   For information about other possible values, see generic_standard_field. */
    colbuild: new Field(
      transactioncolumncustomfieldElemID,
      'colbuild',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the WORKORDERS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. WORKORDERS must be enabled for this field to appear in your account. */
    colexpense: new Field(
      transactioncolumncustomfieldElemID,
      'colexpense',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the ACCOUNTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ACCOUNTING must be enabled for this field to appear in your account. */
    colexpensereport: new Field(
      transactioncolumncustomfieldElemID,
      'colexpensereport',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the EXPREPORTS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. EXPREPORTS must be enabled for this field to appear in your account. */
    colgrouponinvoices: new Field(
      transactioncolumncustomfieldElemID,
      'colgrouponinvoices',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    colinventoryadjustment: new Field(
      transactioncolumncustomfieldElemID,
      'colinventoryadjustment',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the ACCOUNTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ACCOUNTING must be enabled for this field to appear in your account. */
    colfulfillmentrequest: new Field(
      transactioncolumncustomfieldElemID,
      'colfulfillmentrequest',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the FULFILLMENTREQUEST feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. FULFILLMENTREQUEST must be enabled for this field to appear in your account. */
    colstorepickup: new Field(
      transactioncolumncustomfieldElemID,
      'colstorepickup',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the STOREPICKUP feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. STOREPICKUP must be enabled for this field to appear in your account. */
    colitemfulfillment: new Field(
      transactioncolumncustomfieldElemID,
      'colitemfulfillment',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the ACCOUNTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ACCOUNTING must be enabled for this field to appear in your account. */
    colitemfulfillmentorder: new Field(
      transactioncolumncustomfieldElemID,
      'colitemfulfillmentorder',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: If this field appears in the project, you must reference the ACCOUNTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ACCOUNTING must be enabled for this field to appear in your account. */
    colitemreceipt: new Field(
      transactioncolumncustomfieldElemID,
      'colitemreceipt',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the ADVRECEIVING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ADVRECEIVING must be enabled for this field to appear in your account. */
    colitemreceiptorder: new Field(
      transactioncolumncustomfieldElemID,
      'colitemreceiptorder',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: If this field appears in the project, you must reference the ADVRECEIVING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ADVRECEIVING must be enabled for this field to appear in your account. */
    coljournal: new Field(
      transactioncolumncustomfieldElemID,
      'coljournal',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the ACCOUNTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ACCOUNTING must be enabled for this field to appear in your account. */
    colperiodendjournal: new Field(
      transactioncolumncustomfieldElemID,
      'colperiodendjournal',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the PERIODENDJOURNALENTRIES feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. PERIODENDJOURNALENTRIES must be enabled for this field to appear in your account. */
    colkititem: new Field(
      transactioncolumncustomfieldElemID,
      'colkititem',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    colopportunity: new Field(
      transactioncolumncustomfieldElemID,
      'colopportunity',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the OPPORTUNITIES feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. OPPORTUNITIES must be enabled for this field to appear in your account. */
    colpackingslip: new Field(
      transactioncolumncustomfieldElemID,
      'colpackingslip',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the ACCOUNTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ACCOUNTING must be enabled for this field to appear in your account. */
    colpaycheckcompanycontribution: new Field(
      transactioncolumncustomfieldElemID,
      'colpaycheckcompanycontribution',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the PAYCHECKJOURNAL feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. PAYCHECKJOURNAL must be enabled for this field to appear in your account. */
    colpaycheckcompanytax: new Field(
      transactioncolumncustomfieldElemID,
      'colpaycheckcompanytax',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the PAYCHECKJOURNAL feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. PAYCHECKJOURNAL must be enabled for this field to appear in your account. */
    colpaycheckdeduction: new Field(
      transactioncolumncustomfieldElemID,
      'colpaycheckdeduction',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the PAYCHECKJOURNAL feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. PAYCHECKJOURNAL must be enabled for this field to appear in your account. */
    colpaycheckearning: new Field(
      transactioncolumncustomfieldElemID,
      'colpaycheckearning',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the PAYCHECKJOURNAL feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. PAYCHECKJOURNAL must be enabled for this field to appear in your account. */
    colpaycheckemployeetax: new Field(
      transactioncolumncustomfieldElemID,
      'colpaycheckemployeetax',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the PAYCHECKJOURNAL feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. PAYCHECKJOURNAL must be enabled for this field to appear in your account. */
    colpickingticket: new Field(
      transactioncolumncustomfieldElemID,
      'colpickingticket',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    colprintflag: new Field(
      transactioncolumncustomfieldElemID,
      'colprintflag',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    colpurchase: new Field(
      transactioncolumncustomfieldElemID,
      'colpurchase',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the ACCOUNTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ACCOUNTING must be enabled for this field to appear in your account. */
    colreturnform: new Field(
      transactioncolumncustomfieldElemID,
      'colreturnform',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the ACCOUNTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ACCOUNTING must be enabled for this field to appear in your account. */
    colsale: new Field(
      transactioncolumncustomfieldElemID,
      'colsale',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    colstore: new Field(
      transactioncolumncustomfieldElemID,
      'colstore',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the WEBSITE feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. WEBSITE must be enabled for this field to appear in your account. */
    colstorehidden: new Field(
      transactioncolumncustomfieldElemID,
      'colstorehidden',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the WEBSITE feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. WEBSITE must be enabled for this field to appear in your account. */
    colstorewithgroups: new Field(
      transactioncolumncustomfieldElemID,
      'colstorewithgroups',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    coltime: new Field(
      transactioncolumncustomfieldElemID,
      'coltime',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the TIMETRACKING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. TIMETRACKING must be enabled for this field to appear in your account. */
    coltransferorder: new Field(
      transactioncolumncustomfieldElemID,
      'coltransferorder',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the MULTILOCINVT feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. MULTILOCINVT must be enabled for this field to appear in your account. */
    columncustomtransactions: new Field(
      transactioncolumncustomfieldElemID,
      'columncustomtransactions',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the customtransactiontype custom type.   If this field appears in the project, you must reference the CUSTOMTRANSACTIONS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CUSTOMTRANSACTIONS must be enabled for this field to appear in your account. */
    customfieldfilters: new Field(
      transactioncolumncustomfieldElemID,
      'customfieldfilters',
      transactioncolumncustomfield_customfieldfilters,
      {
      },
    ),
    roleaccesses: new Field(
      transactioncolumncustomfieldElemID,
      'roleaccesses',
      transactioncolumncustomfield_roleaccesses,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactioncolumncustomfieldElemID.name],
})
