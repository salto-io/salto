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

export const mapreducescriptInnerTypes: ObjectType[] = []

const mapreducescriptElemID = new ElemID(constants.NETSUITE, 'mapreducescript')
const mapreducescript_customplugintypes_plugintypeElemID = new ElemID(constants.NETSUITE, 'mapreducescript_customplugintypes_plugintype')

const mapreducescript_customplugintypes_plugintype = new ObjectType({
  elemID: mapreducescript_customplugintypes_plugintypeElemID,
  annotations: {
  },
  fields: {
    plugintype: new Field(
      mapreducescript_customplugintypes_plugintypeElemID,
      'plugintype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the plugintype custom type. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_customplugintypes_plugintype)

const mapreducescript_customplugintypesElemID = new ElemID(constants.NETSUITE, 'mapreducescript_customplugintypes')

const mapreducescript_customplugintypes = new ObjectType({
  elemID: mapreducescript_customplugintypesElemID,
  annotations: {
  },
  fields: {
    plugintype: new Field(
      mapreducescript_customplugintypesElemID,
      'plugintype',
      new ListType(mapreducescript_customplugintypes_plugintype),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_customplugintypes)

const mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter')

const mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter = new ObjectType({
  elemID: mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
  annotations: {
  },
  fields: {
    fldfilter: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilter',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    fldfilterchecked: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilterchecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldfiltercomparetype: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfiltercomparetype',
      enums.generic_customfield_fldfiltercomparetype,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_fldfiltercomparetype.   The default value is 'EQ'. */
    fldfiltersel: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfiltersel',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    fldfilterval: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilterval',
      BuiltinTypes.STRING,
      {
      },
    ),
    fldfilternotnull: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilternotnull',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldfilternull: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilternull',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldcomparefield: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldcomparefield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter)

const mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfiltersElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters')

const mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters = new ObjectType({
  elemID: mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfiltersElemID,
  annotations: {
  },
  fields: {
    customfieldfilter: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfiltersElemID,
      'customfieldfilter',
      new ListType(mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters)

const mapreducescript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess')

const mapreducescript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess = new ObjectType({
  elemID: mapreducescript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID,
  annotations: {
  },
  fields: {
    role: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID,
      'role',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */
    accesslevel: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID,
      'accesslevel',
      enums.generic_accesslevel_searchlevel,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
    searchlevel: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID,
      'searchlevel',
      enums.generic_accesslevel_searchlevel,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess)

const mapreducescript_scriptcustomfields_scriptcustomfield_roleaccessesElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptcustomfields_scriptcustomfield_roleaccesses')

const mapreducescript_scriptcustomfields_scriptcustomfield_roleaccesses = new ObjectType({
  elemID: mapreducescript_scriptcustomfields_scriptcustomfield_roleaccessesElemID,
  annotations: {
  },
  fields: {
    roleaccess: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfield_roleaccessesElemID,
      'roleaccess',
      new ListType(mapreducescript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptcustomfields_scriptcustomfield_roleaccesses)

const mapreducescript_scriptcustomfields_scriptcustomfieldElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptcustomfields_scriptcustomfield')

const mapreducescript_scriptcustomfields_scriptcustomfield = new ObjectType({
  elemID: mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
  annotations: {
  },
  fields: {
    scriptid: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘custscript’. */
    fieldtype: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'fieldtype',
      enums.generic_customfield_fieldtype,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_customfield_fieldtype.   The default value is 'TEXT'. */
    label: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    ), /* Original description: This field value can be up to 200 characters long. */
    selectrecordtype: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is mandatory when the fieldtype value is equal to any of the following lists or values: SELECT, MULTISELECT.   This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
    applyformatting: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'applyformatting',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    defaultchecked: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'defaultchecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    defaultselection: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'defaultselection',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    defaultvalue: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'defaultvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    description: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'description',
      BuiltinTypes.STRING,
      {
      },
    ),
    displaytype: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'displaytype',
      enums.generic_customfield_displaytype,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_displaytype.   The default value is 'NORMAL'. */
    dynamicdefault: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'dynamicdefault',
      enums.generic_customfield_dynamicdefault,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_dynamicdefault. */
    help: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'help',
      BuiltinTypes.STRING,
      {
      },
    ),
    linktext: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'linktext',
      BuiltinTypes.STRING,
      {
      },
    ),
    minvalue: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'minvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    maxvalue: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'maxvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    storevalue: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'storevalue',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    accesslevel: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'accesslevel',
      enums.generic_accesslevel_searchlevel,
      {
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    checkspelling: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'checkspelling',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    displayheight: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'displayheight',
      BuiltinTypes.NUMBER,
      {
      },
    ), /* Original description: This field value must be greater than or equal to 0. */
    displaywidth: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'displaywidth',
      BuiltinTypes.NUMBER,
      {
      },
    ), /* Original description: This field value must be greater than or equal to 0. */
    isformula: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'isformula',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    ismandatory: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'ismandatory',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    maxlength: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'maxlength',
      BuiltinTypes.STRING,
      {
      },
    ),
    onparentdelete: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'onparentdelete',
      enums.generic_customfield_onparentdelete,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_onparentdelete. */
    searchcomparefield: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'searchcomparefield',
      enums.generic_standard_field,
      {
      },
    ), /* Original description: For information about possible values, see generic_standard_field. */
    searchdefault: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'searchdefault',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    searchlevel: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'searchlevel',
      enums.generic_accesslevel_searchlevel,
      {
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    setting: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'setting',
      enums.script_setting,
      {
      },
    ), /* Original description: For information about possible values, see script_setting. */
    customfieldfilters: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'customfieldfilters',
      mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters,
      {
      },
    ),
    roleaccesses: new Field(
      mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
      'roleaccesses',
      mapreducescript_scriptcustomfields_scriptcustomfield_roleaccesses,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptcustomfields_scriptcustomfield)

const mapreducescript_scriptcustomfieldsElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptcustomfields')

const mapreducescript_scriptcustomfields = new ObjectType({
  elemID: mapreducescript_scriptcustomfieldsElemID,
  annotations: {
  },
  fields: {
    scriptcustomfield: new Field(
      mapreducescript_scriptcustomfieldsElemID,
      'scriptcustomfield',
      new ListType(mapreducescript_scriptcustomfields_scriptcustomfield),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptcustomfields)

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_dailyElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptdeployments_scriptdeployment_recurrence_daily')

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_daily = new ObjectType({
  elemID: mapreducescript_scriptdeployments_scriptdeployment_recurrence_dailyElemID,
  annotations: {
  },
  fields: {
    startdate: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_dailyElemID,
      'startdate',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    starttime: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_dailyElemID,
      'starttime',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    everyxdays: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_dailyElemID,
      'everyxdays',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    enddate: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_dailyElemID,
      'enddate',
      BuiltinTypes.STRING,
      {
      },
    ),
    repeat: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_dailyElemID,
      'repeat',
      enums.generic_repeat_time,
      {
      },
    ), /* Original description: For information about possible values, see generic_repeat_time. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptdeployments_scriptdeployment_recurrence_daily)

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_everyweekdayElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptdeployments_scriptdeployment_recurrence_everyweekday')

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_everyweekday = new ObjectType({
  elemID: mapreducescript_scriptdeployments_scriptdeployment_recurrence_everyweekdayElemID,
  annotations: {
  },
  fields: {
    startdate: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_everyweekdayElemID,
      'startdate',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    starttime: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_everyweekdayElemID,
      'starttime',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    enddate: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_everyweekdayElemID,
      'enddate',
      BuiltinTypes.STRING,
      {
      },
    ),
    repeat: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_everyweekdayElemID,
      'repeat',
      enums.generic_repeat_time,
      {
      },
    ), /* Original description: For information about possible values, see generic_repeat_time. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptdeployments_scriptdeployment_recurrence_everyweekday)

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlyElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthly')

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthly = new ObjectType({
  elemID: mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlyElemID,
  annotations: {
  },
  fields: {
    startdate: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlyElemID,
      'startdate',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    starttime: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlyElemID,
      'starttime',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    everyxmonths: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlyElemID,
      'everyxmonths',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    enddate: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlyElemID,
      'enddate',
      BuiltinTypes.STRING,
      {
      },
    ),
    repeat: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlyElemID,
      'repeat',
      enums.generic_repeat_time,
      {
      },
    ), /* Original description: For information about possible values, see generic_repeat_time. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthly)

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweekElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweek')

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweek = new ObjectType({
  elemID: mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweekElemID,
  annotations: {
  },
  fields: {
    startdate: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweekElemID,
      'startdate',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    starttime: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweekElemID,
      'starttime',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    orderofweek: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweekElemID,
      'orderofweek',
      enums.generic_order_of_week,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_order_of_week. */
    dayofweek: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweekElemID,
      'dayofweek',
      enums.generic_day_of_week,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_day_of_week. */
    everyxmonths: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweekElemID,
      'everyxmonths',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    enddate: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweekElemID,
      'enddate',
      BuiltinTypes.STRING,
      {
      },
    ),
    repeat: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweekElemID,
      'repeat',
      enums.generic_repeat_time,
      {
      },
    ), /* Original description: For information about possible values, see generic_repeat_time. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweek)

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_singleElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptdeployments_scriptdeployment_recurrence_single')

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_single = new ObjectType({
  elemID: mapreducescript_scriptdeployments_scriptdeployment_recurrence_singleElemID,
  annotations: {
  },
  fields: {
    startdate: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_singleElemID,
      'startdate',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    starttime: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_singleElemID,
      'starttime',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    repeat: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_singleElemID,
      'repeat',
      enums.generic_repeat_time,
      {
      },
    ), /* Original description: For information about possible values, see generic_repeat_time. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptdeployments_scriptdeployment_recurrence_single)

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptdeployments_scriptdeployment_recurrence_weekly')

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_weekly = new ObjectType({
  elemID: mapreducescript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID,
  annotations: {
  },
  fields: {
    startdate: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID,
      'startdate',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    starttime: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID,
      'starttime',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    everyxweeks: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID,
      'everyxweeks',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    sunday: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID,
      'sunday',
      BuiltinTypes.BOOLEAN,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: The default value is F. */
    monday: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID,
      'monday',
      BuiltinTypes.BOOLEAN,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: The default value is F. */
    tuesday: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID,
      'tuesday',
      BuiltinTypes.BOOLEAN,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: The default value is F. */
    wednesday: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID,
      'wednesday',
      BuiltinTypes.BOOLEAN,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: The default value is F. */
    thursday: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID,
      'thursday',
      BuiltinTypes.BOOLEAN,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: The default value is F. */
    friday: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID,
      'friday',
      BuiltinTypes.BOOLEAN,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: The default value is F. */
    saturday: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID,
      'saturday',
      BuiltinTypes.BOOLEAN,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: The default value is F. */
    enddate: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID,
      'enddate',
      BuiltinTypes.STRING,
      {
      },
    ),
    repeat: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID,
      'repeat',
      enums.generic_repeat_time,
      {
      },
    ), /* Original description: For information about possible values, see generic_repeat_time. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptdeployments_scriptdeployment_recurrence_weekly)

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearlyElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearly')

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearly = new ObjectType({
  elemID: mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearlyElemID,
  annotations: {
  },
  fields: {
    startdate: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearlyElemID,
      'startdate',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    starttime: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearlyElemID,
      'starttime',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    enddate: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearlyElemID,
      'enddate',
      BuiltinTypes.STRING,
      {
      },
    ),
    repeat: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearlyElemID,
      'repeat',
      enums.generic_repeat_time,
      {
      },
    ), /* Original description: For information about possible values, see generic_repeat_time. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearly)

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweekElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweek')

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweek = new ObjectType({
  elemID: mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweekElemID,
  annotations: {
  },
  fields: {
    startdate: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweekElemID,
      'startdate',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    starttime: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweekElemID,
      'starttime',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    orderofweek: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweekElemID,
      'orderofweek',
      enums.generic_order_of_week,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_order_of_week. */
    dayofweek: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweekElemID,
      'dayofweek',
      enums.generic_day_of_week,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_day_of_week. */
    enddate: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweekElemID,
      'enddate',
      BuiltinTypes.STRING,
      {
      },
    ),
    repeat: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweekElemID,
      'repeat',
      enums.generic_repeat_time,
      {
      },
    ), /* Original description: For information about possible values, see generic_repeat_time. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweek)

const mapreducescript_scriptdeployments_scriptdeployment_recurrenceElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptdeployments_scriptdeployment_recurrence')

const mapreducescript_scriptdeployments_scriptdeployment_recurrence = new ObjectType({
  elemID: mapreducescript_scriptdeployments_scriptdeployment_recurrenceElemID,
  annotations: {
  },
  fields: {
    daily: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrenceElemID,
      'daily',
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_daily,
      {
      },
    ),
    everyweekday: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrenceElemID,
      'everyweekday',
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_everyweekday,
      {
      },
    ),
    monthly: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrenceElemID,
      'monthly',
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthly,
      {
      },
    ),
    monthlydayofweek: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrenceElemID,
      'monthlydayofweek',
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweek,
      {
      },
    ),
    single: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrenceElemID,
      'single',
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_single,
      {
      },
    ),
    weekly: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrenceElemID,
      'weekly',
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_weekly,
      {
      },
    ),
    yearly: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrenceElemID,
      'yearly',
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearly,
      {
      },
    ),
    yearlydayofweek: new Field(
      mapreducescript_scriptdeployments_scriptdeployment_recurrenceElemID,
      'yearlydayofweek',
      mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweek,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptdeployments_scriptdeployment_recurrence)

const mapreducescript_scriptdeployments_scriptdeploymentElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptdeployments_scriptdeployment')

const mapreducescript_scriptdeployments_scriptdeployment = new ObjectType({
  elemID: mapreducescript_scriptdeployments_scriptdeploymentElemID,
  annotations: {
  },
  fields: {
    scriptid: new Field(
      mapreducescript_scriptdeployments_scriptdeploymentElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customdeploy’. */
    status: new Field(
      mapreducescript_scriptdeployments_scriptdeploymentElemID,
      'status',
      enums.script_status,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see script_status.   The default value is 'TESTING'. */
    title: new Field(
      mapreducescript_scriptdeployments_scriptdeploymentElemID,
      'title',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    isdeployed: new Field(
      mapreducescript_scriptdeployments_scriptdeploymentElemID,
      'isdeployed',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    loglevel: new Field(
      mapreducescript_scriptdeployments_scriptdeploymentElemID,
      'loglevel',
      enums.script_loglevel,
      {
      },
    ), /* Original description: For information about possible values, see script_loglevel.   The default value is 'DEBUG'. */
    runasrole: new Field(
      mapreducescript_scriptdeployments_scriptdeploymentElemID,
      'runasrole',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the role custom type.   For information about other possible values, see generic_role. */
    buffersize: new Field(
      mapreducescript_scriptdeployments_scriptdeploymentElemID,
      'buffersize',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: The default value is '1'. */
    concurrencylimit: new Field(
      mapreducescript_scriptdeployments_scriptdeploymentElemID,
      'concurrencylimit',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: The default value is '1'. */
    queueallstagesatonce: new Field(
      mapreducescript_scriptdeployments_scriptdeploymentElemID,
      'queueallstagesatonce',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    yieldaftermins: new Field(
      mapreducescript_scriptdeployments_scriptdeploymentElemID,
      'yieldaftermins',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: The default value is '60'. */
    recurrence: new Field(
      mapreducescript_scriptdeployments_scriptdeploymentElemID,
      'recurrence',
      mapreducescript_scriptdeployments_scriptdeployment_recurrence,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptdeployments_scriptdeployment)

const mapreducescript_scriptdeploymentsElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptdeployments')

const mapreducescript_scriptdeployments = new ObjectType({
  elemID: mapreducescript_scriptdeploymentsElemID,
  annotations: {
  },
  fields: {
    scriptdeployment: new Field(
      mapreducescript_scriptdeploymentsElemID,
      'scriptdeployment',
      new ListType(mapreducescript_scriptdeployments_scriptdeployment),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptdeployments)


export const mapreducescript = new ObjectType({
  elemID: mapreducescriptElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'customscript_',
  },
  fields: {
    scriptid: new Field(
      mapreducescriptElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customscript’. */
    name: new Field(
      mapreducescriptElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    ), /* Original description: This field value can be up to 40 characters long. */
    scriptfile: new Field(
      mapreducescriptElemID,
      'scriptfile',
      BuiltinTypes.STRING /* Original type was filereference */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field must reference a .js file. */
    description: new Field(
      mapreducescriptElemID,
      'description',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    ), /* Original description: This field value can be up to 999 characters long. */
    isinactive: new Field(
      mapreducescriptElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    notifyadmins: new Field(
      mapreducescriptElemID,
      'notifyadmins',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    notifyemails: new Field(
      mapreducescriptElemID,
      'notifyemails',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    ), /* Original description: This field value can be up to 999 characters long. */
    notifygroup: new Field(
      mapreducescriptElemID,
      'notifygroup',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: Note Account-specific values are not supported by SDF. */
    notifyowner: new Field(
      mapreducescriptElemID,
      'notifyowner',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    customplugintypes: new Field(
      mapreducescriptElemID,
      'customplugintypes',
      mapreducescript_customplugintypes,
      {
      },
    ),
    scriptcustomfields: new Field(
      mapreducescriptElemID,
      'scriptcustomfields',
      mapreducescript_scriptcustomfields,
      {
      },
    ),
    scriptdeployments: new Field(
      mapreducescriptElemID,
      'scriptdeployments',
      mapreducescript_scriptdeployments,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})
