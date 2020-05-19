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

export const mapreducescriptInnerTypes: ObjectType[] = []

const mapreducescriptElemID = new ElemID(constants.NETSUITE, 'mapreducescript')
const mapreducescript_customplugintypes_plugintypeElemID = new ElemID(constants.NETSUITE, 'mapreducescript_customplugintypes_plugintype')

const mapreducescript_customplugintypes_plugintype = new ObjectType({
  elemID: mapreducescript_customplugintypes_plugintypeElemID,
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
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_customplugintypes_plugintype)

const mapreducescript_customplugintypesElemID = new ElemID(constants.NETSUITE, 'mapreducescript_customplugintypes')

const mapreducescript_customplugintypes = new ObjectType({
  elemID: mapreducescript_customplugintypesElemID,
  annotations: {
  },
  fields: [
    {
      name: 'plugintype',
      type: new ListType(mapreducescript_customplugintypes_plugintype),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_customplugintypes)

const mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter')

const mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter = new ObjectType({
  elemID: mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
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
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter)

const mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfiltersElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters')

const mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters = new ObjectType({
  elemID: mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfiltersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'customfieldfilter',
      type: new ListType(mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters)

const mapreducescript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess')

const mapreducescript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess = new ObjectType({
  elemID: mapreducescript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID,
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
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess)

const mapreducescript_scriptcustomfields_scriptcustomfield_roleaccessesElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptcustomfields_scriptcustomfield_roleaccesses')

const mapreducescript_scriptcustomfields_scriptcustomfield_roleaccesses = new ObjectType({
  elemID: mapreducescript_scriptcustomfields_scriptcustomfield_roleaccessesElemID,
  annotations: {
  },
  fields: [
    {
      name: 'roleaccess',
      type: new ListType(mapreducescript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptcustomfields_scriptcustomfield_roleaccesses)

const mapreducescript_scriptcustomfields_scriptcustomfieldElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptcustomfields_scriptcustomfield')

const mapreducescript_scriptcustomfields_scriptcustomfield = new ObjectType({
  elemID: mapreducescript_scriptcustomfields_scriptcustomfieldElemID,
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
      type: mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters,
      annotations: {
      },
    },
    {
      name: 'roleaccesses',
      type: mapreducescript_scriptcustomfields_scriptcustomfield_roleaccesses,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptcustomfields_scriptcustomfield)

const mapreducescript_scriptcustomfieldsElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptcustomfields')

const mapreducescript_scriptcustomfields = new ObjectType({
  elemID: mapreducescript_scriptcustomfieldsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'scriptcustomfield',
      type: new ListType(mapreducescript_scriptcustomfields_scriptcustomfield),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptcustomfields)

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_dailyElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptdeployments_scriptdeployment_recurrence_daily')

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_daily = new ObjectType({
  elemID: mapreducescript_scriptdeployments_scriptdeployment_recurrence_dailyElemID,
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
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptdeployments_scriptdeployment_recurrence_daily)

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_everyweekdayElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptdeployments_scriptdeployment_recurrence_everyweekday')

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_everyweekday = new ObjectType({
  elemID: mapreducescript_scriptdeployments_scriptdeployment_recurrence_everyweekdayElemID,
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
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptdeployments_scriptdeployment_recurrence_everyweekday)

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlyElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthly')

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthly = new ObjectType({
  elemID: mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlyElemID,
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
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthly)

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweekElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweek')

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweek = new ObjectType({
  elemID: mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweekElemID,
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
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweek)

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_singleElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptdeployments_scriptdeployment_recurrence_single')

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_single = new ObjectType({
  elemID: mapreducescript_scriptdeployments_scriptdeployment_recurrence_singleElemID,
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
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptdeployments_scriptdeployment_recurrence_single)

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptdeployments_scriptdeployment_recurrence_weekly')

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_weekly = new ObjectType({
  elemID: mapreducescript_scriptdeployments_scriptdeployment_recurrence_weeklyElemID,
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
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptdeployments_scriptdeployment_recurrence_weekly)

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearlyElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearly')

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearly = new ObjectType({
  elemID: mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearlyElemID,
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
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearly)

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweekElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweek')

const mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweek = new ObjectType({
  elemID: mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweekElemID,
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
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweek)

const mapreducescript_scriptdeployments_scriptdeployment_recurrenceElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptdeployments_scriptdeployment_recurrence')

const mapreducescript_scriptdeployments_scriptdeployment_recurrence = new ObjectType({
  elemID: mapreducescript_scriptdeployments_scriptdeployment_recurrenceElemID,
  annotations: {
  },
  fields: [
    {
      name: 'daily',
      type: mapreducescript_scriptdeployments_scriptdeployment_recurrence_daily,
      annotations: {
      },
    },
    {
      name: 'everyweekday',
      type: mapreducescript_scriptdeployments_scriptdeployment_recurrence_everyweekday,
      annotations: {
      },
    },
    {
      name: 'monthly',
      type: mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthly,
      annotations: {
      },
    },
    {
      name: 'monthlydayofweek',
      type: mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweek,
      annotations: {
      },
    },
    {
      name: 'single',
      type: mapreducescript_scriptdeployments_scriptdeployment_recurrence_single,
      annotations: {
      },
    },
    {
      name: 'weekly',
      type: mapreducescript_scriptdeployments_scriptdeployment_recurrence_weekly,
      annotations: {
      },
    },
    {
      name: 'yearly',
      type: mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearly,
      annotations: {
      },
    },
    {
      name: 'yearlydayofweek',
      type: mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweek,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptdeployments_scriptdeployment_recurrence)

const mapreducescript_scriptdeployments_scriptdeploymentElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptdeployments_scriptdeployment')

const mapreducescript_scriptdeployments_scriptdeployment = new ObjectType({
  elemID: mapreducescript_scriptdeployments_scriptdeploymentElemID,
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
      name: 'runasrole',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the role custom type.   For information about other possible values, see generic_role. */
    {
      name: 'buffersize',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: The default value is '1'. */
    {
      name: 'concurrencylimit',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: The default value is '1'. */
    {
      name: 'queueallstagesatonce',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'yieldaftermins',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: The default value is '60'. */
    {
      name: 'recurrence',
      type: mapreducescript_scriptdeployments_scriptdeployment_recurrence,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptdeployments_scriptdeployment)

const mapreducescript_scriptdeploymentsElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptdeployments')

const mapreducescript_scriptdeployments = new ObjectType({
  elemID: mapreducescript_scriptdeploymentsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'scriptdeployment',
      type: new ListType(mapreducescript_scriptdeployments_scriptdeployment),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptdeployments)


export const mapreducescript = new ObjectType({
  elemID: mapreducescriptElemID,
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
      type: mapreducescript_customplugintypes,
      annotations: {
      },
    },
    {
      name: 'scriptcustomfields',
      type: mapreducescript_scriptcustomfields,
      annotations: {
      },
    },
    {
      name: 'scriptdeployments',
      type: mapreducescript_scriptdeployments,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})
