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
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, ObjectType, ListType,
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
  fields: [
    {
      name: 'plugintype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the plugintype custom type. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_customplugintypes_plugintype)

const scheduledscript_customplugintypesElemID = new ElemID(constants.NETSUITE, 'scheduledscript_customplugintypes')

const scheduledscript_customplugintypes = new ObjectType({
  elemID: scheduledscript_customplugintypesElemID,
  annotations: {
  },
  fields: [
    {
      name: 'plugintype',
      type: new ListType(scheduledscript_customplugintypes_plugintype),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_customplugintypes)

const scheduledscript_libraries_libraryElemID = new ElemID(constants.NETSUITE, 'scheduledscript_libraries_library')

const scheduledscript_libraries_library = new ObjectType({
  elemID: scheduledscript_libraries_libraryElemID,
  annotations: {
  },
  fields: [
    {
      name: 'scriptfile',
      type: BuiltinTypes.STRING /* Original type was filereference */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field must reference a .js file. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_libraries_library)

const scheduledscript_librariesElemID = new ElemID(constants.NETSUITE, 'scheduledscript_libraries')

const scheduledscript_libraries = new ObjectType({
  elemID: scheduledscript_librariesElemID,
  annotations: {
  },
  fields: [
    {
      name: 'library',
      type: new ListType(scheduledscript_libraries_library),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_libraries)

const scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter')

const scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter = new ObjectType({
  elemID: scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'fldfilter',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'fldfilterchecked',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'fldfiltercomparetype',
      type: enums.generic_customfield_fldfiltercomparetype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_fldfiltercomparetype.   The default value is 'EQ'. */
    {
      name: 'fldfiltersel',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'fldfilterval',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'fldfilternotnull',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'fldfilternull',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'fldcomparefield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter)

const scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfiltersElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters')

const scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters = new ObjectType({
  elemID: scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfiltersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'customfieldfilter',
      type: new ListType(scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters)

const scheduledscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess')

const scheduledscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess = new ObjectType({
  elemID: scheduledscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID,
  annotations: {
  },
  fields: [
    {
      name: 'role',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */
    {
      name: 'accesslevel',
      type: enums.generic_accesslevel_searchlevel,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
    {
      name: 'searchlevel',
      type: enums.generic_accesslevel_searchlevel,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess)

const scheduledscript_scriptcustomfields_scriptcustomfield_roleaccessesElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptcustomfields_scriptcustomfield_roleaccesses')

const scheduledscript_scriptcustomfields_scriptcustomfield_roleaccesses = new ObjectType({
  elemID: scheduledscript_scriptcustomfields_scriptcustomfield_roleaccessesElemID,
  annotations: {
  },
  fields: [
    {
      name: 'roleaccess',
      type: new ListType(scheduledscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptcustomfields_scriptcustomfield_roleaccesses)

const scheduledscript_scriptcustomfields_scriptcustomfieldElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptcustomfields_scriptcustomfield')

const scheduledscript_scriptcustomfields_scriptcustomfield = new ObjectType({
  elemID: scheduledscript_scriptcustomfields_scriptcustomfieldElemID,
  annotations: {
  },
  fields: [
    {
      name: 'scriptid',
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘custscript’. */
    {
      name: 'fieldtype',
      type: enums.generic_customfield_fieldtype,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_customfield_fieldtype.   The default value is 'TEXT'. */
    {
      name: 'label',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    }, /* Original description: This field value can be up to 200 characters long. */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the fieldtype value is equal to any of the following lists or values: SELECT, MULTISELECT.   This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
    {
      name: 'applyformatting',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'defaultchecked',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'defaultselection',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'defaultvalue',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'description',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'displaytype',
      type: enums.generic_customfield_displaytype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_displaytype.   The default value is 'NORMAL'. */
    {
      name: 'dynamicdefault',
      type: enums.generic_customfield_dynamicdefault,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_dynamicdefault. */
    {
      name: 'help',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'linktext',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'minvalue',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'maxvalue',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'storevalue',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'accesslevel',
      type: enums.generic_accesslevel_searchlevel,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    {
      name: 'checkspelling',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'displayheight',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    }, /* Original description: This field value must be greater than or equal to 0. */
    {
      name: 'displaywidth',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    }, /* Original description: This field value must be greater than or equal to 0. */
    {
      name: 'isformula',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'ismandatory',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'maxlength',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'onparentdelete',
      type: enums.generic_customfield_onparentdelete,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_onparentdelete. */
    {
      name: 'searchcomparefield',
      type: enums.generic_standard_field,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_standard_field. */
    {
      name: 'searchdefault',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'searchlevel',
      type: enums.generic_accesslevel_searchlevel,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    {
      name: 'setting',
      type: enums.script_setting,
      annotations: {
      },
    }, /* Original description: For information about possible values, see script_setting. */
    {
      name: 'customfieldfilters',
      type: scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters,
      annotations: {
      },
    },
    {
      name: 'roleaccesses',
      type: scheduledscript_scriptcustomfields_scriptcustomfield_roleaccesses,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptcustomfields_scriptcustomfield)

const scheduledscript_scriptcustomfieldsElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptcustomfields')

const scheduledscript_scriptcustomfields = new ObjectType({
  elemID: scheduledscript_scriptcustomfieldsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'scriptcustomfield',
      type: new ListType(scheduledscript_scriptcustomfields_scriptcustomfield),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptcustomfields)

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_dailyElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptdeployments_scriptdeployment_recurrence_daily')

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_daily = new ObjectType({
  elemID: scheduledscript_scriptdeployments_scriptdeployment_recurrence_dailyElemID,
  annotations: {
  },
  fields: [
    {
      name: 'startdate',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'starttime',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'everyxdays',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'enddate',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'repeat',
      type: enums.generic_repeat_time,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_repeat_time. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptdeployments_scriptdeployment_recurrence_daily)

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_everyweekdayElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptdeployments_scriptdeployment_recurrence_everyweekday')

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_everyweekday = new ObjectType({
  elemID: scheduledscript_scriptdeployments_scriptdeployment_recurrence_everyweekdayElemID,
  annotations: {
  },
  fields: [
    {
      name: 'startdate',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'starttime',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'enddate',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'repeat',
      type: enums.generic_repeat_time,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_repeat_time. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptdeployments_scriptdeployment_recurrence_everyweekday)

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthlyElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthly')

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthly = new ObjectType({
  elemID: scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthlyElemID,
  annotations: {
  },
  fields: [
    {
      name: 'startdate',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'starttime',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'everyxmonths',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'enddate',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'repeat',
      type: enums.generic_repeat_time,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_repeat_time. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthly)

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweekElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweek')

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweek = new ObjectType({
  elemID: scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweekElemID,
  annotations: {
  },
  fields: [
    {
      name: 'startdate',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'starttime',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'orderofweek',
      type: enums.generic_order_of_week,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_order_of_week. */
    {
      name: 'dayofweek',
      type: enums.generic_day_of_week,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_day_of_week. */
    {
      name: 'everyxmonths',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'enddate',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'repeat',
      type: enums.generic_repeat_time,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_repeat_time. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweek)

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_singleElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptdeployments_scriptdeployment_recurrence_single')

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_single = new ObjectType({
  elemID: scheduledscript_scriptdeployments_scriptdeployment_recurrence_singleElemID,
  annotations: {
  },
  fields: [
    {
      name: 'startdate',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'starttime',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'repeat',
      type: enums.generic_repeat_time,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_repeat_time. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptdeployments_scriptdeployment_recurrence_single)

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptdeployments_scriptdeployment_recurrence_weekly')

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_weekly = new ObjectType({
  elemID: scheduledscript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID,
  annotations: {
  },
  fields: [
    {
      name: 'startdate',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'starttime',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'everyxweeks',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'sunday',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
    {
      name: 'monday',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
    {
      name: 'tuesday',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
    {
      name: 'wednesday',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
    {
      name: 'thursday',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
    {
      name: 'friday',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
    {
      name: 'saturday',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
    {
      name: 'enddate',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'repeat',
      type: enums.generic_repeat_time,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_repeat_time. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptdeployments_scriptdeployment_recurrence_weekly)

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearlyElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearly')

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearly = new ObjectType({
  elemID: scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearlyElemID,
  annotations: {
  },
  fields: [
    {
      name: 'startdate',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'starttime',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'enddate',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'repeat',
      type: enums.generic_repeat_time,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_repeat_time. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearly)

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweekElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweek')

const scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweek = new ObjectType({
  elemID: scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweekElemID,
  annotations: {
  },
  fields: [
    {
      name: 'startdate',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'starttime',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'orderofweek',
      type: enums.generic_order_of_week,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_order_of_week. */
    {
      name: 'dayofweek',
      type: enums.generic_day_of_week,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_day_of_week. */
    {
      name: 'enddate',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'repeat',
      type: enums.generic_repeat_time,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_repeat_time. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweek)

const scheduledscript_scriptdeployments_scriptdeployment_recurrenceElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptdeployments_scriptdeployment_recurrence')

const scheduledscript_scriptdeployments_scriptdeployment_recurrence = new ObjectType({
  elemID: scheduledscript_scriptdeployments_scriptdeployment_recurrenceElemID,
  annotations: {
  },
  fields: [
    {
      name: 'daily',
      type: scheduledscript_scriptdeployments_scriptdeployment_recurrence_daily,
      annotations: {
      },
    },
    {
      name: 'everyweekday',
      type: scheduledscript_scriptdeployments_scriptdeployment_recurrence_everyweekday,
      annotations: {
      },
    },
    {
      name: 'monthly',
      type: scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthly,
      annotations: {
      },
    },
    {
      name: 'monthlydayofweek',
      type: scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweek,
      annotations: {
      },
    },
    {
      name: 'single',
      type: scheduledscript_scriptdeployments_scriptdeployment_recurrence_single,
      annotations: {
      },
    },
    {
      name: 'weekly',
      type: scheduledscript_scriptdeployments_scriptdeployment_recurrence_weekly,
      annotations: {
      },
    },
    {
      name: 'yearly',
      type: scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearly,
      annotations: {
      },
    },
    {
      name: 'yearlydayofweek',
      type: scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweek,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptdeployments_scriptdeployment_recurrence)

const scheduledscript_scriptdeployments_scriptdeploymentElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptdeployments_scriptdeployment')

const scheduledscript_scriptdeployments_scriptdeployment = new ObjectType({
  elemID: scheduledscript_scriptdeployments_scriptdeploymentElemID,
  annotations: {
  },
  fields: [
    {
      name: 'scriptid',
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customdeploy’. */
    {
      name: 'status',
      type: enums.script_status,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see script_status.   The default value is 'TESTING'. */
    {
      name: 'title',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'isdeployed',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'loglevel',
      type: enums.script_loglevel,
      annotations: {
      },
    }, /* Original description: For information about possible values, see script_loglevel.   The default value is 'DEBUG'. */
    {
      name: 'recurrence',
      type: scheduledscript_scriptdeployments_scriptdeployment_recurrence,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptdeployments_scriptdeployment)

const scheduledscript_scriptdeploymentsElemID = new ElemID(constants.NETSUITE, 'scheduledscript_scriptdeployments')

const scheduledscript_scriptdeployments = new ObjectType({
  elemID: scheduledscript_scriptdeploymentsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'scriptdeployment',
      type: new ListType(scheduledscript_scriptdeployments_scriptdeployment),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptdeployments)


export const scheduledscript = new ObjectType({
  elemID: scheduledscriptElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'customscript_',
  },
  fields: [
    {
      name: 'scriptid',
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customscript’. */
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    }, /* Original description: This field value can be up to 40 characters long. */
    {
      name: 'scriptfile',
      type: BuiltinTypes.STRING /* Original type was filereference */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field must reference a .js file. */
    {
      name: 'defaultfunction',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'description',
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    }, /* Original description: This field value can be up to 999 characters long. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'notifyadmins',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'notifyemails',
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    }, /* Original description: This field value can be up to 999 characters long. */
    {
      name: 'notifygroup',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: Note Account-specific values are not supported by SDF. */
    {
      name: 'notifyowner',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'customplugintypes',
      type: scheduledscript_customplugintypes,
      annotations: {
      },
    },
    {
      name: 'libraries',
      type: scheduledscript_libraries,
      annotations: {
      },
    },
    {
      name: 'scriptcustomfields',
      type: scheduledscript_scriptcustomfields,
      annotations: {
      },
    },
    {
      name: 'scriptdeployments',
      type: scheduledscript_scriptdeployments,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})
