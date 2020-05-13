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

export const entitycustomfieldInnerTypes: ObjectType[] = []

const entitycustomfieldElemID = new ElemID(constants.NETSUITE, 'entitycustomfield')
const entitycustomfield_customfieldfilters_customfieldfilterElemID = new ElemID(constants.NETSUITE, 'entitycustomfield_customfieldfilters_customfieldfilter')

const entitycustomfield_customfieldfilters_customfieldfilter = new ObjectType({
  elemID: entitycustomfield_customfieldfilters_customfieldfilterElemID,
  annotations: {
  },
  fields: {
    fldfilter: new Field(
      entitycustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilter',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    fldfilterchecked: new Field(
      entitycustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilterchecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldfiltercomparetype: new Field(
      entitycustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfiltercomparetype',
      enums.generic_customfield_fldfiltercomparetype,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_fldfiltercomparetype.   The default value is 'EQ'. */
    fldfiltersel: new Field(
      entitycustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfiltersel',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    fldfilterval: new Field(
      entitycustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilterval',
      BuiltinTypes.STRING,
      {
      },
    ),
    fldfilternotnull: new Field(
      entitycustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilternotnull',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldfilternull: new Field(
      entitycustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilternull',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldcomparefield: new Field(
      entitycustomfield_customfieldfilters_customfieldfilterElemID,
      'fldcomparefield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entitycustomfieldElemID.name],
})

entitycustomfieldInnerTypes.push(entitycustomfield_customfieldfilters_customfieldfilter)

const entitycustomfield_customfieldfiltersElemID = new ElemID(constants.NETSUITE, 'entitycustomfield_customfieldfilters')

const entitycustomfield_customfieldfilters = new ObjectType({
  elemID: entitycustomfield_customfieldfiltersElemID,
  annotations: {
  },
  fields: {
    customfieldfilter: new Field(
      entitycustomfield_customfieldfiltersElemID,
      'customfieldfilter',
      new ListType(entitycustomfield_customfieldfilters_customfieldfilter),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entitycustomfieldElemID.name],
})

entitycustomfieldInnerTypes.push(entitycustomfield_customfieldfilters)

const entitycustomfield_roleaccesses_roleaccessElemID = new ElemID(constants.NETSUITE, 'entitycustomfield_roleaccesses_roleaccess')

const entitycustomfield_roleaccesses_roleaccess = new ObjectType({
  elemID: entitycustomfield_roleaccesses_roleaccessElemID,
  annotations: {
  },
  fields: {
    role: new Field(
      entitycustomfield_roleaccesses_roleaccessElemID,
      'role',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */
    accesslevel: new Field(
      entitycustomfield_roleaccesses_roleaccessElemID,
      'accesslevel',
      enums.generic_accesslevel_searchlevel,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
    searchlevel: new Field(
      entitycustomfield_roleaccesses_roleaccessElemID,
      'searchlevel',
      enums.generic_accesslevel_searchlevel,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entitycustomfieldElemID.name],
})

entitycustomfieldInnerTypes.push(entitycustomfield_roleaccesses_roleaccess)

const entitycustomfield_roleaccessesElemID = new ElemID(constants.NETSUITE, 'entitycustomfield_roleaccesses')

const entitycustomfield_roleaccesses = new ObjectType({
  elemID: entitycustomfield_roleaccessesElemID,
  annotations: {
  },
  fields: {
    roleaccess: new Field(
      entitycustomfield_roleaccessesElemID,
      'roleaccess',
      new ListType(entitycustomfield_roleaccesses_roleaccess),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entitycustomfieldElemID.name],
})

entitycustomfieldInnerTypes.push(entitycustomfield_roleaccesses)


export const entitycustomfield = new ObjectType({
  elemID: entitycustomfieldElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'custentity_',
  },
  fields: {
    scriptid: new Field(
      entitycustomfieldElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘custentity’. */
    fieldtype: new Field(
      entitycustomfieldElemID,
      'fieldtype',
      enums.generic_customfield_fieldtype,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_customfield_fieldtype.   The default value is 'TEXT'. */
    label: new Field(
      entitycustomfieldElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    ), /* Original description: This field value can be up to 200 characters long. */
    selectrecordtype: new Field(
      entitycustomfieldElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is mandatory when the fieldtype value is equal to any of the following lists or values: SELECT, MULTISELECT.   This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
    applyformatting: new Field(
      entitycustomfieldElemID,
      'applyformatting',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    defaultchecked: new Field(
      entitycustomfieldElemID,
      'defaultchecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    defaultselection: new Field(
      entitycustomfieldElemID,
      'defaultselection',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    defaultvalue: new Field(
      entitycustomfieldElemID,
      'defaultvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    description: new Field(
      entitycustomfieldElemID,
      'description',
      BuiltinTypes.STRING,
      {
      },
    ),
    displaytype: new Field(
      entitycustomfieldElemID,
      'displaytype',
      enums.generic_customfield_displaytype,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_displaytype.   The default value is 'NORMAL'. */
    dynamicdefault: new Field(
      entitycustomfieldElemID,
      'dynamicdefault',
      enums.generic_customfield_dynamicdefault,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_dynamicdefault. */
    help: new Field(
      entitycustomfieldElemID,
      'help',
      BuiltinTypes.STRING,
      {
      },
    ),
    linktext: new Field(
      entitycustomfieldElemID,
      'linktext',
      BuiltinTypes.STRING,
      {
      },
    ),
    minvalue: new Field(
      entitycustomfieldElemID,
      'minvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    maxvalue: new Field(
      entitycustomfieldElemID,
      'maxvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    storevalue: new Field(
      entitycustomfieldElemID,
      'storevalue',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    accesslevel: new Field(
      entitycustomfieldElemID,
      'accesslevel',
      enums.generic_accesslevel_searchlevel,
      {
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    checkspelling: new Field(
      entitycustomfieldElemID,
      'checkspelling',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    encryptatrest: new Field(
      entitycustomfieldElemID,
      'encryptatrest',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    displayheight: new Field(
      entitycustomfieldElemID,
      'displayheight',
      BuiltinTypes.NUMBER,
      {
      },
    ), /* Original description: This field value must be greater than or equal to 0. */
    displaywidth: new Field(
      entitycustomfieldElemID,
      'displaywidth',
      BuiltinTypes.NUMBER,
      {
      },
    ), /* Original description: This field value must be greater than or equal to 0. */
    globalsearch: new Field(
      entitycustomfieldElemID,
      'globalsearch',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    isformula: new Field(
      entitycustomfieldElemID,
      'isformula',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    ismandatory: new Field(
      entitycustomfieldElemID,
      'ismandatory',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    maxlength: new Field(
      entitycustomfieldElemID,
      'maxlength',
      BuiltinTypes.STRING,
      {
      },
    ),
    onparentdelete: new Field(
      entitycustomfieldElemID,
      'onparentdelete',
      enums.generic_customfield_onparentdelete,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_onparentdelete. */
    searchcomparefield: new Field(
      entitycustomfieldElemID,
      'searchcomparefield',
      enums.generic_standard_field,
      {
      },
    ), /* Original description: For information about possible values, see generic_standard_field. */
    searchdefault: new Field(
      entitycustomfieldElemID,
      'searchdefault',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    searchlevel: new Field(
      entitycustomfieldElemID,
      'searchlevel',
      enums.generic_accesslevel_searchlevel,
      {
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    showhierarchy: new Field(
      entitycustomfieldElemID,
      'showhierarchy',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    showinlist: new Field(
      entitycustomfieldElemID,
      'showinlist',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    sourcefilterby: new Field(
      entitycustomfieldElemID,
      'sourcefilterby',
      enums.generic_standard_field,
      {
      },
    ), /* Original description: For information about possible values, see generic_standard_field. */
    sourcefrom: new Field(
      entitycustomfieldElemID,
      'sourcefrom',
      BuiltinTypes.STRING /* Original type was enums.generic_standard_field but it can also be reference */,
      {
      },
    ), /* Original description: For information about possible values, see generic_standard_field. */
    sourcelist: new Field(
      entitycustomfieldElemID,
      'sourcelist',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the entitycustomfield custom type.   For information about other possible values, see generic_standard_field. */
    isparent: new Field(
      entitycustomfieldElemID,
      'isparent',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    parentsubtab: new Field(
      entitycustomfieldElemID,
      'parentsubtab',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   subtab   subtab   For information about other possible values, see generic_tab_parent. */
    subtab: new Field(
      entitycustomfieldElemID,
      'subtab',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the subtab custom type.   For information about other possible values, see generic_entity_tab. */
    appliestocontact: new Field(
      entitycustomfieldElemID,
      'appliestocontact',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    appliestocustomer: new Field(
      entitycustomfieldElemID,
      'appliestocustomer',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    appliestoemployee: new Field(
      entitycustomfieldElemID,
      'appliestoemployee',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    appliestogenericrsrc: new Field(
      entitycustomfieldElemID,
      'appliestogenericrsrc',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the ADVANCEDJOBS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ADVANCEDJOBS must be enabled for this field to appear in your account. */
    appliestogroup: new Field(
      entitycustomfieldElemID,
      'appliestogroup',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    appliestoothername: new Field(
      entitycustomfieldElemID,
      'appliestoothername',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    appliestopartner: new Field(
      entitycustomfieldElemID,
      'appliestopartner',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the CRM feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CRM must be enabled for this field to appear in your account. */
    appliestopricelist: new Field(
      entitycustomfieldElemID,
      'appliestopricelist',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    appliestoproject: new Field(
      entitycustomfieldElemID,
      'appliestoproject',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the JOBS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. JOBS must be enabled for this field to appear in your account. */
    appliestoprojecttemplate: new Field(
      entitycustomfieldElemID,
      'appliestoprojecttemplate',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    appliestostatement: new Field(
      entitycustomfieldElemID,
      'appliestostatement',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    appliestovendor: new Field(
      entitycustomfieldElemID,
      'appliestovendor',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the ACCOUNTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ACCOUNTING must be enabled for this field to appear in your account. */
    appliestowebsite: new Field(
      entitycustomfieldElemID,
      'appliestowebsite',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the WEBSITE feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. WEBSITE must be enabled for this field to appear in your account. */
    availableexternally: new Field(
      entitycustomfieldElemID,
      'availableexternally',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    availabletosso: new Field(
      entitycustomfieldElemID,
      'availabletosso',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the SUITESIGNON feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. SUITESIGNON must be enabled for this field to appear in your account. */
    customfieldfilters: new Field(
      entitycustomfieldElemID,
      'customfieldfilters',
      entitycustomfield_customfieldfilters,
      {
      },
    ),
    roleaccesses: new Field(
      entitycustomfieldElemID,
      'roleaccesses',
      entitycustomfield_roleaccesses,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, entitycustomfieldElemID.name],
})
