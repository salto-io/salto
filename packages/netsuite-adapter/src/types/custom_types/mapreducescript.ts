/*
*                      Copyright 2021 Salto Labs Ltd.
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
/* eslint-disable camelcase */
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
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
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
      refType: new ListType(mapreducescript_customplugintypes_plugintype),
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
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    fldfilterchecked: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fldfiltercomparetype: {
      refType: enums.generic_customfield_fldfiltercomparetype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_fldfiltercomparetype.   The default value is 'EQ'. */
    fldfiltersel: {
      refType: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    fldfilterval: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    fldfilternotnull: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fldfilternull: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fldcomparefield: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
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
      refType: new ListType(mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter),
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
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */
    accesslevel: {
      refType: enums.generic_accesslevel_searchlevel,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
    searchlevel: {
      refType: enums.generic_accesslevel_searchlevel,
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
      refType: new ListType(mapreducescript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess),
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
      refType: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘custscript’. */
    fieldtype: {
      refType: enums.generic_customfield_fieldtype,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_customfield_fieldtype.   The default value is 'TEXT'. */
    label: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 200 }),
      },
    }, /* Original description: This field value can be up to 200 characters long.   This field accepts references to the string custom type. */
    selectrecordtype: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the fieldtype value is equal to any of the following lists or values: SELECT, MULTISELECT.   This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
    applyformatting: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    defaultchecked: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    defaultselection: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    defaultvalue: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    description: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    displaytype: {
      refType: enums.generic_customfield_displaytype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_displaytype.   The default value is 'NORMAL'. */
    dynamicdefault: {
      refType: enums.generic_customfield_dynamicdefault,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_dynamicdefault. */
    help: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the string custom type. */
    linktext: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    minvalue: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    maxvalue: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    storevalue: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    accesslevel: {
      refType: enums.generic_accesslevel_searchlevel,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    checkspelling: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    displayheight: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
      },
    }, /* Original description: This field value must be greater than or equal to 0. */
    displaywidth: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
      },
    }, /* Original description: This field value must be greater than or equal to 0. */
    isformula: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    ismandatory: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    maxlength: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    onparentdelete: {
      refType: enums.generic_customfield_onparentdelete,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_onparentdelete. */
    searchcomparefield: {
      refType: enums.generic_standard_field,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_standard_field. */
    searchdefault: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    searchlevel: {
      refType: enums.generic_accesslevel_searchlevel,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    setting: {
      refType: enums.script_setting,
      annotations: {
      },
    }, /* Original description: For information about possible values, see script_setting. */
    customfieldfilters: {
      refType: mapreducescript_scriptcustomfields_scriptcustomfield_customfieldfilters,
      annotations: {
      },
    },
    roleaccesses: {
      refType: mapreducescript_scriptcustomfields_scriptcustomfield_roleaccesses,
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
      refType: new ListType(mapreducescript_scriptcustomfields_scriptcustomfield),
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
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    starttime: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    everyxdays: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field value must range from 1 through 1000. (inclusive) */
    enddate: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    repeat: {
      refType: enums.generic_repeat_time,
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
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    starttime: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    enddate: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    repeat: {
      refType: enums.generic_repeat_time,
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
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    starttime: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    everyxmonths: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field value must range from 1 through 1000. (inclusive) */
    enddate: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    repeat: {
      refType: enums.generic_repeat_time,
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
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    starttime: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    orderofweek: {
      refType: enums.generic_order_of_week,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_order_of_week. */
    dayofweek: {
      refType: enums.generic_day_of_week,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_day_of_week. */
    everyxmonths: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field value must range from 1 through 1000. (inclusive) */
    enddate: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    repeat: {
      refType: enums.generic_repeat_time,
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
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    starttime: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    repeat: {
      refType: enums.generic_repeat_time,
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
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    starttime: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    everyxweeks: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field value must range from 1 through 1000. (inclusive) */
    sunday: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
    monday: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
    tuesday: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
    wednesday: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
    thursday: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
    friday: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
    saturday: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
    enddate: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    repeat: {
      refType: enums.generic_repeat_time,
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
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    starttime: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    enddate: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    repeat: {
      refType: enums.generic_repeat_time,
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
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    starttime: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    orderofweek: {
      refType: enums.generic_order_of_week,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_order_of_week. */
    dayofweek: {
      refType: enums.generic_day_of_week,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_day_of_week. */
    enddate: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    repeat: {
      refType: enums.generic_repeat_time,
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
      refType: mapreducescript_scriptdeployments_scriptdeployment_recurrence_daily,
      annotations: {
      },
    },
    everyweekday: {
      refType: mapreducescript_scriptdeployments_scriptdeployment_recurrence_everyweekday,
      annotations: {
      },
    },
    monthly: {
      refType: mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthly,
      annotations: {
      },
    },
    monthlydayofweek: {
      refType: mapreducescript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweek,
      annotations: {
      },
    },
    single: {
      refType: mapreducescript_scriptdeployments_scriptdeployment_recurrence_single,
      annotations: {
      },
    },
    weekly: {
      refType: mapreducescript_scriptdeployments_scriptdeployment_recurrence_weekly,
      annotations: {
      },
    },
    yearly: {
      refType: mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearly,
      annotations: {
      },
    },
    yearlydayofweek: {
      refType: mapreducescript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweek,
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
      refType: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customdeploy’. */
    status: {
      refType: enums.script_status,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see script_status.   The default value is 'TESTING'. */
    title: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    isdeployed: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    loglevel: {
      refType: enums.script_loglevel,
      annotations: {
      },
    }, /* Original description: For information about possible values, see script_loglevel.   The default value is 'DEBUG'. */
    runasrole: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the role custom type.   For information about other possible values, see generic_role. */
    buffersize: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: The default value is '1'. */
    concurrencylimit: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: The default value is '1'. */
    queueallstagesatonce: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    yieldaftermins: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: The default value is '60'. */
    recurrence: {
      refType: mapreducescript_scriptdeployments_scriptdeployment_recurrence,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})

mapreducescriptInnerTypes.push(mapreducescript_scriptdeployments_scriptdeployment)

const mapreducescript_scriptdeploymentsElemID = new ElemID(constants.NETSUITE, 'mapreducescript_scriptdeployments')

export const mapreducescript_scriptdeployments = new ObjectType({
  elemID: mapreducescript_scriptdeploymentsElemID,
  annotations: {
  },
  fields: {
    scriptdeployment: {
      refType: new ListType(mapreducescript_scriptdeployments_scriptdeployment),
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
      refType: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^customscript[0-9a-z_]+' }),
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customscript’. */
    name: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 40 }),
      },
    }, /* Original description: This field value can be up to 40 characters long.   This field accepts references to the string custom type. */
    scriptfile: {
      refType: BuiltinTypes.STRING /* Original type was filereference */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field must reference a .js file. */
    description: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 999 }),
      },
    }, /* Original description: This field value can be up to 999 characters long.   This field accepts references to the string custom type. */
    isinactive: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    notifyadmins: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    notifyemails: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 999 }),
      },
    }, /* Original description: This field value can be up to 999 characters long. */
    notifygroup: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: Note Account-specific values are not supported by SDF. */
    notifyowner: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    customplugintypes: {
      refType: mapreducescript_customplugintypes,
      annotations: {
      },
    },
    scriptcustomfields: {
      refType: mapreducescript_scriptcustomfields,
      annotations: {
      },
    },
    scriptdeployments: {
      refType: mapreducescript_scriptdeployments,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, mapreducescriptElemID.name],
})
