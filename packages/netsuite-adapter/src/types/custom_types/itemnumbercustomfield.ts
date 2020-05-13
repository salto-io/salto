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

export const itemnumbercustomfieldInnerTypes: ObjectType[] = []

const itemnumbercustomfieldElemID = new ElemID(constants.NETSUITE, 'itemnumbercustomfield')
const itemnumbercustomfield_customfieldfilters_customfieldfilterElemID = new ElemID(constants.NETSUITE, 'itemnumbercustomfield_customfieldfilters_customfieldfilter')

const itemnumbercustomfield_customfieldfilters_customfieldfilter = new ObjectType({
  elemID: itemnumbercustomfield_customfieldfilters_customfieldfilterElemID,
  annotations: {
  },
  fields: {
    fldfilter: new Field(
      itemnumbercustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilter',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    fldfilterchecked: new Field(
      itemnumbercustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilterchecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldfiltercomparetype: new Field(
      itemnumbercustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfiltercomparetype',
      enums.generic_customfield_fldfiltercomparetype,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_fldfiltercomparetype.   The default value is 'EQ'. */
    fldfiltersel: new Field(
      itemnumbercustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfiltersel',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    fldfilterval: new Field(
      itemnumbercustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilterval',
      BuiltinTypes.STRING,
      {
      },
    ),
    fldfilternotnull: new Field(
      itemnumbercustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilternotnull',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldfilternull: new Field(
      itemnumbercustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilternull',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldcomparefield: new Field(
      itemnumbercustomfield_customfieldfilters_customfieldfilterElemID,
      'fldcomparefield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, itemnumbercustomfieldElemID.name],
})

itemnumbercustomfieldInnerTypes.push(itemnumbercustomfield_customfieldfilters_customfieldfilter)

const itemnumbercustomfield_customfieldfiltersElemID = new ElemID(constants.NETSUITE, 'itemnumbercustomfield_customfieldfilters')

const itemnumbercustomfield_customfieldfilters = new ObjectType({
  elemID: itemnumbercustomfield_customfieldfiltersElemID,
  annotations: {
  },
  fields: {
    customfieldfilter: new Field(
      itemnumbercustomfield_customfieldfiltersElemID,
      'customfieldfilter',
      new ListType(itemnumbercustomfield_customfieldfilters_customfieldfilter),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, itemnumbercustomfieldElemID.name],
})

itemnumbercustomfieldInnerTypes.push(itemnumbercustomfield_customfieldfilters)

const itemnumbercustomfield_roleaccesses_roleaccessElemID = new ElemID(constants.NETSUITE, 'itemnumbercustomfield_roleaccesses_roleaccess')

const itemnumbercustomfield_roleaccesses_roleaccess = new ObjectType({
  elemID: itemnumbercustomfield_roleaccesses_roleaccessElemID,
  annotations: {
  },
  fields: {
    role: new Field(
      itemnumbercustomfield_roleaccesses_roleaccessElemID,
      'role',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */
    accesslevel: new Field(
      itemnumbercustomfield_roleaccesses_roleaccessElemID,
      'accesslevel',
      enums.generic_accesslevel_searchlevel,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
    searchlevel: new Field(
      itemnumbercustomfield_roleaccesses_roleaccessElemID,
      'searchlevel',
      enums.generic_accesslevel_searchlevel,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, itemnumbercustomfieldElemID.name],
})

itemnumbercustomfieldInnerTypes.push(itemnumbercustomfield_roleaccesses_roleaccess)

const itemnumbercustomfield_roleaccessesElemID = new ElemID(constants.NETSUITE, 'itemnumbercustomfield_roleaccesses')

const itemnumbercustomfield_roleaccesses = new ObjectType({
  elemID: itemnumbercustomfield_roleaccessesElemID,
  annotations: {
  },
  fields: {
    roleaccess: new Field(
      itemnumbercustomfield_roleaccessesElemID,
      'roleaccess',
      new ListType(itemnumbercustomfield_roleaccesses_roleaccess),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, itemnumbercustomfieldElemID.name],
})

itemnumbercustomfieldInnerTypes.push(itemnumbercustomfield_roleaccesses)


export const itemnumbercustomfield = new ObjectType({
  elemID: itemnumbercustomfieldElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'custitemnumber_',
  },
  fields: {
    scriptid: new Field(
      itemnumbercustomfieldElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 44 characters long.   The default value is ‘custitemnumber’. */
    fieldtype: new Field(
      itemnumbercustomfieldElemID,
      'fieldtype',
      enums.generic_customfield_fieldtype,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_customfield_fieldtype.   The default value is 'TEXT'. */
    label: new Field(
      itemnumbercustomfieldElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    ), /* Original description: This field value can be up to 200 characters long. */
    selectrecordtype: new Field(
      itemnumbercustomfieldElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is mandatory when the fieldtype value is equal to any of the following lists or values: SELECT, MULTISELECT.   This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
    applyformatting: new Field(
      itemnumbercustomfieldElemID,
      'applyformatting',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    defaultchecked: new Field(
      itemnumbercustomfieldElemID,
      'defaultchecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    defaultselection: new Field(
      itemnumbercustomfieldElemID,
      'defaultselection',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    defaultvalue: new Field(
      itemnumbercustomfieldElemID,
      'defaultvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    description: new Field(
      itemnumbercustomfieldElemID,
      'description',
      BuiltinTypes.STRING,
      {
      },
    ),
    displaytype: new Field(
      itemnumbercustomfieldElemID,
      'displaytype',
      enums.generic_customfield_displaytype,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_displaytype.   The default value is 'NORMAL'. */
    dynamicdefault: new Field(
      itemnumbercustomfieldElemID,
      'dynamicdefault',
      enums.generic_customfield_dynamicdefault,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_dynamicdefault. */
    help: new Field(
      itemnumbercustomfieldElemID,
      'help',
      BuiltinTypes.STRING,
      {
      },
    ),
    linktext: new Field(
      itemnumbercustomfieldElemID,
      'linktext',
      BuiltinTypes.STRING,
      {
      },
    ),
    minvalue: new Field(
      itemnumbercustomfieldElemID,
      'minvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    maxvalue: new Field(
      itemnumbercustomfieldElemID,
      'maxvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    storevalue: new Field(
      itemnumbercustomfieldElemID,
      'storevalue',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    accesslevel: new Field(
      itemnumbercustomfieldElemID,
      'accesslevel',
      enums.generic_accesslevel_searchlevel,
      {
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    checkspelling: new Field(
      itemnumbercustomfieldElemID,
      'checkspelling',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    encryptatrest: new Field(
      itemnumbercustomfieldElemID,
      'encryptatrest',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    displayheight: new Field(
      itemnumbercustomfieldElemID,
      'displayheight',
      BuiltinTypes.NUMBER,
      {
      },
    ), /* Original description: This field value must be greater than or equal to 0. */
    displaywidth: new Field(
      itemnumbercustomfieldElemID,
      'displaywidth',
      BuiltinTypes.NUMBER,
      {
      },
    ), /* Original description: This field value must be greater than or equal to 0. */
    globalsearch: new Field(
      itemnumbercustomfieldElemID,
      'globalsearch',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    isformula: new Field(
      itemnumbercustomfieldElemID,
      'isformula',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    ismandatory: new Field(
      itemnumbercustomfieldElemID,
      'ismandatory',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    maxlength: new Field(
      itemnumbercustomfieldElemID,
      'maxlength',
      BuiltinTypes.STRING,
      {
      },
    ),
    onparentdelete: new Field(
      itemnumbercustomfieldElemID,
      'onparentdelete',
      enums.generic_customfield_onparentdelete,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_onparentdelete. */
    searchcomparefield: new Field(
      itemnumbercustomfieldElemID,
      'searchcomparefield',
      enums.generic_standard_field,
      {
      },
    ), /* Original description: For information about possible values, see generic_standard_field. */
    searchdefault: new Field(
      itemnumbercustomfieldElemID,
      'searchdefault',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    searchlevel: new Field(
      itemnumbercustomfieldElemID,
      'searchlevel',
      enums.generic_accesslevel_searchlevel,
      {
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    showhierarchy: new Field(
      itemnumbercustomfieldElemID,
      'showhierarchy',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    showinlist: new Field(
      itemnumbercustomfieldElemID,
      'showinlist',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    sourcefilterby: new Field(
      itemnumbercustomfieldElemID,
      'sourcefilterby',
      enums.generic_standard_field,
      {
      },
    ), /* Original description: For information about possible values, see generic_standard_field. */
    sourcefrom: new Field(
      itemnumbercustomfieldElemID,
      'sourcefrom',
      BuiltinTypes.STRING /* Original type was enums.generic_standard_field but it can also be reference */,
      {
      },
    ), /* Original description: For information about possible values, see generic_standard_field. */
    sourcelist: new Field(
      itemnumbercustomfieldElemID,
      'sourcelist',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the itemnumbercustomfield custom type.   For information about other possible values, see generic_standard_field. */
    appliestoallitems: new Field(
      itemnumbercustomfieldElemID,
      'appliestoallitems',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    appliestogiftcerts: new Field(
      itemnumbercustomfieldElemID,
      'appliestogiftcerts',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    appliestolots: new Field(
      itemnumbercustomfieldElemID,
      'appliestolots',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    appliestoserialized: new Field(
      itemnumbercustomfieldElemID,
      'appliestoserialized',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    customfieldfilters: new Field(
      itemnumbercustomfieldElemID,
      'customfieldfilters',
      itemnumbercustomfield_customfieldfilters,
      {
      },
    ),
    roleaccesses: new Field(
      itemnumbercustomfieldElemID,
      'roleaccesses',
      itemnumbercustomfield_roleaccesses,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, itemnumbercustomfieldElemID.name],
})
