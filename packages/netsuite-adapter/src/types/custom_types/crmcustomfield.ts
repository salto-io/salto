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

export const crmcustomfieldInnerTypes: ObjectType[] = []

const crmcustomfieldElemID = new ElemID(constants.NETSUITE, 'crmcustomfield')
const crmcustomfield_customfieldfilters_customfieldfilterElemID = new ElemID(constants.NETSUITE, 'crmcustomfield_customfieldfilters_customfieldfilter')

const crmcustomfield_customfieldfilters_customfieldfilter = new ObjectType({
  elemID: crmcustomfield_customfieldfilters_customfieldfilterElemID,
  annotations: {
  },
  fields: {
    fldfilter: new Field(
      crmcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilter',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    fldfilterchecked: new Field(
      crmcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilterchecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldfiltercomparetype: new Field(
      crmcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfiltercomparetype',
      enums.generic_customfield_fldfiltercomparetype,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_fldfiltercomparetype.   The default value is 'EQ'. */
    fldfiltersel: new Field(
      crmcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfiltersel',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    fldfilterval: new Field(
      crmcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilterval',
      BuiltinTypes.STRING,
      {
      },
    ),
    fldfilternotnull: new Field(
      crmcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilternotnull',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldfilternull: new Field(
      crmcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilternull',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldcomparefield: new Field(
      crmcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldcomparefield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, crmcustomfieldElemID.name],
})

crmcustomfieldInnerTypes.push(crmcustomfield_customfieldfilters_customfieldfilter)

const crmcustomfield_customfieldfiltersElemID = new ElemID(constants.NETSUITE, 'crmcustomfield_customfieldfilters')

const crmcustomfield_customfieldfilters = new ObjectType({
  elemID: crmcustomfield_customfieldfiltersElemID,
  annotations: {
  },
  fields: {
    customfieldfilter: new Field(
      crmcustomfield_customfieldfiltersElemID,
      'customfieldfilter',
      new ListType(crmcustomfield_customfieldfilters_customfieldfilter),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, crmcustomfieldElemID.name],
})

crmcustomfieldInnerTypes.push(crmcustomfield_customfieldfilters)

const crmcustomfield_roleaccesses_roleaccessElemID = new ElemID(constants.NETSUITE, 'crmcustomfield_roleaccesses_roleaccess')

const crmcustomfield_roleaccesses_roleaccess = new ObjectType({
  elemID: crmcustomfield_roleaccesses_roleaccessElemID,
  annotations: {
  },
  fields: {
    role: new Field(
      crmcustomfield_roleaccesses_roleaccessElemID,
      'role',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */
    accesslevel: new Field(
      crmcustomfield_roleaccesses_roleaccessElemID,
      'accesslevel',
      enums.generic_accesslevel_searchlevel,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
    searchlevel: new Field(
      crmcustomfield_roleaccesses_roleaccessElemID,
      'searchlevel',
      enums.generic_accesslevel_searchlevel,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, crmcustomfieldElemID.name],
})

crmcustomfieldInnerTypes.push(crmcustomfield_roleaccesses_roleaccess)

const crmcustomfield_roleaccessesElemID = new ElemID(constants.NETSUITE, 'crmcustomfield_roleaccesses')

const crmcustomfield_roleaccesses = new ObjectType({
  elemID: crmcustomfield_roleaccessesElemID,
  annotations: {
  },
  fields: {
    roleaccess: new Field(
      crmcustomfield_roleaccessesElemID,
      'roleaccess',
      new ListType(crmcustomfield_roleaccesses_roleaccess),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, crmcustomfieldElemID.name],
})

crmcustomfieldInnerTypes.push(crmcustomfield_roleaccesses)


export const crmcustomfield = new ObjectType({
  elemID: crmcustomfieldElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'custevent_',
  },
  fields: {
    scriptid: new Field(
      crmcustomfieldElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 39 characters long.   The default value is ‘custevent’. */
    fieldtype: new Field(
      crmcustomfieldElemID,
      'fieldtype',
      enums.generic_customfield_fieldtype,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_customfield_fieldtype.   The default value is 'TEXT'. */
    label: new Field(
      crmcustomfieldElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    ), /* Original description: This field value can be up to 200 characters long. */
    selectrecordtype: new Field(
      crmcustomfieldElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is mandatory when the fieldtype value is equal to any of the following lists or values: SELECT, MULTISELECT.   This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
    applyformatting: new Field(
      crmcustomfieldElemID,
      'applyformatting',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    defaultchecked: new Field(
      crmcustomfieldElemID,
      'defaultchecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    defaultselection: new Field(
      crmcustomfieldElemID,
      'defaultselection',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    defaultvalue: new Field(
      crmcustomfieldElemID,
      'defaultvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    description: new Field(
      crmcustomfieldElemID,
      'description',
      BuiltinTypes.STRING,
      {
      },
    ),
    displaytype: new Field(
      crmcustomfieldElemID,
      'displaytype',
      enums.generic_customfield_displaytype,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_displaytype.   The default value is 'NORMAL'. */
    dynamicdefault: new Field(
      crmcustomfieldElemID,
      'dynamicdefault',
      enums.generic_customfield_dynamicdefault,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_dynamicdefault. */
    help: new Field(
      crmcustomfieldElemID,
      'help',
      BuiltinTypes.STRING,
      {
      },
    ),
    linktext: new Field(
      crmcustomfieldElemID,
      'linktext',
      BuiltinTypes.STRING,
      {
      },
    ),
    minvalue: new Field(
      crmcustomfieldElemID,
      'minvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    maxvalue: new Field(
      crmcustomfieldElemID,
      'maxvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    storevalue: new Field(
      crmcustomfieldElemID,
      'storevalue',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    accesslevel: new Field(
      crmcustomfieldElemID,
      'accesslevel',
      enums.generic_accesslevel_searchlevel,
      {
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    checkspelling: new Field(
      crmcustomfieldElemID,
      'checkspelling',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    encryptatrest: new Field(
      crmcustomfieldElemID,
      'encryptatrest',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    displayheight: new Field(
      crmcustomfieldElemID,
      'displayheight',
      BuiltinTypes.NUMBER,
      {
      },
    ), /* Original description: This field value must be greater than or equal to 0. */
    displaywidth: new Field(
      crmcustomfieldElemID,
      'displaywidth',
      BuiltinTypes.NUMBER,
      {
      },
    ), /* Original description: This field value must be greater than or equal to 0. */
    globalsearch: new Field(
      crmcustomfieldElemID,
      'globalsearch',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    isformula: new Field(
      crmcustomfieldElemID,
      'isformula',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    ismandatory: new Field(
      crmcustomfieldElemID,
      'ismandatory',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    maxlength: new Field(
      crmcustomfieldElemID,
      'maxlength',
      BuiltinTypes.STRING,
      {
      },
    ),
    onparentdelete: new Field(
      crmcustomfieldElemID,
      'onparentdelete',
      enums.generic_customfield_onparentdelete,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_onparentdelete. */
    searchcomparefield: new Field(
      crmcustomfieldElemID,
      'searchcomparefield',
      enums.generic_standard_field,
      {
      },
    ), /* Original description: For information about possible values, see generic_standard_field. */
    searchdefault: new Field(
      crmcustomfieldElemID,
      'searchdefault',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    searchlevel: new Field(
      crmcustomfieldElemID,
      'searchlevel',
      enums.generic_accesslevel_searchlevel,
      {
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    showhierarchy: new Field(
      crmcustomfieldElemID,
      'showhierarchy',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    showinlist: new Field(
      crmcustomfieldElemID,
      'showinlist',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    sourcefilterby: new Field(
      crmcustomfieldElemID,
      'sourcefilterby',
      enums.generic_standard_field,
      {
      },
    ), /* Original description: For information about possible values, see generic_standard_field. */
    sourcefrom: new Field(
      crmcustomfieldElemID,
      'sourcefrom',
      BuiltinTypes.STRING /* Original type was enums.generic_standard_field but it can also be reference */,
      {
      },
    ), /* Original description: For information about possible values, see generic_standard_field. */
    sourcelist: new Field(
      crmcustomfieldElemID,
      'sourcelist',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the crmcustomfield custom type.   For information about other possible values, see generic_standard_field. */
    isparent: new Field(
      crmcustomfieldElemID,
      'isparent',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    parentsubtab: new Field(
      crmcustomfieldElemID,
      'parentsubtab',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   subtab   subtab   For information about other possible values, see generic_tab_parent. */
    subtab: new Field(
      crmcustomfieldElemID,
      'subtab',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the subtab custom type.   For information about other possible values, see generic_crm_tab. */
    appliestocampaign: new Field(
      crmcustomfieldElemID,
      'appliestocampaign',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the MARKETING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. MARKETING must be enabled for this field to appear in your account. */
    appliestocase: new Field(
      crmcustomfieldElemID,
      'appliestocase',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the SUPPORT feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. SUPPORT must be enabled for this field to appear in your account. */
    appliestoevent: new Field(
      crmcustomfieldElemID,
      'appliestoevent',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    appliestoissue: new Field(
      crmcustomfieldElemID,
      'appliestoissue',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the ISSUEDB feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ISSUEDB must be enabled for this field to appear in your account. */
    appliestomfgprojecttask: new Field(
      crmcustomfieldElemID,
      'appliestomfgprojecttask',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the MFGROUTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. MFGROUTING must be enabled for this field to appear in your account. */
    appliesperkeyword: new Field(
      crmcustomfieldElemID,
      'appliesperkeyword',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the MARKETING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. MARKETING must be enabled for this field to appear in your account. */
    appliestophonecall: new Field(
      crmcustomfieldElemID,
      'appliestophonecall',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    appliestoprojecttask: new Field(
      crmcustomfieldElemID,
      'appliestoprojecttask',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the ADVANCEDJOBS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ADVANCEDJOBS must be enabled for this field to appear in your account. */
    appliestoresourceallocation: new Field(
      crmcustomfieldElemID,
      'appliestoresourceallocation',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the RESOURCEALLOCATIONS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. RESOURCEALLOCATIONS must be enabled for this field to appear in your account. */
    appliestosolution: new Field(
      crmcustomfieldElemID,
      'appliestosolution',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the KNOWLEDGEBASE feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. KNOWLEDGEBASE must be enabled for this field to appear in your account. */
    appliestotask: new Field(
      crmcustomfieldElemID,
      'appliestotask',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    availableexternally: new Field(
      crmcustomfieldElemID,
      'availableexternally',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    showissuechanges: new Field(
      crmcustomfieldElemID,
      'showissuechanges',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the ISSUEDB feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ISSUEDB must be enabled for this field to appear in your account. */
    customfieldfilters: new Field(
      crmcustomfieldElemID,
      'customfieldfilters',
      crmcustomfield_customfieldfilters,
      {
      },
    ),
    roleaccesses: new Field(
      crmcustomfieldElemID,
      'roleaccesses',
      crmcustomfield_roleaccesses,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, crmcustomfieldElemID.name],
})
