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

export const customrecordtypeInnerTypes: ObjectType[] = []

const customrecordtypeElemID = new ElemID(constants.NETSUITE, 'customrecordtype')
const customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters_customfieldfilterElemID = new ElemID(constants.NETSUITE, 'customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters_customfieldfilter')

const customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters_customfieldfilter = new ObjectType({
  elemID: customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters_customfieldfilterElemID,
  annotations: {
  },
  fields: {
    fldfilter: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilter',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    fldfilterchecked: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilterchecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldfiltercomparetype: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfiltercomparetype',
      enums.generic_customfield_fldfiltercomparetype,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_fldfiltercomparetype.   The default value is 'EQ'. */
    fldfiltersel: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfiltersel',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    fldfilterval: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilterval',
      BuiltinTypes.STRING,
      {
      },
    ),
    fldfilternotnull: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilternotnull',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldfilternull: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilternull',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldcomparefield: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldcomparefield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters_customfieldfilter)

const customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfiltersElemID = new ElemID(constants.NETSUITE, 'customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters')

const customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters = new ObjectType({
  elemID: customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfiltersElemID,
  annotations: {
  },
  fields: {
    customfieldfilter: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfiltersElemID,
      'customfieldfilter',
      new ListType(customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters_customfieldfilter),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters)

const customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses_roleaccessElemID = new ElemID(constants.NETSUITE, 'customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses_roleaccess')

const customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses_roleaccess = new ObjectType({
  elemID: customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses_roleaccessElemID,
  annotations: {
  },
  fields: {
    role: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses_roleaccessElemID,
      'role',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */
    accesslevel: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses_roleaccessElemID,
      'accesslevel',
      enums.generic_accesslevel_searchlevel,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
    searchlevel: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses_roleaccessElemID,
      'searchlevel',
      enums.generic_accesslevel_searchlevel,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses_roleaccess)

const customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccessesElemID = new ElemID(constants.NETSUITE, 'customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses')

const customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses = new ObjectType({
  elemID: customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccessesElemID,
  annotations: {
  },
  fields: {
    roleaccess: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccessesElemID,
      'roleaccess',
      new ListType(customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses_roleaccess),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses)

const customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID = new ElemID(constants.NETSUITE, 'customrecordtype_customrecordcustomfields_customrecordcustomfield')

const customrecordtype_customrecordcustomfields_customrecordcustomfield = new ObjectType({
  elemID: customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
  annotations: {
  },
  fields: {
    scriptid: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘custrecord’. */
    fieldtype: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'fieldtype',
      enums.generic_customfield_fieldtype,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_customfield_fieldtype.   The default value is 'TEXT'. */
    label: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    ), /* Original description: This field value can be up to 200 characters long. */
    selectrecordtype: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is mandatory when the fieldtype value is equal to any of the following lists or values: SELECT, MULTISELECT.   This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
    applyformatting: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'applyformatting',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    defaultchecked: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'defaultchecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    defaultselection: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'defaultselection',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    defaultvalue: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'defaultvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    description: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'description',
      BuiltinTypes.STRING,
      {
      },
    ),
    displaytype: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'displaytype',
      enums.generic_customfield_displaytype,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_displaytype.   The default value is 'NORMAL'. */
    dynamicdefault: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'dynamicdefault',
      enums.generic_customfield_dynamicdefault,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_dynamicdefault. */
    help: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'help',
      BuiltinTypes.STRING,
      {
      },
    ),
    linktext: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'linktext',
      BuiltinTypes.STRING,
      {
      },
    ),
    minvalue: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'minvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    maxvalue: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'maxvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    storevalue: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'storevalue',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    accesslevel: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'accesslevel',
      enums.generic_accesslevel_searchlevel,
      {
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    checkspelling: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'checkspelling',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    encryptatrest: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'encryptatrest',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    displayheight: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'displayheight',
      BuiltinTypes.NUMBER,
      {
      },
    ), /* Original description: This field value must be greater than or equal to 0. */
    displaywidth: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'displaywidth',
      BuiltinTypes.NUMBER,
      {
      },
    ), /* Original description: This field value must be greater than or equal to 0. */
    globalsearch: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'globalsearch',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    isformula: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'isformula',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    ismandatory: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'ismandatory',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    maxlength: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'maxlength',
      BuiltinTypes.STRING,
      {
      },
    ),
    onparentdelete: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'onparentdelete',
      enums.generic_customfield_onparentdelete,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_onparentdelete. */
    searchcomparefield: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'searchcomparefield',
      enums.generic_standard_field,
      {
      },
    ), /* Original description: For information about possible values, see generic_standard_field. */
    searchdefault: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'searchdefault',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    searchlevel: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'searchlevel',
      enums.generic_accesslevel_searchlevel,
      {
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    showinlist: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'showinlist',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    sourcefilterby: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'sourcefilterby',
      enums.generic_standard_field,
      {
      },
    ), /* Original description: For information about possible values, see generic_standard_field. */
    sourcefrom: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'sourcefrom',
      BuiltinTypes.STRING /* Original type was enums.generic_standard_field but it can also be reference */,
      {
      },
    ), /* Original description: For information about possible values, see generic_standard_field. */
    sourcelist: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'sourcelist',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the customrecordcustomfield custom type.   For information about other possible values, see generic_standard_field. */
    isparent: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'isparent',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    parentsubtab: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'parentsubtab',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   subtab   subtab   For information about other possible values, see generic_tab_parent. */
    subtab: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'subtab',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the subtab custom type. */
    allowquickadd: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'allowquickadd',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    rolerestrict: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'rolerestrict',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    customfieldfilters: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'customfieldfilters',
      customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters,
      {
      },
    ),
    roleaccesses: new Field(
      customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
      'roleaccesses',
      customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_customrecordcustomfields_customrecordcustomfield)

const customrecordtype_customrecordcustomfieldsElemID = new ElemID(constants.NETSUITE, 'customrecordtype_customrecordcustomfields')

const customrecordtype_customrecordcustomfields = new ObjectType({
  elemID: customrecordtype_customrecordcustomfieldsElemID,
  annotations: {
  },
  fields: {
    customrecordcustomfield: new Field(
      customrecordtype_customrecordcustomfieldsElemID,
      'customrecordcustomfield',
      new ListType(customrecordtype_customrecordcustomfields_customrecordcustomfield),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_customrecordcustomfields)

const customrecordtype_instances_instanceElemID = new ElemID(constants.NETSUITE, 'customrecordtype_instances_instance')

const customrecordtype_instances_instance = new ObjectType({
  elemID: customrecordtype_instances_instanceElemID,
  annotations: {
  },
  fields: {
    scriptid: new Field(
      customrecordtype_instances_instanceElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long. */
    altname: new Field(
      customrecordtype_instances_instanceElemID,
      'altname',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: This field is available when the includename value is equal to T.   This field is available when the enablenumbering value is equal to T.   This field is mandatory when the includename value is equal to T.   This field is mandatory when the enablenumbering value is equal to T. */
    name: new Field(
      customrecordtype_instances_instanceElemID,
      'name',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: This field is available when the includename value is equal to T.   This field is available when the enablenumbering value is equal to F.   This field is mandatory when the includename value is equal to T.   This field is mandatory when the enablenumbering value is equal to F. */
    isinactive: new Field(
      customrecordtype_instances_instanceElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    parent: new Field(
      customrecordtype_instances_instanceElemID,
      'parent',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is available when the hierarchical value is equal to T.   This field accepts references to the instance custom type. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_instances_instance)

const customrecordtype_instancesElemID = new ElemID(constants.NETSUITE, 'customrecordtype_instances')

const customrecordtype_instances = new ObjectType({
  elemID: customrecordtype_instancesElemID,
  annotations: {
  },
  fields: {
    instance: new Field(
      customrecordtype_instancesElemID,
      'instance',
      new ListType(customrecordtype_instances_instance),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_instances)

const customrecordtype_links_linkElemID = new ElemID(constants.NETSUITE, 'customrecordtype_links_link')

const customrecordtype_links_link = new ObjectType({
  elemID: customrecordtype_links_linkElemID,
  annotations: {
  },
  fields: {
    linkcategory: new Field(
      customrecordtype_links_linkElemID,
      'linkcategory',
      enums.generic_centercategory,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_centercategory. */
    linktasktype: new Field(
      customrecordtype_links_linkElemID,
      'linktasktype',
      enums.customrecordtype_tasktype,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see customrecordtype_tasktype. */
    linklabel: new Field(
      customrecordtype_links_linkElemID,
      'linklabel',
      BuiltinTypes.STRING,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_links_link)

const customrecordtype_linksElemID = new ElemID(constants.NETSUITE, 'customrecordtype_links')

const customrecordtype_links = new ObjectType({
  elemID: customrecordtype_linksElemID,
  annotations: {
  },
  fields: {
    link: new Field(
      customrecordtype_linksElemID,
      'link',
      new ListType(customrecordtype_links_link),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_links)

const customrecordtype_permissions_permissionElemID = new ElemID(constants.NETSUITE, 'customrecordtype_permissions_permission')

const customrecordtype_permissions_permission = new ObjectType({
  elemID: customrecordtype_permissions_permissionElemID,
  annotations: {
  },
  fields: {
    permittedrole: new Field(
      customrecordtype_permissions_permissionElemID,
      'permittedrole',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */
    permittedlevel: new Field(
      customrecordtype_permissions_permissionElemID,
      'permittedlevel',
      enums.generic_permission_level,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_permission_level.   The default value is 'NONE'. */
    restriction: new Field(
      customrecordtype_permissions_permissionElemID,
      'restriction',
      enums.role_restrict,
      {
      },
    ), /* Original description: For information about possible values, see role_restrict. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_permissions_permission)

const customrecordtype_permissionsElemID = new ElemID(constants.NETSUITE, 'customrecordtype_permissions')

const customrecordtype_permissions = new ObjectType({
  elemID: customrecordtype_permissionsElemID,
  annotations: {
  },
  fields: {
    permission: new Field(
      customrecordtype_permissionsElemID,
      'permission',
      new ListType(customrecordtype_permissions_permission),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_permissions)

const customrecordtype_recordsublists_recordsublistElemID = new ElemID(constants.NETSUITE, 'customrecordtype_recordsublists_recordsublist')

const customrecordtype_recordsublists_recordsublist = new ObjectType({
  elemID: customrecordtype_recordsublists_recordsublistElemID,
  annotations: {
  },
  fields: {
    scriptid: new Field(
      customrecordtype_recordsublists_recordsublistElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long. */
    recordsearch: new Field(
      customrecordtype_recordsublists_recordsublistElemID,
      'recordsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    recorddescr: new Field(
      customrecordtype_recordsublists_recordsublistElemID,
      'recorddescr',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    recordtab: new Field(
      customrecordtype_recordsublists_recordsublistElemID,
      'recordtab',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the subtab custom type. */
    recordfield: new Field(
      customrecordtype_recordsublists_recordsublistElemID,
      'recordfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the customrecordcustomfield custom type.   For information about other possible values, see generic_standard_field. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_recordsublists_recordsublist)

const customrecordtype_recordsublistsElemID = new ElemID(constants.NETSUITE, 'customrecordtype_recordsublists')

const customrecordtype_recordsublists = new ObjectType({
  elemID: customrecordtype_recordsublistsElemID,
  annotations: {
  },
  fields: {
    recordsublist: new Field(
      customrecordtype_recordsublistsElemID,
      'recordsublist',
      new ListType(customrecordtype_recordsublists_recordsublist),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_recordsublists)

const customrecordtype_subtabs_subtabElemID = new ElemID(constants.NETSUITE, 'customrecordtype_subtabs_subtab')

const customrecordtype_subtabs_subtab = new ObjectType({
  elemID: customrecordtype_subtabs_subtabElemID,
  annotations: {
  },
  fields: {
    scriptid: new Field(
      customrecordtype_subtabs_subtabElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long. */
    tabtitle: new Field(
      customrecordtype_subtabs_subtabElemID,
      'tabtitle',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    tabparent: new Field(
      customrecordtype_subtabs_subtabElemID,
      'tabparent',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the subtab custom type. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_subtabs_subtab)

const customrecordtype_subtabsElemID = new ElemID(constants.NETSUITE, 'customrecordtype_subtabs')

const customrecordtype_subtabs = new ObjectType({
  elemID: customrecordtype_subtabsElemID,
  annotations: {
  },
  fields: {
    subtab: new Field(
      customrecordtype_subtabsElemID,
      'subtab',
      new ListType(customrecordtype_subtabs_subtab),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_subtabs)


export const customrecordtype = new ObjectType({
  elemID: customrecordtypeElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'customrecord_',
  },
  fields: {
    scriptid: new Field(
      customrecordtypeElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customrecord’. */
    recordname: new Field(
      customrecordtypeElemID,
      'recordname',
      BuiltinTypes.STRING,
      {
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    ), /* Original description: This field value can be up to 40 characters long.   This field is available when the customsegment value is equal to   This field is mandatory when the customsegment value is equal to */
    customsegment: new Field(
      customrecordtypeElemID,
      'customsegment',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the customsegment custom type.   If this field appears in the project, you must reference the CUSTOMSEGMENTS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CUSTOMSEGMENTS must be enabled for this field to appear in your account. */
    accesstype: new Field(
      customrecordtypeElemID,
      'accesstype',
      enums.customrecordtype_accesstype,
      {
      },
    ), /* Original description: This field is available when the customsegment value is equal to   For information about possible values, see customrecordtype_accesstype.   The default value is 'CUSTRECORDENTRYPERM'. */
    allowattachments: new Field(
      customrecordtypeElemID,
      'allowattachments',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    allowinlineediting: new Field(
      customrecordtypeElemID,
      'allowinlineediting',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    allowinlinedeleting: new Field(
      customrecordtypeElemID,
      'allowinlinedeleting',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    allowinlinedetaching: new Field(
      customrecordtypeElemID,
      'allowinlinedetaching',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    allowmobileaccess: new Field(
      customrecordtypeElemID,
      'allowmobileaccess',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: This field is available when the customsegment value is equal to   The default value is F. */
    allownumberingoverride: new Field(
      customrecordtypeElemID,
      'allownumberingoverride',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: This field is available when the customsegment value is equal to   The default value is F. */
    allowquickadd: new Field(
      customrecordtypeElemID,
      'allowquickadd',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    allowquicksearch: new Field(
      customrecordtypeElemID,
      'allowquicksearch',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    allowuiaccess: new Field(
      customrecordtypeElemID,
      'allowuiaccess',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: This field is available when the customsegment value is equal to   The default value is T. */
    description: new Field(
      customrecordtypeElemID,
      'description',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: This field is available when the customsegment value is equal to */
    enabledle: new Field(
      customrecordtypeElemID,
      'enabledle',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T.   If this field appears in the project, you must reference the EXTREMELIST feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. EXTREMELIST must be enabled for this field to appear in your account. */
    enablekeywords: new Field(
      customrecordtypeElemID,
      'enablekeywords',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    enablemailmerge: new Field(
      customrecordtypeElemID,
      'enablemailmerge',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the MAILMERGE feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. MAILMERGE must be enabled for this field to appear in your account. */
    enablenametranslation: new Field(
      customrecordtypeElemID,
      'enablenametranslation',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: This field is available when the customsegment value is equal to   The default value is F.   If this field appears in the project, you must reference the MULTILANGUAGE feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. MULTILANGUAGE must be enabled for this field to appear in your account. */
    enablenumbering: new Field(
      customrecordtypeElemID,
      'enablenumbering',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: This field is available when the customsegment value is equal to   The default value is F. */
    enableoptimisticlocking: new Field(
      customrecordtypeElemID,
      'enableoptimisticlocking',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    enablesystemnotes: new Field(
      customrecordtypeElemID,
      'enablesystemnotes',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    hierarchical: new Field(
      customrecordtypeElemID,
      'hierarchical',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: This field is available when the customsegment value is equal to   The default value is F. */
    numberingprefix: new Field(
      customrecordtypeElemID,
      'numberingprefix',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: This field is available when the customsegment value is equal to */
    numberingsuffix: new Field(
      customrecordtypeElemID,
      'numberingsuffix',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: This field is available when the customsegment value is equal to */
    numberingmindigits: new Field(
      customrecordtypeElemID,
      'numberingmindigits',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: This field is available when the customsegment value is equal to */
    numberinginit: new Field(
      customrecordtypeElemID,
      'numberinginit',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: This field is available when the customsegment value is equal to */
    icon: new Field(
      customrecordtypeElemID,
      'icon',
      BuiltinTypes.STRING /* Original type was filereference */,
      {
      },
    ),
    iconbuiltin: new Field(
      customrecordtypeElemID,
      'iconbuiltin',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    iconindex: new Field(
      customrecordtypeElemID,
      'iconindex',
      enums.generic_custom_record_icon,
      {
      },
    ), /* Original description: For information about possible values, see generic_custom_record_icon. */
    includeinsearchmenu: new Field(
      customrecordtypeElemID,
      'includeinsearchmenu',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    includename: new Field(
      customrecordtypeElemID,
      'includename',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: This field is available when the customsegment value is equal to   The default value is T. */
    isinactive: new Field(
      customrecordtypeElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: This field is available when the customsegment value is equal to   The default value is F. */
    isordered: new Field(
      customrecordtypeElemID,
      'isordered',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: This field is available when the customsegment value is equal to   The default value is F. */
    showcreationdate: new Field(
      customrecordtypeElemID,
      'showcreationdate',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    showcreationdateonlist: new Field(
      customrecordtypeElemID,
      'showcreationdateonlist',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    showid: new Field(
      customrecordtypeElemID,
      'showid',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: This field is available when the customsegment value is equal to   The default value is F. */
    showlastmodified: new Field(
      customrecordtypeElemID,
      'showlastmodified',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    showlastmodifiedonlist: new Field(
      customrecordtypeElemID,
      'showlastmodifiedonlist',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    shownotes: new Field(
      customrecordtypeElemID,
      'shownotes',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    showowner: new Field(
      customrecordtypeElemID,
      'showowner',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    showownerallowchange: new Field(
      customrecordtypeElemID,
      'showownerallowchange',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    showowneronlist: new Field(
      customrecordtypeElemID,
      'showowneronlist',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    customrecordcustomfields: new Field(
      customrecordtypeElemID,
      'customrecordcustomfields',
      customrecordtype_customrecordcustomfields,
      {
      },
    ),
    instances: new Field(
      customrecordtypeElemID,
      'instances',
      customrecordtype_instances,
      {
      },
    ),
    links: new Field(
      customrecordtypeElemID,
      'links',
      customrecordtype_links,
      {
      },
    ),
    permissions: new Field(
      customrecordtypeElemID,
      'permissions',
      customrecordtype_permissions,
      {
      },
    ),
    recordsublists: new Field(
      customrecordtypeElemID,
      'recordsublists',
      customrecordtype_recordsublists,
      {
      },
    ),
    subtabs: new Field(
      customrecordtypeElemID,
      'subtabs',
      customrecordtype_subtabs,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})
