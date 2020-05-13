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

export const restletInnerTypes: ObjectType[] = []

const restletElemID = new ElemID(constants.NETSUITE, 'restlet')
const restlet_customplugintypes_plugintypeElemID = new ElemID(constants.NETSUITE, 'restlet_customplugintypes_plugintype')

const restlet_customplugintypes_plugintype = new ObjectType({
  elemID: restlet_customplugintypes_plugintypeElemID,
  annotations: {
  },
  fields: {
    plugintype: new Field(
      restlet_customplugintypes_plugintypeElemID,
      'plugintype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the plugintype custom type. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, restletElemID.name],
})

restletInnerTypes.push(restlet_customplugintypes_plugintype)

const restlet_customplugintypesElemID = new ElemID(constants.NETSUITE, 'restlet_customplugintypes')

const restlet_customplugintypes = new ObjectType({
  elemID: restlet_customplugintypesElemID,
  annotations: {
  },
  fields: {
    plugintype: new Field(
      restlet_customplugintypesElemID,
      'plugintype',
      new ListType(restlet_customplugintypes_plugintype),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, restletElemID.name],
})

restletInnerTypes.push(restlet_customplugintypes)

const restlet_libraries_libraryElemID = new ElemID(constants.NETSUITE, 'restlet_libraries_library')

const restlet_libraries_library = new ObjectType({
  elemID: restlet_libraries_libraryElemID,
  annotations: {
  },
  fields: {
    scriptfile: new Field(
      restlet_libraries_libraryElemID,
      'scriptfile',
      BuiltinTypes.STRING /* Original type was filereference */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field must reference a .js file. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, restletElemID.name],
})

restletInnerTypes.push(restlet_libraries_library)

const restlet_librariesElemID = new ElemID(constants.NETSUITE, 'restlet_libraries')

const restlet_libraries = new ObjectType({
  elemID: restlet_librariesElemID,
  annotations: {
  },
  fields: {
    library: new Field(
      restlet_librariesElemID,
      'library',
      new ListType(restlet_libraries_library),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, restletElemID.name],
})

restletInnerTypes.push(restlet_libraries)

const restlet_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID = new ElemID(constants.NETSUITE, 'restlet_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter')

const restlet_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter = new ObjectType({
  elemID: restlet_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
  annotations: {
  },
  fields: {
    fldfilter: new Field(
      restlet_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilter',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    fldfilterchecked: new Field(
      restlet_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilterchecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldfiltercomparetype: new Field(
      restlet_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfiltercomparetype',
      enums.generic_customfield_fldfiltercomparetype,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_fldfiltercomparetype.   The default value is 'EQ'. */
    fldfiltersel: new Field(
      restlet_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfiltersel',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    fldfilterval: new Field(
      restlet_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilterval',
      BuiltinTypes.STRING,
      {
      },
    ),
    fldfilternotnull: new Field(
      restlet_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilternotnull',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldfilternull: new Field(
      restlet_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilternull',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldcomparefield: new Field(
      restlet_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldcomparefield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, restletElemID.name],
})

restletInnerTypes.push(restlet_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter)

const restlet_scriptcustomfields_scriptcustomfield_customfieldfiltersElemID = new ElemID(constants.NETSUITE, 'restlet_scriptcustomfields_scriptcustomfield_customfieldfilters')

const restlet_scriptcustomfields_scriptcustomfield_customfieldfilters = new ObjectType({
  elemID: restlet_scriptcustomfields_scriptcustomfield_customfieldfiltersElemID,
  annotations: {
  },
  fields: {
    customfieldfilter: new Field(
      restlet_scriptcustomfields_scriptcustomfield_customfieldfiltersElemID,
      'customfieldfilter',
      new ListType(restlet_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, restletElemID.name],
})

restletInnerTypes.push(restlet_scriptcustomfields_scriptcustomfield_customfieldfilters)

const restlet_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID = new ElemID(constants.NETSUITE, 'restlet_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess')

const restlet_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess = new ObjectType({
  elemID: restlet_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID,
  annotations: {
  },
  fields: {
    role: new Field(
      restlet_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID,
      'role',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */
    accesslevel: new Field(
      restlet_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID,
      'accesslevel',
      enums.generic_accesslevel_searchlevel,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
    searchlevel: new Field(
      restlet_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID,
      'searchlevel',
      enums.generic_accesslevel_searchlevel,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, restletElemID.name],
})

restletInnerTypes.push(restlet_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess)

const restlet_scriptcustomfields_scriptcustomfield_roleaccessesElemID = new ElemID(constants.NETSUITE, 'restlet_scriptcustomfields_scriptcustomfield_roleaccesses')

const restlet_scriptcustomfields_scriptcustomfield_roleaccesses = new ObjectType({
  elemID: restlet_scriptcustomfields_scriptcustomfield_roleaccessesElemID,
  annotations: {
  },
  fields: {
    roleaccess: new Field(
      restlet_scriptcustomfields_scriptcustomfield_roleaccessesElemID,
      'roleaccess',
      new ListType(restlet_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, restletElemID.name],
})

restletInnerTypes.push(restlet_scriptcustomfields_scriptcustomfield_roleaccesses)

const restlet_scriptcustomfields_scriptcustomfieldElemID = new ElemID(constants.NETSUITE, 'restlet_scriptcustomfields_scriptcustomfield')

const restlet_scriptcustomfields_scriptcustomfield = new ObjectType({
  elemID: restlet_scriptcustomfields_scriptcustomfieldElemID,
  annotations: {
  },
  fields: {
    scriptid: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘custscript’. */
    fieldtype: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'fieldtype',
      enums.generic_customfield_fieldtype,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_customfield_fieldtype.   The default value is 'TEXT'. */
    label: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    ), /* Original description: This field value can be up to 200 characters long. */
    selectrecordtype: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is mandatory when the fieldtype value is equal to any of the following lists or values: SELECT, MULTISELECT.   This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
    applyformatting: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'applyformatting',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    defaultchecked: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'defaultchecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    defaultselection: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'defaultselection',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    defaultvalue: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'defaultvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    description: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'description',
      BuiltinTypes.STRING,
      {
      },
    ),
    displaytype: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'displaytype',
      enums.generic_customfield_displaytype,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_displaytype.   The default value is 'NORMAL'. */
    dynamicdefault: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'dynamicdefault',
      enums.generic_customfield_dynamicdefault,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_dynamicdefault. */
    help: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'help',
      BuiltinTypes.STRING,
      {
      },
    ),
    linktext: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'linktext',
      BuiltinTypes.STRING,
      {
      },
    ),
    minvalue: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'minvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    maxvalue: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'maxvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    storevalue: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'storevalue',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    accesslevel: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'accesslevel',
      enums.generic_accesslevel_searchlevel,
      {
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    checkspelling: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'checkspelling',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    displayheight: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'displayheight',
      BuiltinTypes.NUMBER,
      {
      },
    ), /* Original description: This field value must be greater than or equal to 0. */
    displaywidth: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'displaywidth',
      BuiltinTypes.NUMBER,
      {
      },
    ), /* Original description: This field value must be greater than or equal to 0. */
    isformula: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'isformula',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    ismandatory: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'ismandatory',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    maxlength: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'maxlength',
      BuiltinTypes.STRING,
      {
      },
    ),
    onparentdelete: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'onparentdelete',
      enums.generic_customfield_onparentdelete,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_onparentdelete. */
    searchcomparefield: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'searchcomparefield',
      enums.generic_standard_field,
      {
      },
    ), /* Original description: For information about possible values, see generic_standard_field. */
    searchdefault: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'searchdefault',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    searchlevel: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'searchlevel',
      enums.generic_accesslevel_searchlevel,
      {
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    setting: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'setting',
      enums.script_setting,
      {
      },
    ), /* Original description: For information about possible values, see script_setting. */
    customfieldfilters: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'customfieldfilters',
      restlet_scriptcustomfields_scriptcustomfield_customfieldfilters,
      {
      },
    ),
    roleaccesses: new Field(
      restlet_scriptcustomfields_scriptcustomfieldElemID,
      'roleaccesses',
      restlet_scriptcustomfields_scriptcustomfield_roleaccesses,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, restletElemID.name],
})

restletInnerTypes.push(restlet_scriptcustomfields_scriptcustomfield)

const restlet_scriptcustomfieldsElemID = new ElemID(constants.NETSUITE, 'restlet_scriptcustomfields')

const restlet_scriptcustomfields = new ObjectType({
  elemID: restlet_scriptcustomfieldsElemID,
  annotations: {
  },
  fields: {
    scriptcustomfield: new Field(
      restlet_scriptcustomfieldsElemID,
      'scriptcustomfield',
      new ListType(restlet_scriptcustomfields_scriptcustomfield),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, restletElemID.name],
})

restletInnerTypes.push(restlet_scriptcustomfields)

const restlet_scriptdeployments_scriptdeploymentElemID = new ElemID(constants.NETSUITE, 'restlet_scriptdeployments_scriptdeployment')

const restlet_scriptdeployments_scriptdeployment = new ObjectType({
  elemID: restlet_scriptdeployments_scriptdeploymentElemID,
  annotations: {
  },
  fields: {
    scriptid: new Field(
      restlet_scriptdeployments_scriptdeploymentElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customdeploy’. */
    status: new Field(
      restlet_scriptdeployments_scriptdeploymentElemID,
      'status',
      enums.script_status,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see script_status.   The default value is 'TESTING'. */
    title: new Field(
      restlet_scriptdeployments_scriptdeploymentElemID,
      'title',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    allemployees: new Field(
      restlet_scriptdeployments_scriptdeploymentElemID,
      'allemployees',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    allpartners: new Field(
      restlet_scriptdeployments_scriptdeploymentElemID,
      'allpartners',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the CRM feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CRM must be enabled for this field to appear in your account. */
    allroles: new Field(
      restlet_scriptdeployments_scriptdeploymentElemID,
      'allroles',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    auddepartment: new Field(
      restlet_scriptdeployments_scriptdeploymentElemID,
      'auddepartment',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   If this field appears in the project, you must reference the DEPARTMENTS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. DEPARTMENTS must be enabled for this field to appear in your account.   Note Account-specific values are not supported by SDF. */
    audemployee: new Field(
      restlet_scriptdeployments_scriptdeploymentElemID,
      'audemployee',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   Note Account-specific values are not supported by SDF. */
    audgroup: new Field(
      restlet_scriptdeployments_scriptdeploymentElemID,
      'audgroup',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   Note Account-specific values are not supported by SDF. */
    audpartner: new Field(
      restlet_scriptdeployments_scriptdeploymentElemID,
      'audpartner',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   If this field appears in the project, you must reference the CRM feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CRM must be enabled for this field to appear in your account.   Note Account-specific values are not supported by SDF. */
    audslctrole: new Field(
      restlet_scriptdeployments_scriptdeploymentElemID,
      'audslctrole',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the role custom type.   For information about other possible values, see generic_role. */
    audsubsidiary: new Field(
      restlet_scriptdeployments_scriptdeploymentElemID,
      'audsubsidiary',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   If this field appears in the project, you must reference the SUBSIDIARIES feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. SUBSIDIARIES must be enabled for this field to appear in your account.   Note Account-specific values are not supported by SDF. */
    isdeployed: new Field(
      restlet_scriptdeployments_scriptdeploymentElemID,
      'isdeployed',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    loglevel: new Field(
      restlet_scriptdeployments_scriptdeploymentElemID,
      'loglevel',
      enums.script_loglevel,
      {
      },
    ), /* Original description: For information about possible values, see script_loglevel.   The default value is 'DEBUG'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, restletElemID.name],
})

restletInnerTypes.push(restlet_scriptdeployments_scriptdeployment)

const restlet_scriptdeploymentsElemID = new ElemID(constants.NETSUITE, 'restlet_scriptdeployments')

const restlet_scriptdeployments = new ObjectType({
  elemID: restlet_scriptdeploymentsElemID,
  annotations: {
  },
  fields: {
    scriptdeployment: new Field(
      restlet_scriptdeploymentsElemID,
      'scriptdeployment',
      new ListType(restlet_scriptdeployments_scriptdeployment),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, restletElemID.name],
})

restletInnerTypes.push(restlet_scriptdeployments)


export const restlet = new ObjectType({
  elemID: restletElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'customscript_',
  },
  fields: {
    scriptid: new Field(
      restletElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customscript’. */
    name: new Field(
      restletElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    ), /* Original description: This field value can be up to 40 characters long. */
    scriptfile: new Field(
      restletElemID,
      'scriptfile',
      BuiltinTypes.STRING /* Original type was filereference */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field must reference a .js file. */
    description: new Field(
      restletElemID,
      'description',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    ), /* Original description: This field value can be up to 999 characters long. */
    isinactive: new Field(
      restletElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    notifyadmins: new Field(
      restletElemID,
      'notifyadmins',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    notifyemails: new Field(
      restletElemID,
      'notifyemails',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    ), /* Original description: This field value can be up to 999 characters long. */
    notifygroup: new Field(
      restletElemID,
      'notifygroup',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: Note Account-specific values are not supported by SDF. */
    notifyowner: new Field(
      restletElemID,
      'notifyowner',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    notifyuser: new Field(
      restletElemID,
      'notifyuser',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    deletefunction: new Field(
      restletElemID,
      'deletefunction',
      BuiltinTypes.STRING,
      {
      },
    ),
    getfunction: new Field(
      restletElemID,
      'getfunction',
      BuiltinTypes.STRING,
      {
      },
    ),
    postfunction: new Field(
      restletElemID,
      'postfunction',
      BuiltinTypes.STRING,
      {
      },
    ),
    putfunction: new Field(
      restletElemID,
      'putfunction',
      BuiltinTypes.STRING,
      {
      },
    ),
    customplugintypes: new Field(
      restletElemID,
      'customplugintypes',
      restlet_customplugintypes,
      {
      },
    ),
    libraries: new Field(
      restletElemID,
      'libraries',
      restlet_libraries,
      {
      },
    ),
    scriptcustomfields: new Field(
      restletElemID,
      'scriptcustomfields',
      restlet_scriptcustomfields,
      {
      },
    ),
    scriptdeployments: new Field(
      restletElemID,
      'scriptdeployments',
      restlet_scriptdeployments,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, restletElemID.name],
})
