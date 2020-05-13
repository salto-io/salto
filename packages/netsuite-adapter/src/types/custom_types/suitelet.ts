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

export const suiteletInnerTypes: ObjectType[] = []

const suiteletElemID = new ElemID(constants.NETSUITE, 'suitelet')
const suitelet_customplugintypes_plugintypeElemID = new ElemID(constants.NETSUITE, 'suitelet_customplugintypes_plugintype')

const suitelet_customplugintypes_plugintype = new ObjectType({
  elemID: suitelet_customplugintypes_plugintypeElemID,
  annotations: {
  },
  fields: {
    plugintype: new Field(
      suitelet_customplugintypes_plugintypeElemID,
      'plugintype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the plugintype custom type. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, suiteletElemID.name],
})

suiteletInnerTypes.push(suitelet_customplugintypes_plugintype)

const suitelet_customplugintypesElemID = new ElemID(constants.NETSUITE, 'suitelet_customplugintypes')

const suitelet_customplugintypes = new ObjectType({
  elemID: suitelet_customplugintypesElemID,
  annotations: {
  },
  fields: {
    plugintype: new Field(
      suitelet_customplugintypesElemID,
      'plugintype',
      new ListType(suitelet_customplugintypes_plugintype),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, suiteletElemID.name],
})

suiteletInnerTypes.push(suitelet_customplugintypes)

const suitelet_libraries_libraryElemID = new ElemID(constants.NETSUITE, 'suitelet_libraries_library')

const suitelet_libraries_library = new ObjectType({
  elemID: suitelet_libraries_libraryElemID,
  annotations: {
  },
  fields: {
    scriptfile: new Field(
      suitelet_libraries_libraryElemID,
      'scriptfile',
      BuiltinTypes.STRING /* Original type was filereference */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field must reference a .js file. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, suiteletElemID.name],
})

suiteletInnerTypes.push(suitelet_libraries_library)

const suitelet_librariesElemID = new ElemID(constants.NETSUITE, 'suitelet_libraries')

const suitelet_libraries = new ObjectType({
  elemID: suitelet_librariesElemID,
  annotations: {
  },
  fields: {
    library: new Field(
      suitelet_librariesElemID,
      'library',
      new ListType(suitelet_libraries_library),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, suiteletElemID.name],
})

suiteletInnerTypes.push(suitelet_libraries)

const suitelet_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID = new ElemID(constants.NETSUITE, 'suitelet_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter')

const suitelet_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter = new ObjectType({
  elemID: suitelet_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
  annotations: {
  },
  fields: {
    fldfilter: new Field(
      suitelet_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilter',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    fldfilterchecked: new Field(
      suitelet_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilterchecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldfiltercomparetype: new Field(
      suitelet_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfiltercomparetype',
      enums.generic_customfield_fldfiltercomparetype,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_fldfiltercomparetype.   The default value is 'EQ'. */
    fldfiltersel: new Field(
      suitelet_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfiltersel',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    fldfilterval: new Field(
      suitelet_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilterval',
      BuiltinTypes.STRING,
      {
      },
    ),
    fldfilternotnull: new Field(
      suitelet_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilternotnull',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldfilternull: new Field(
      suitelet_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilternull',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldcomparefield: new Field(
      suitelet_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldcomparefield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, suiteletElemID.name],
})

suiteletInnerTypes.push(suitelet_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter)

const suitelet_scriptcustomfields_scriptcustomfield_customfieldfiltersElemID = new ElemID(constants.NETSUITE, 'suitelet_scriptcustomfields_scriptcustomfield_customfieldfilters')

const suitelet_scriptcustomfields_scriptcustomfield_customfieldfilters = new ObjectType({
  elemID: suitelet_scriptcustomfields_scriptcustomfield_customfieldfiltersElemID,
  annotations: {
  },
  fields: {
    customfieldfilter: new Field(
      suitelet_scriptcustomfields_scriptcustomfield_customfieldfiltersElemID,
      'customfieldfilter',
      new ListType(suitelet_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, suiteletElemID.name],
})

suiteletInnerTypes.push(suitelet_scriptcustomfields_scriptcustomfield_customfieldfilters)

const suitelet_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID = new ElemID(constants.NETSUITE, 'suitelet_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess')

const suitelet_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess = new ObjectType({
  elemID: suitelet_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID,
  annotations: {
  },
  fields: {
    role: new Field(
      suitelet_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID,
      'role',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */
    accesslevel: new Field(
      suitelet_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID,
      'accesslevel',
      enums.generic_accesslevel_searchlevel,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
    searchlevel: new Field(
      suitelet_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID,
      'searchlevel',
      enums.generic_accesslevel_searchlevel,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, suiteletElemID.name],
})

suiteletInnerTypes.push(suitelet_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess)

const suitelet_scriptcustomfields_scriptcustomfield_roleaccessesElemID = new ElemID(constants.NETSUITE, 'suitelet_scriptcustomfields_scriptcustomfield_roleaccesses')

const suitelet_scriptcustomfields_scriptcustomfield_roleaccesses = new ObjectType({
  elemID: suitelet_scriptcustomfields_scriptcustomfield_roleaccessesElemID,
  annotations: {
  },
  fields: {
    roleaccess: new Field(
      suitelet_scriptcustomfields_scriptcustomfield_roleaccessesElemID,
      'roleaccess',
      new ListType(suitelet_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, suiteletElemID.name],
})

suiteletInnerTypes.push(suitelet_scriptcustomfields_scriptcustomfield_roleaccesses)

const suitelet_scriptcustomfields_scriptcustomfieldElemID = new ElemID(constants.NETSUITE, 'suitelet_scriptcustomfields_scriptcustomfield')

const suitelet_scriptcustomfields_scriptcustomfield = new ObjectType({
  elemID: suitelet_scriptcustomfields_scriptcustomfieldElemID,
  annotations: {
  },
  fields: {
    scriptid: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘custscript’. */
    fieldtype: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'fieldtype',
      enums.generic_customfield_fieldtype,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_customfield_fieldtype.   The default value is 'TEXT'. */
    label: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    ), /* Original description: This field value can be up to 200 characters long. */
    selectrecordtype: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is mandatory when the fieldtype value is equal to any of the following lists or values: SELECT, MULTISELECT.   This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
    applyformatting: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'applyformatting',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    defaultchecked: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'defaultchecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    defaultselection: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'defaultselection',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    defaultvalue: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'defaultvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    description: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'description',
      BuiltinTypes.STRING,
      {
      },
    ),
    displaytype: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'displaytype',
      enums.generic_customfield_displaytype,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_displaytype.   The default value is 'NORMAL'. */
    dynamicdefault: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'dynamicdefault',
      enums.generic_customfield_dynamicdefault,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_dynamicdefault. */
    help: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'help',
      BuiltinTypes.STRING,
      {
      },
    ),
    linktext: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'linktext',
      BuiltinTypes.STRING,
      {
      },
    ),
    minvalue: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'minvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    maxvalue: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'maxvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    storevalue: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'storevalue',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    accesslevel: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'accesslevel',
      enums.generic_accesslevel_searchlevel,
      {
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    checkspelling: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'checkspelling',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    displayheight: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'displayheight',
      BuiltinTypes.NUMBER,
      {
      },
    ), /* Original description: This field value must be greater than or equal to 0. */
    displaywidth: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'displaywidth',
      BuiltinTypes.NUMBER,
      {
      },
    ), /* Original description: This field value must be greater than or equal to 0. */
    isformula: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'isformula',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    ismandatory: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'ismandatory',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    maxlength: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'maxlength',
      BuiltinTypes.STRING,
      {
      },
    ),
    onparentdelete: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'onparentdelete',
      enums.generic_customfield_onparentdelete,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_onparentdelete. */
    searchcomparefield: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'searchcomparefield',
      enums.generic_standard_field,
      {
      },
    ), /* Original description: For information about possible values, see generic_standard_field. */
    searchdefault: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'searchdefault',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    searchlevel: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'searchlevel',
      enums.generic_accesslevel_searchlevel,
      {
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    setting: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'setting',
      enums.script_setting,
      {
      },
    ), /* Original description: For information about possible values, see script_setting. */
    customfieldfilters: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'customfieldfilters',
      suitelet_scriptcustomfields_scriptcustomfield_customfieldfilters,
      {
      },
    ),
    roleaccesses: new Field(
      suitelet_scriptcustomfields_scriptcustomfieldElemID,
      'roleaccesses',
      suitelet_scriptcustomfields_scriptcustomfield_roleaccesses,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, suiteletElemID.name],
})

suiteletInnerTypes.push(suitelet_scriptcustomfields_scriptcustomfield)

const suitelet_scriptcustomfieldsElemID = new ElemID(constants.NETSUITE, 'suitelet_scriptcustomfields')

const suitelet_scriptcustomfields = new ObjectType({
  elemID: suitelet_scriptcustomfieldsElemID,
  annotations: {
  },
  fields: {
    scriptcustomfield: new Field(
      suitelet_scriptcustomfieldsElemID,
      'scriptcustomfield',
      new ListType(suitelet_scriptcustomfields_scriptcustomfield),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, suiteletElemID.name],
})

suiteletInnerTypes.push(suitelet_scriptcustomfields)

const suitelet_scriptdeployments_scriptdeployment_links_linkElemID = new ElemID(constants.NETSUITE, 'suitelet_scriptdeployments_scriptdeployment_links_link')

const suitelet_scriptdeployments_scriptdeployment_links_link = new ObjectType({
  elemID: suitelet_scriptdeployments_scriptdeployment_links_linkElemID,
  annotations: {
  },
  fields: {
    linkcategory: new Field(
      suitelet_scriptdeployments_scriptdeployment_links_linkElemID,
      'linkcategory',
      enums.generic_centercategory,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_centercategory. */
    linktasktype: new Field(
      suitelet_scriptdeployments_scriptdeployment_links_linkElemID,
      'linktasktype',
      enums.suiteletdeployment_tasktype,
      {
      },
    ), /* Original description: For information about possible values, see suiteletdeployment_tasktype. */
    linklabel: new Field(
      suitelet_scriptdeployments_scriptdeployment_links_linkElemID,
      'linklabel',
      BuiltinTypes.STRING,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, suiteletElemID.name],
})

suiteletInnerTypes.push(suitelet_scriptdeployments_scriptdeployment_links_link)

const suitelet_scriptdeployments_scriptdeployment_linksElemID = new ElemID(constants.NETSUITE, 'suitelet_scriptdeployments_scriptdeployment_links')

const suitelet_scriptdeployments_scriptdeployment_links = new ObjectType({
  elemID: suitelet_scriptdeployments_scriptdeployment_linksElemID,
  annotations: {
  },
  fields: {
    link: new Field(
      suitelet_scriptdeployments_scriptdeployment_linksElemID,
      'link',
      new ListType(suitelet_scriptdeployments_scriptdeployment_links_link),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, suiteletElemID.name],
})

suiteletInnerTypes.push(suitelet_scriptdeployments_scriptdeployment_links)

const suitelet_scriptdeployments_scriptdeploymentElemID = new ElemID(constants.NETSUITE, 'suitelet_scriptdeployments_scriptdeployment')

const suitelet_scriptdeployments_scriptdeployment = new ObjectType({
  elemID: suitelet_scriptdeployments_scriptdeploymentElemID,
  annotations: {
  },
  fields: {
    scriptid: new Field(
      suitelet_scriptdeployments_scriptdeploymentElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customdeploy’. */
    status: new Field(
      suitelet_scriptdeployments_scriptdeploymentElemID,
      'status',
      enums.script_status,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see script_status.   The default value is 'TESTING'. */
    title: new Field(
      suitelet_scriptdeployments_scriptdeploymentElemID,
      'title',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    allemployees: new Field(
      suitelet_scriptdeployments_scriptdeploymentElemID,
      'allemployees',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    allpartners: new Field(
      suitelet_scriptdeployments_scriptdeploymentElemID,
      'allpartners',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the CRM feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CRM must be enabled for this field to appear in your account. */
    allroles: new Field(
      suitelet_scriptdeployments_scriptdeploymentElemID,
      'allroles',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    auddepartment: new Field(
      suitelet_scriptdeployments_scriptdeploymentElemID,
      'auddepartment',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   If this field appears in the project, you must reference the DEPARTMENTS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. DEPARTMENTS must be enabled for this field to appear in your account.   Note Account-specific values are not supported by SDF. */
    audemployee: new Field(
      suitelet_scriptdeployments_scriptdeploymentElemID,
      'audemployee',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   Note Account-specific values are not supported by SDF. */
    audgroup: new Field(
      suitelet_scriptdeployments_scriptdeploymentElemID,
      'audgroup',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   Note Account-specific values are not supported by SDF. */
    audpartner: new Field(
      suitelet_scriptdeployments_scriptdeploymentElemID,
      'audpartner',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   If this field appears in the project, you must reference the CRM feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CRM must be enabled for this field to appear in your account.   Note Account-specific values are not supported by SDF. */
    audslctrole: new Field(
      suitelet_scriptdeployments_scriptdeploymentElemID,
      'audslctrole',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the role custom type.   For information about other possible values, see generic_role. */
    audsubsidiary: new Field(
      suitelet_scriptdeployments_scriptdeploymentElemID,
      'audsubsidiary',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   If this field appears in the project, you must reference the SUBSIDIARIES feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. SUBSIDIARIES must be enabled for this field to appear in your account.   Note Account-specific values are not supported by SDF. */
    eventtype: new Field(
      suitelet_scriptdeployments_scriptdeploymentElemID,
      'eventtype',
      enums.script_eventtype,
      {
      },
    ), /* Original description: For information about possible values, see script_eventtype. */
    isdeployed: new Field(
      suitelet_scriptdeployments_scriptdeploymentElemID,
      'isdeployed',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    isonline: new Field(
      suitelet_scriptdeployments_scriptdeploymentElemID,
      'isonline',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    loglevel: new Field(
      suitelet_scriptdeployments_scriptdeploymentElemID,
      'loglevel',
      enums.script_loglevel,
      {
      },
    ), /* Original description: For information about possible values, see script_loglevel.   The default value is 'DEBUG'. */
    runasrole: new Field(
      suitelet_scriptdeployments_scriptdeploymentElemID,
      'runasrole',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the role custom type.   For information about other possible values, see generic_role. */
    links: new Field(
      suitelet_scriptdeployments_scriptdeploymentElemID,
      'links',
      suitelet_scriptdeployments_scriptdeployment_links,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, suiteletElemID.name],
})

suiteletInnerTypes.push(suitelet_scriptdeployments_scriptdeployment)

const suitelet_scriptdeploymentsElemID = new ElemID(constants.NETSUITE, 'suitelet_scriptdeployments')

const suitelet_scriptdeployments = new ObjectType({
  elemID: suitelet_scriptdeploymentsElemID,
  annotations: {
  },
  fields: {
    scriptdeployment: new Field(
      suitelet_scriptdeploymentsElemID,
      'scriptdeployment',
      new ListType(suitelet_scriptdeployments_scriptdeployment),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, suiteletElemID.name],
})

suiteletInnerTypes.push(suitelet_scriptdeployments)


export const suitelet = new ObjectType({
  elemID: suiteletElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'customscript_',
  },
  fields: {
    scriptid: new Field(
      suiteletElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customscript’. */
    name: new Field(
      suiteletElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    ), /* Original description: This field value can be up to 40 characters long. */
    scriptfile: new Field(
      suiteletElemID,
      'scriptfile',
      BuiltinTypes.STRING /* Original type was filereference */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field must reference a .js file. */
    defaultfunction: new Field(
      suiteletElemID,
      'defaultfunction',
      BuiltinTypes.STRING,
      {
      },
    ),
    description: new Field(
      suiteletElemID,
      'description',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    ), /* Original description: This field value can be up to 999 characters long. */
    isinactive: new Field(
      suiteletElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    notifyadmins: new Field(
      suiteletElemID,
      'notifyadmins',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    notifyemails: new Field(
      suiteletElemID,
      'notifyemails',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    ), /* Original description: This field value can be up to 999 characters long. */
    notifygroup: new Field(
      suiteletElemID,
      'notifygroup',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: Note Account-specific values are not supported by SDF. */
    notifyowner: new Field(
      suiteletElemID,
      'notifyowner',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    notifyuser: new Field(
      suiteletElemID,
      'notifyuser',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    customplugintypes: new Field(
      suiteletElemID,
      'customplugintypes',
      suitelet_customplugintypes,
      {
      },
    ),
    libraries: new Field(
      suiteletElemID,
      'libraries',
      suitelet_libraries,
      {
      },
    ),
    scriptcustomfields: new Field(
      suiteletElemID,
      'scriptcustomfields',
      suitelet_scriptcustomfields,
      {
      },
    ),
    scriptdeployments: new Field(
      suiteletElemID,
      'scriptdeployments',
      suitelet_scriptdeployments,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, suiteletElemID.name],
})
