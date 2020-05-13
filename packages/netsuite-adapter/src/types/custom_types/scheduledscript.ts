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

export const scheduledscriptInnerTypes: ObjectType[] = []

const scheduledscriptElemID = new ElemID(constants.NETSUITE, 'scheduledscript')
const scheduledscript_customplugintypes_plugintypeElemID = new ElemID(constants.NETSUITE, 'scheduledscript_customplugintypes_plugintype')

const scheduledscript_customplugintypes_plugintype = new ObjectType({
  elemID: scheduledscript_customplugintypes_plugintypeElemID,
  annotations: {
  },
  fields: {
    plugintype: new Field(
      scheduledscript_customplugintypes_plugintypeElemID,
      'plugintype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the plugintype custom type. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_customplugintypes_plugintype)

const scheduledscript_customplugintypesElemID = new ElemID(constants.NETSUITE, 'scheduledscript_customplugintypes')

const scheduledscript_customplugintypes = new ObjectType({
  elemID: scheduledscript_customplugintypesElemID,
  annotations: {
  },
  fields: {
    plugintype: new Field(
      scheduledscript_customplugintypesElemID,
      'plugintype',
      new ListType(scheduledscript_customplugintypes_plugintype),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_customplugintypes)

const scheduledscript_libraries_libraryElemID = new ElemID(constants.NETSUITE, 'scheduledscript_libraries_library')

const scheduledscript_libraries_library = new ObjectType({
  elemID: scheduledscript_libraries_libraryElemID,
  annotations: {
  },
  fields: {
    scriptfile: new Field(
      scheduledscript_libraries_libraryElemID,
      'scriptfile',
      BuiltinTypes.STRING /* Original type was filereference */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field must reference a .js file. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_libraries_library)

const scheduledscript_librariesElemID = new ElemID(constants.NETSUITE, 'scheduledscript_libraries')

const scheduledscript_libraries = new ObjectType({
  elemID: scheduledscript_librariesElemID,
  annotations: {
  },
  fields: {
    library: new Field(
      scheduledscript_librariesElemID,
      'library',
      new ListType(scheduledscript_libraries_library),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_libraries)

const scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter')

const scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter = new ObjectType({
  elemID: scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
  annotations: {
  },
  fields: {
    fldfilter: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilter',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    fldfilterchecked: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilterchecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldfiltercomparetype: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfiltercomparetype',
      enums.generic_customfield_fldfiltercomparetype,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_fldfiltercomparetype.   The default value is 'EQ'. */
    fldfiltersel: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfiltersel',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    fldfilterval: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilterval',
      BuiltinTypes.STRING,
      {
      },
    ),
    fldfilternotnull: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilternotnull',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldfilternull: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilternull',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldcomparefield: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldcomparefield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter)

const scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfiltersElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters')

const scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters = new ObjectType({
  elemID: scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfiltersElemID,
  annotations: {
  },
  fields: {
    customfieldfilter: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfiltersElemID,
      'customfieldfilter',
      new ListType(scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters)

const scheduledscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess')

const scheduledscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess = new ObjectType({
  elemID: scheduledscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID,
  annotations: {
  },
  fields: {
    role: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID,
      'role',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */
    accesslevel: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID,
      'accesslevel',
      enums.generic_accesslevel_searchlevel,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
    searchlevel: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID,
      'searchlevel',
      enums.generic_accesslevel_searchlevel,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess)

const scheduledscript_scriptcustomfields_scriptcustomfield_roleaccessesElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptcustomfields_scriptcustomfield_roleaccesses')

const scheduledscript_scriptcustomfields_scriptcustomfield_roleaccesses = new ObjectType({
  elemID: scheduledscript_scriptcustomfields_scriptcustomfield_roleaccessesElemID,
  annotations: {
  },
  fields: {
    roleaccess: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfield_roleaccessesElemID,
      'roleaccess',
      new ListType(scheduledscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptcustomfields_scriptcustomfield_roleaccesses)

const scheduledscript_scriptcustomfields_scriptcustomfieldElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptcustomfields_scriptcustomfield')

const scheduledscript_scriptcustomfields_scriptcustomfield = new ObjectType({
  elemID: scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
  annotations: {
  },
  fields: {
    scriptid: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘custscript’. */
    fieldtype: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'fieldtype',
      enums.generic_customfield_fieldtype,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_customfield_fieldtype.   The default value is 'TEXT'. */
    label: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    ), /* Original description: This field value can be up to 200 characters long. */
    selectrecordtype: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is mandatory when the fieldtype value is equal to any of the following lists or values: SELECT, MULTISELECT.   This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
    applyformatting: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'applyformatting',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    defaultchecked: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'defaultchecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    defaultselection: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'defaultselection',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    defaultvalue: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'defaultvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    description: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'description',
      BuiltinTypes.STRING,
      {
      },
    ),
    displaytype: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'displaytype',
      enums.generic_customfield_displaytype,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_displaytype.   The default value is 'NORMAL'. */
    dynamicdefault: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'dynamicdefault',
      enums.generic_customfield_dynamicdefault,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_dynamicdefault. */
    help: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'help',
      BuiltinTypes.STRING,
      {
      },
    ),
    linktext: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'linktext',
      BuiltinTypes.STRING,
      {
      },
    ),
    minvalue: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'minvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    maxvalue: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'maxvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    storevalue: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'storevalue',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    accesslevel: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'accesslevel',
      enums.generic_accesslevel_searchlevel,
      {
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    checkspelling: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'checkspelling',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    displayheight: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'displayheight',
      BuiltinTypes.NUMBER,
      {
      },
    ), /* Original description: This field value must be greater than or equal to 0. */
    displaywidth: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'displaywidth',
      BuiltinTypes.NUMBER,
      {
      },
    ), /* Original description: This field value must be greater than or equal to 0. */
    isformula: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'isformula',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    ismandatory: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'ismandatory',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    maxlength: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'maxlength',
      BuiltinTypes.STRING,
      {
      },
    ),
    onparentdelete: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'onparentdelete',
      enums.generic_customfield_onparentdelete,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_onparentdelete. */
    searchcomparefield: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'searchcomparefield',
      enums.generic_standard_field,
      {
      },
    ), /* Original description: For information about possible values, see generic_standard_field. */
    searchdefault: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'searchdefault',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    searchlevel: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'searchlevel',
      enums.generic_accesslevel_searchlevel,
      {
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    setting: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'setting',
      enums.script_setting,
      {
      },
    ), /* Original description: For information about possible values, see script_setting. */
    customfieldfilters: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'customfieldfilters',
      scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters,
      {
      },
    ),
    roleaccesses: new Field(
      scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
      'roleaccesses',
      scheduledscript_scriptcustomfields_scriptcustomfield_roleaccesses,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptcustomfields_scriptcustomfield)

const scheduledscript_scriptcustomfieldsElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptcustomfields')

const scheduledscript_scriptcustomfields = new ObjectType({
  elemID: scheduledscript_scriptcustomfieldsElemID,
  annotations: {
  },
  fields: {
    scriptcustomfield: new Field(
      scheduledscript_scriptcustomfieldsElemID,
      'scriptcustomfield',
      new ListType(scheduledscript_scriptcustomfields_scriptcustomfield),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptcustomfields)

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_dailyElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptdeployments_scriptdeployment_recurrence_daily')

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_daily = new ObjectType({
  elemID: scheduledscript_scriptdeployments_scriptdeployment_recurrence_dailyElemID,
  annotations: {
  },
  fields: {
    startdate: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_dailyElemID,
      'startdate',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    starttime: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_dailyElemID,
      'starttime',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    everyxdays: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_dailyElemID,
      'everyxdays',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    enddate: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_dailyElemID,
      'enddate',
      BuiltinTypes.STRING,
      {
      },
    ),
    repeat: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_dailyElemID,
      'repeat',
      enums.generic_repeat_time,
      {
      },
    ), /* Original description: For information about possible values, see generic_repeat_time. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptdeployments_scriptdeployment_recurrence_daily)

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_everyweekdayElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptdeployments_scriptdeployment_recurrence_everyweekday')

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_everyweekday = new ObjectType({
  elemID: scheduledscript_scriptdeployments_scriptdeployment_recurrence_everyweekdayElemID,
  annotations: {
  },
  fields: {
    startdate: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_everyweekdayElemID,
      'startdate',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    starttime: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_everyweekdayElemID,
      'starttime',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    enddate: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_everyweekdayElemID,
      'enddate',
      BuiltinTypes.STRING,
      {
      },
    ),
    repeat: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_everyweekdayElemID,
      'repeat',
      enums.generic_repeat_time,
      {
      },
    ), /* Original description: For information about possible values, see generic_repeat_time. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptdeployments_scriptdeployment_recurrence_everyweekday)

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthlyElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthly')

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthly = new ObjectType({
  elemID: scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthlyElemID,
  annotations: {
  },
  fields: {
    startdate: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthlyElemID,
      'startdate',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    starttime: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthlyElemID,
      'starttime',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    everyxmonths: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthlyElemID,
      'everyxmonths',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    enddate: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthlyElemID,
      'enddate',
      BuiltinTypes.STRING,
      {
      },
    ),
    repeat: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthlyElemID,
      'repeat',
      enums.generic_repeat_time,
      {
      },
    ), /* Original description: For information about possible values, see generic_repeat_time. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthly)

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweekElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweek')

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweek = new ObjectType({
  elemID: scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweekElemID,
  annotations: {
  },
  fields: {
    startdate: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweekElemID,
      'startdate',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    starttime: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweekElemID,
      'starttime',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    orderofweek: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweekElemID,
      'orderofweek',
      enums.generic_order_of_week,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_order_of_week. */
    dayofweek: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweekElemID,
      'dayofweek',
      enums.generic_day_of_week,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_day_of_week. */
    everyxmonths: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweekElemID,
      'everyxmonths',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    enddate: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweekElemID,
      'enddate',
      BuiltinTypes.STRING,
      {
      },
    ),
    repeat: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweekElemID,
      'repeat',
      enums.generic_repeat_time,
      {
      },
    ), /* Original description: For information about possible values, see generic_repeat_time. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweek)

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_singleElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptdeployments_scriptdeployment_recurrence_single')

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_single = new ObjectType({
  elemID: scheduledscript_scriptdeployments_scriptdeployment_recurrence_singleElemID,
  annotations: {
  },
  fields: {
    startdate: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_singleElemID,
      'startdate',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    starttime: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_singleElemID,
      'starttime',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    repeat: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_singleElemID,
      'repeat',
      enums.generic_repeat_time,
      {
      },
    ), /* Original description: For information about possible values, see generic_repeat_time. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptdeployments_scriptdeployment_recurrence_single)

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptdeployments_scriptdeployment_recurrence_weekly')

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_weekly = new ObjectType({
  elemID: scheduledscript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID,
  annotations: {
  },
  fields: {
    startdate: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID,
      'startdate',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    starttime: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID,
      'starttime',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    everyxweeks: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID,
      'everyxweeks',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    sunday: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID,
      'sunday',
      BuiltinTypes.BOOLEAN,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: The default value is F. */
    monday: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID,
      'monday',
      BuiltinTypes.BOOLEAN,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: The default value is F. */
    tuesday: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID,
      'tuesday',
      BuiltinTypes.BOOLEAN,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: The default value is F. */
    wednesday: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID,
      'wednesday',
      BuiltinTypes.BOOLEAN,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: The default value is F. */
    thursday: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID,
      'thursday',
      BuiltinTypes.BOOLEAN,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: The default value is F. */
    friday: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID,
      'friday',
      BuiltinTypes.BOOLEAN,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: The default value is F. */
    saturday: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID,
      'saturday',
      BuiltinTypes.BOOLEAN,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: The default value is F. */
    enddate: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID,
      'enddate',
      BuiltinTypes.STRING,
      {
      },
    ),
    repeat: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID,
      'repeat',
      enums.generic_repeat_time,
      {
      },
    ), /* Original description: For information about possible values, see generic_repeat_time. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptdeployments_scriptdeployment_recurrence_weekly)

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearlyElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearly')

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearly = new ObjectType({
  elemID: scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearlyElemID,
  annotations: {
  },
  fields: {
    startdate: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearlyElemID,
      'startdate',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    starttime: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearlyElemID,
      'starttime',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    enddate: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearlyElemID,
      'enddate',
      BuiltinTypes.STRING,
      {
      },
    ),
    repeat: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearlyElemID,
      'repeat',
      enums.generic_repeat_time,
      {
      },
    ), /* Original description: For information about possible values, see generic_repeat_time. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearly)

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweekElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweek')

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweek = new ObjectType({
  elemID: scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweekElemID,
  annotations: {
  },
  fields: {
    startdate: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweekElemID,
      'startdate',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    starttime: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweekElemID,
      'starttime',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    orderofweek: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweekElemID,
      'orderofweek',
      enums.generic_order_of_week,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_order_of_week. */
    dayofweek: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweekElemID,
      'dayofweek',
      enums.generic_day_of_week,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_day_of_week. */
    enddate: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweekElemID,
      'enddate',
      BuiltinTypes.STRING,
      {
      },
    ),
    repeat: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweekElemID,
      'repeat',
      enums.generic_repeat_time,
      {
      },
    ), /* Original description: For information about possible values, see generic_repeat_time. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweek)

const scheduledscript_scriptdeployments_scriptdeployment_recurrenceElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptdeployments_scriptdeployment_recurrence')

const scheduledscript_scriptdeployments_scriptdeployment_recurrence = new ObjectType({
  elemID: scheduledscript_scriptdeployments_scriptdeployment_recurrenceElemID,
  annotations: {
  },
  fields: {
    daily: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrenceElemID,
      'daily',
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_daily,
      {
      },
    ),
    everyweekday: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrenceElemID,
      'everyweekday',
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_everyweekday,
      {
      },
    ),
    monthly: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrenceElemID,
      'monthly',
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthly,
      {
      },
    ),
    monthlydayofweek: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrenceElemID,
      'monthlydayofweek',
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweek,
      {
      },
    ),
    single: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrenceElemID,
      'single',
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_single,
      {
      },
    ),
    weekly: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrenceElemID,
      'weekly',
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_weekly,
      {
      },
    ),
    yearly: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrenceElemID,
      'yearly',
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearly,
      {
      },
    ),
    yearlydayofweek: new Field(
      scheduledscript_scriptdeployments_scriptdeployment_recurrenceElemID,
      'yearlydayofweek',
      scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweek,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptdeployments_scriptdeployment_recurrence)

const scheduledscript_scriptdeployments_scriptdeploymentElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptdeployments_scriptdeployment')

const scheduledscript_scriptdeployments_scriptdeployment = new ObjectType({
  elemID: scheduledscript_scriptdeployments_scriptdeploymentElemID,
  annotations: {
  },
  fields: {
    scriptid: new Field(
      scheduledscript_scriptdeployments_scriptdeploymentElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customdeploy’. */
    status: new Field(
      scheduledscript_scriptdeployments_scriptdeploymentElemID,
      'status',
      enums.script_status,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see script_status.   The default value is 'TESTING'. */
    title: new Field(
      scheduledscript_scriptdeployments_scriptdeploymentElemID,
      'title',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    isdeployed: new Field(
      scheduledscript_scriptdeployments_scriptdeploymentElemID,
      'isdeployed',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    loglevel: new Field(
      scheduledscript_scriptdeployments_scriptdeploymentElemID,
      'loglevel',
      enums.script_loglevel,
      {
      },
    ), /* Original description: For information about possible values, see script_loglevel.   The default value is 'DEBUG'. */
    recurrence: new Field(
      scheduledscript_scriptdeployments_scriptdeploymentElemID,
      'recurrence',
      scheduledscript_scriptdeployments_scriptdeployment_recurrence,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptdeployments_scriptdeployment)

const scheduledscript_scriptdeploymentsElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptdeployments')

const scheduledscript_scriptdeployments = new ObjectType({
  elemID: scheduledscript_scriptdeploymentsElemID,
  annotations: {
  },
  fields: {
    scriptdeployment: new Field(
      scheduledscript_scriptdeploymentsElemID,
      'scriptdeployment',
      new ListType(scheduledscript_scriptdeployments_scriptdeployment),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptdeployments)


export const scheduledscript = new ObjectType({
  elemID: scheduledscriptElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'customscript_',
  },
  fields: {
    scriptid: new Field(
      scheduledscriptElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customscript’. */
    name: new Field(
      scheduledscriptElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    ), /* Original description: This field value can be up to 40 characters long. */
    scriptfile: new Field(
      scheduledscriptElemID,
      'scriptfile',
      BuiltinTypes.STRING /* Original type was filereference */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field must reference a .js file. */
    defaultfunction: new Field(
      scheduledscriptElemID,
      'defaultfunction',
      BuiltinTypes.STRING,
      {
      },
    ),
    description: new Field(
      scheduledscriptElemID,
      'description',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    ), /* Original description: This field value can be up to 999 characters long. */
    isinactive: new Field(
      scheduledscriptElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    notifyadmins: new Field(
      scheduledscriptElemID,
      'notifyadmins',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    notifyemails: new Field(
      scheduledscriptElemID,
      'notifyemails',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    ), /* Original description: This field value can be up to 999 characters long. */
    notifygroup: new Field(
      scheduledscriptElemID,
      'notifygroup',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: Note Account-specific values are not supported by SDF. */
    notifyowner: new Field(
      scheduledscriptElemID,
      'notifyowner',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    customplugintypes: new Field(
      scheduledscriptElemID,
      'customplugintypes',
      scheduledscript_customplugintypes,
      {
      },
    ),
    libraries: new Field(
      scheduledscriptElemID,
      'libraries',
      scheduledscript_libraries,
      {
      },
    ),
    scriptcustomfields: new Field(
      scheduledscriptElemID,
      'scriptcustomfields',
      scheduledscript_scriptcustomfields,
      {
      },
    ),
    scriptdeployments: new Field(
      scheduledscriptElemID,
      'scriptdeployments',
      scheduledscript_scriptdeployments,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})
