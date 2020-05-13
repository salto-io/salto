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

export const bundleinstallationscriptInnerTypes: ObjectType[] = []

const bundleinstallationscriptElemID = new ElemID(constants.NETSUITE, 'bundleinstallationscript')
const bundleinstallationscript_customplugintypes_plugintypeElemID = new ElemID(constants.NETSUITE, 'bundleinstallationscript_customplugintypes_plugintype')

const bundleinstallationscript_customplugintypes_plugintype = new ObjectType({
  elemID: bundleinstallationscript_customplugintypes_plugintypeElemID,
  annotations: {
  },
  fields: {
    plugintype: new Field(
      bundleinstallationscript_customplugintypes_plugintypeElemID,
      'plugintype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the plugintype custom type. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, bundleinstallationscriptElemID.name],
})

bundleinstallationscriptInnerTypes.push(bundleinstallationscript_customplugintypes_plugintype)

const bundleinstallationscript_customplugintypesElemID = new ElemID(constants.NETSUITE, 'bundleinstallationscript_customplugintypes')

const bundleinstallationscript_customplugintypes = new ObjectType({
  elemID: bundleinstallationscript_customplugintypesElemID,
  annotations: {
  },
  fields: {
    plugintype: new Field(
      bundleinstallationscript_customplugintypesElemID,
      'plugintype',
      new ListType(bundleinstallationscript_customplugintypes_plugintype),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, bundleinstallationscriptElemID.name],
})

bundleinstallationscriptInnerTypes.push(bundleinstallationscript_customplugintypes)

const bundleinstallationscript_libraries_libraryElemID = new ElemID(constants.NETSUITE, 'bundleinstallationscript_libraries_library')

const bundleinstallationscript_libraries_library = new ObjectType({
  elemID: bundleinstallationscript_libraries_libraryElemID,
  annotations: {
  },
  fields: {
    scriptfile: new Field(
      bundleinstallationscript_libraries_libraryElemID,
      'scriptfile',
      BuiltinTypes.STRING /* Original type was filereference */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field must reference a .js file. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, bundleinstallationscriptElemID.name],
})

bundleinstallationscriptInnerTypes.push(bundleinstallationscript_libraries_library)

const bundleinstallationscript_librariesElemID = new ElemID(constants.NETSUITE, 'bundleinstallationscript_libraries')

const bundleinstallationscript_libraries = new ObjectType({
  elemID: bundleinstallationscript_librariesElemID,
  annotations: {
  },
  fields: {
    library: new Field(
      bundleinstallationscript_librariesElemID,
      'library',
      new ListType(bundleinstallationscript_libraries_library),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, bundleinstallationscriptElemID.name],
})

bundleinstallationscriptInnerTypes.push(bundleinstallationscript_libraries)

const bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID = new ElemID(constants.NETSUITE, 'bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter')

const bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter = new ObjectType({
  elemID: bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
  annotations: {
  },
  fields: {
    fldfilter: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilter',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    fldfilterchecked: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilterchecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldfiltercomparetype: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfiltercomparetype',
      enums.generic_customfield_fldfiltercomparetype,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_fldfiltercomparetype.   The default value is 'EQ'. */
    fldfiltersel: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfiltersel',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    fldfilterval: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilterval',
      BuiltinTypes.STRING,
      {
      },
    ),
    fldfilternotnull: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilternotnull',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldfilternull: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilternull',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldcomparefield: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldcomparefield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, bundleinstallationscriptElemID.name],
})

bundleinstallationscriptInnerTypes.push(bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter)

const bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfiltersElemID = new ElemID(constants.NETSUITE, 'bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters')

const bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters = new ObjectType({
  elemID: bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfiltersElemID,
  annotations: {
  },
  fields: {
    customfieldfilter: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfiltersElemID,
      'customfieldfilter',
      new ListType(bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, bundleinstallationscriptElemID.name],
})

bundleinstallationscriptInnerTypes.push(bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters)

const bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID = new ElemID(constants.NETSUITE, 'bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess')

const bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess = new ObjectType({
  elemID: bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID,
  annotations: {
  },
  fields: {
    role: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID,
      'role',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */
    accesslevel: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID,
      'accesslevel',
      enums.generic_accesslevel_searchlevel,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
    searchlevel: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID,
      'searchlevel',
      enums.generic_accesslevel_searchlevel,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, bundleinstallationscriptElemID.name],
})

bundleinstallationscriptInnerTypes.push(bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess)

const bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccessesElemID = new ElemID(constants.NETSUITE, 'bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses')

const bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses = new ObjectType({
  elemID: bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccessesElemID,
  annotations: {
  },
  fields: {
    roleaccess: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccessesElemID,
      'roleaccess',
      new ListType(bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, bundleinstallationscriptElemID.name],
})

bundleinstallationscriptInnerTypes.push(bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses)

const bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID = new ElemID(constants.NETSUITE, 'bundleinstallationscript_scriptcustomfields_scriptcustomfield')

const bundleinstallationscript_scriptcustomfields_scriptcustomfield = new ObjectType({
  elemID: bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
  annotations: {
  },
  fields: {
    scriptid: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘custscript’. */
    fieldtype: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'fieldtype',
      enums.generic_customfield_fieldtype,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_customfield_fieldtype.   The default value is 'TEXT'. */
    label: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    ), /* Original description: This field value can be up to 200 characters long. */
    selectrecordtype: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is mandatory when the fieldtype value is equal to any of the following lists or values: SELECT, MULTISELECT.   This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
    applyformatting: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'applyformatting',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    defaultchecked: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'defaultchecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    defaultselection: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'defaultselection',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    defaultvalue: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'defaultvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    description: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'description',
      BuiltinTypes.STRING,
      {
      },
    ),
    displaytype: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'displaytype',
      enums.generic_customfield_displaytype,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_displaytype.   The default value is 'NORMAL'. */
    dynamicdefault: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'dynamicdefault',
      enums.generic_customfield_dynamicdefault,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_dynamicdefault. */
    help: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'help',
      BuiltinTypes.STRING,
      {
      },
    ),
    linktext: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'linktext',
      BuiltinTypes.STRING,
      {
      },
    ),
    minvalue: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'minvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    maxvalue: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'maxvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    storevalue: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'storevalue',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    accesslevel: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'accesslevel',
      enums.generic_accesslevel_searchlevel,
      {
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    checkspelling: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'checkspelling',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    displayheight: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'displayheight',
      BuiltinTypes.NUMBER,
      {
      },
    ), /* Original description: This field value must be greater than or equal to 0. */
    displaywidth: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'displaywidth',
      BuiltinTypes.NUMBER,
      {
      },
    ), /* Original description: This field value must be greater than or equal to 0. */
    isformula: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'isformula',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    ismandatory: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'ismandatory',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    maxlength: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'maxlength',
      BuiltinTypes.STRING,
      {
      },
    ),
    onparentdelete: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'onparentdelete',
      enums.generic_customfield_onparentdelete,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_onparentdelete. */
    searchcomparefield: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'searchcomparefield',
      enums.generic_standard_field,
      {
      },
    ), /* Original description: For information about possible values, see generic_standard_field. */
    searchdefault: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'searchdefault',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    searchlevel: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'searchlevel',
      enums.generic_accesslevel_searchlevel,
      {
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    setting: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'setting',
      enums.script_setting,
      {
      },
    ), /* Original description: For information about possible values, see script_setting. */
    customfieldfilters: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'customfieldfilters',
      bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters,
      {
      },
    ),
    roleaccesses: new Field(
      bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
      'roleaccesses',
      bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, bundleinstallationscriptElemID.name],
})

bundleinstallationscriptInnerTypes.push(bundleinstallationscript_scriptcustomfields_scriptcustomfield)

const bundleinstallationscript_scriptcustomfieldsElemID = new ElemID(constants.NETSUITE, 'bundleinstallationscript_scriptcustomfields')

const bundleinstallationscript_scriptcustomfields = new ObjectType({
  elemID: bundleinstallationscript_scriptcustomfieldsElemID,
  annotations: {
  },
  fields: {
    scriptcustomfield: new Field(
      bundleinstallationscript_scriptcustomfieldsElemID,
      'scriptcustomfield',
      new ListType(bundleinstallationscript_scriptcustomfields_scriptcustomfield),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, bundleinstallationscriptElemID.name],
})

bundleinstallationscriptInnerTypes.push(bundleinstallationscript_scriptcustomfields)

const bundleinstallationscript_scriptdeployments_scriptdeploymentElemID = new ElemID(constants.NETSUITE, 'bundleinstallationscript_scriptdeployments_scriptdeployment')

const bundleinstallationscript_scriptdeployments_scriptdeployment = new ObjectType({
  elemID: bundleinstallationscript_scriptdeployments_scriptdeploymentElemID,
  annotations: {
  },
  fields: {
    scriptid: new Field(
      bundleinstallationscript_scriptdeployments_scriptdeploymentElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customdeploy’. */
    status: new Field(
      bundleinstallationscript_scriptdeployments_scriptdeploymentElemID,
      'status',
      enums.script_status,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see script_status.   The default value is 'TESTING'. */
    title: new Field(
      bundleinstallationscript_scriptdeployments_scriptdeploymentElemID,
      'title',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    isdeployed: new Field(
      bundleinstallationscript_scriptdeployments_scriptdeploymentElemID,
      'isdeployed',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    loglevel: new Field(
      bundleinstallationscript_scriptdeployments_scriptdeploymentElemID,
      'loglevel',
      enums.script_loglevel,
      {
      },
    ), /* Original description: For information about possible values, see script_loglevel.   The default value is 'DEBUG'. */
    runasrole: new Field(
      bundleinstallationscript_scriptdeployments_scriptdeploymentElemID,
      'runasrole',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the role custom type.   For information about other possible values, see generic_role. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, bundleinstallationscriptElemID.name],
})

bundleinstallationscriptInnerTypes.push(bundleinstallationscript_scriptdeployments_scriptdeployment)

const bundleinstallationscript_scriptdeploymentsElemID = new ElemID(constants.NETSUITE, 'bundleinstallationscript_scriptdeployments')

const bundleinstallationscript_scriptdeployments = new ObjectType({
  elemID: bundleinstallationscript_scriptdeploymentsElemID,
  annotations: {
  },
  fields: {
    scriptdeployment: new Field(
      bundleinstallationscript_scriptdeploymentsElemID,
      'scriptdeployment',
      new ListType(bundleinstallationscript_scriptdeployments_scriptdeployment),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, bundleinstallationscriptElemID.name],
})

bundleinstallationscriptInnerTypes.push(bundleinstallationscript_scriptdeployments)


export const bundleinstallationscript = new ObjectType({
  elemID: bundleinstallationscriptElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'customscript_',
  },
  fields: {
    scriptid: new Field(
      bundleinstallationscriptElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customscript’. */
    name: new Field(
      bundleinstallationscriptElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    ), /* Original description: This field value can be up to 40 characters long. */
    scriptfile: new Field(
      bundleinstallationscriptElemID,
      'scriptfile',
      BuiltinTypes.STRING /* Original type was filereference */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field must reference a .js file. */
    description: new Field(
      bundleinstallationscriptElemID,
      'description',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    ), /* Original description: This field value can be up to 999 characters long. */
    isinactive: new Field(
      bundleinstallationscriptElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    notifyadmins: new Field(
      bundleinstallationscriptElemID,
      'notifyadmins',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    notifyemails: new Field(
      bundleinstallationscriptElemID,
      'notifyemails',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    ), /* Original description: This field value can be up to 999 characters long. */
    notifyowner: new Field(
      bundleinstallationscriptElemID,
      'notifyowner',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    afterinstallfunction: new Field(
      bundleinstallationscriptElemID,
      'afterinstallfunction',
      BuiltinTypes.STRING,
      {
      },
    ),
    afterupdatefunction: new Field(
      bundleinstallationscriptElemID,
      'afterupdatefunction',
      BuiltinTypes.STRING,
      {
      },
    ),
    beforeinstallfunction: new Field(
      bundleinstallationscriptElemID,
      'beforeinstallfunction',
      BuiltinTypes.STRING,
      {
      },
    ),
    beforeuninstallfunction: new Field(
      bundleinstallationscriptElemID,
      'beforeuninstallfunction',
      BuiltinTypes.STRING,
      {
      },
    ),
    beforeupdatefunction: new Field(
      bundleinstallationscriptElemID,
      'beforeupdatefunction',
      BuiltinTypes.STRING,
      {
      },
    ),
    customplugintypes: new Field(
      bundleinstallationscriptElemID,
      'customplugintypes',
      bundleinstallationscript_customplugintypes,
      {
      },
    ),
    libraries: new Field(
      bundleinstallationscriptElemID,
      'libraries',
      bundleinstallationscript_libraries,
      {
      },
    ),
    scriptcustomfields: new Field(
      bundleinstallationscriptElemID,
      'scriptcustomfields',
      bundleinstallationscript_scriptcustomfields,
      {
      },
    ),
    scriptdeployments: new Field(
      bundleinstallationscriptElemID,
      'scriptdeployments',
      bundleinstallationscript_scriptdeployments,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, bundleinstallationscriptElemID.name],
})
