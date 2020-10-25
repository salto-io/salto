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
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, ObjectType, createRestriction, ListType,
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
    plugintype: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the plugintype custom type. */
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
    plugintype: {
      type: new ListType(mapreducescript_customplugintypes_plugintype),
      annotations: {
      },
    },
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
    fldfilter: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    fldfilterchecked: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fldfiltercomparetype: {
      type: enums.generic_customfield_fldfiltercomparetype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_fldfiltercomparetype.   The default value is 'EQ'. */
    fldfiltersel: {
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    fldfilterval: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    fldfilternotnull: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fldfilternull: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fldcomparefield: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
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
    customfieldfilter: {
      type: new ListType(mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter),
      annotations: {
      },
    },
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
    role: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */
    accesslevel: {
      type: enums.generic_accesslevel_searchlevel,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
    searchlevel: {
      type: enums.generic_accesslevel_searchlevel,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
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
    roleaccess: {
      type: new ListType(mapreducescript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess),
      annotations: {
      },
    },
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
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘custscript’. */
    fieldtype: {
      type: enums.generic_customfield_fieldtype,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_customfield_fieldtype.   The default value is 'TEXT'. */
    label: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    }, /* Original description: This field value can be up to 200 characters long.   This field accepts references to the string custom type. */
    selectrecordtype: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the fieldtype value is equal to any of the following lists or values: SELECT, MULTISELECT.   This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
    applyformatting: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    defaultchecked: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    defaultselection: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    defaultvalue: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    description: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    displaytype: {
      type: enums.generic_customfield_displaytype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_displaytype.   The default value is 'NORMAL'. */
    dynamicdefault: {
      type: enums.generic_customfield_dynamicdefault,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_dynamicdefault. */
    help: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the string custom type. */
    linktext: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    minvalue: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    maxvalue: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    storevalue: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    accesslevel: {
      type: enums.generic_accesslevel_searchlevel,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    checkspelling: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    displayheight: {
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    }, /* Original description: This field value must be greater than or equal to 0. */
    displaywidth: {
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    }, /* Original description: This field value must be greater than or equal to 0. */
    isformula: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    ismandatory: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    maxlength: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    onparentdelete: {
      type: enums.generic_customfield_onparentdelete,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_onparentdelete. */
    searchcomparefield: {
      type: enums.generic_standard_field,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_standard_field. */
    searchdefault: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    searchlevel: {
      type: enums.generic_accesslevel_searchlevel,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    setting: {
      type: enums.script_setting,
      annotations: {
      },
    }, /* Original description: For information about possible values, see script_setting. */
    customfieldfilters: {
      type: mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters,
      annotations: {
      },
    },
    roleaccesses: {
      type: mapreducescript_scriptcustomfields_scriptcustomfield_roleaccesses,
      annotations: {
      },
    },
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
    scriptcustomfield: {
      type: new ListType(mapreducescript_scriptcustomfields_scriptcustomfield),
      annotations: {
      },
    },
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
    startdate: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    starttime: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    everyxdays: {
      type: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field value must range from 1 through 1000. (inclusive) */
    enddate: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    repeat: {
      type: enums.generic_repeat_time,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_repeat_time. */
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
    startdate: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    starttime: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    enddate: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    repeat: {
      type: enums.generic_repeat_time,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_repeat_time. */
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
    startdate: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    starttime: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    everyxmonths: {
      type: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field value must range from 1 through 1000. (inclusive) */
    enddate: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    repeat: {
      type: enums.generic_repeat_time,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_repeat_time. */
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
    startdate: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    starttime: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    orderofweek: {
      type: enums.generic_order_of_week,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_order_of_week. */
    dayofweek: {
      type: enums.generic_day_of_week,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_day_of_week. */
    everyxmonths: {
      type: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field value must range from 1 through 1000. (inclusive) */
    enddate: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    repeat: {
      type: enums.generic_repeat_time,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_repeat_time. */
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
    startdate: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    starttime: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    repeat: {
      type: enums.generic_repeat_time,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_repeat_time. */
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
    startdate: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    starttime: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    everyxweeks: {
      type: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field value must range from 1 through 1000. (inclusive) */
    sunday: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
    monday: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
    tuesday: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
    wednesday: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
    thursday: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
    friday: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
    saturday: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
    enddate: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    repeat: {
      type: enums.generic_repeat_time,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_repeat_time. */
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
    startdate: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    starttime: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    enddate: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    repeat: {
      type: enums.generic_repeat_time,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_repeat_time. */
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
    startdate: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    starttime: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    orderofweek: {
      type: enums.generic_order_of_week,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_order_of_week. */
    dayofweek: {
      type: enums.generic_day_of_week,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_day_of_week. */
    enddate: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    repeat: {
      type: enums.generic_repeat_time,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_repeat_time. */
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
    daily: {
      type: mapreducescript_scriptdeployments_scriptdeployment_recurrence_daily,
      annotations: {
      },
    },
    everyweekday: {
      type: mapreducescript_scriptdeployments_scriptdeployment_recurrence_everyweekday,
      annotations: {
      },
    },
    monthly: {
      type: mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthly,
      annotations: {
      },
    },
    monthlydayofweek: {
      type: mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweek,
      annotations: {
      },
    },
    single: {
      type: mapreducescript_scriptdeployments_scriptdeployment_recurrence_single,
      annotations: {
      },
    },
    weekly: {
      type: mapreducescript_scriptdeployments_scriptdeployment_recurrence_weekly,
      annotations: {
      },
    },
    yearly: {
      type: mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearly,
      annotations: {
      },
    },
    yearlydayofweek: {
      type: mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweek,
      annotations: {
      },
    },
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
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customdeploy’. */
    status: {
      type: enums.script_status,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see script_status.   The default value is 'TESTING'. */
    title: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    isdeployed: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    loglevel: {
      type: enums.script_loglevel,
      annotations: {
      },
    }, /* Original description: For information about possible values, see script_loglevel.   The default value is 'DEBUG'. */
    runasrole: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the role custom type.   For information about other possible values, see generic_role. */
    buffersize: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: The default value is '1'. */
    concurrencylimit: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: The default value is '1'. */
    queueallstagesatonce: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    yieldaftermins: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: The default value is '60'. */
    recurrence: {
      type: mapreducescript_scriptdeployments_scriptdeployment_recurrence,
      annotations: {
      },
    },
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
    scriptdeployment: {
      type: new ListType(mapreducescript_scriptdeployments_scriptdeployment),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptdeployments)


export const mapreducescript = new ObjectType({
  elemID: mapreducescriptElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^customscript[0-9a-z_]+' }),
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customscript’. */
    name: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    }, /* Original description: This field value can be up to 40 characters long. */
    scriptfile: {
      type: BuiltinTypes.STRING /* Original type was filereference */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field must reference a .js file. */
    description: {
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    }, /* Original description: This field value can be up to 999 characters long. */
    isinactive: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    notifyadmins: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    notifyemails: {
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    }, /* Original description: This field value can be up to 999 characters long. */
    notifygroup: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: Note Account-specific values are not supported by SDF. */
    notifyowner: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    customplugintypes: {
      type: mapreducescript_customplugintypes,
      annotations: {
      },
    },
    scriptcustomfields: {
      type: mapreducescript_scriptcustomfields,
      annotations: {
      },
    },
    scriptdeployments: {
      type: mapreducescript_scriptdeployments,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})
