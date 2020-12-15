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
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
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
    plugintype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the plugintype custom type. */
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
    plugintype: {
      refType: createRefToElmWithValue(new ListType(scheduledscript_customplugintypes_plugintype)),
      annotations: {
      },
    },
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
    scriptfile: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was filereference */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field must reference a .js file. */
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
    library: {
      refType: createRefToElmWithValue(new ListType(scheduledscript_libraries_library)),
      annotations: {
      },
    },
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
    fldfilter: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    fldfilterchecked: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fldfiltercomparetype: {
      refType: createRefToElmWithValue(enums.generic_customfield_fldfiltercomparetype),
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_fldfiltercomparetype.   The default value is 'EQ'. */
    fldfiltersel: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    fldfilterval: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    fldfilternotnull: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fldfilternull: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fldcomparefield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
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
    customfieldfilter: {
      refType: createRefToElmWithValue(new ListType(scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter)),
      annotations: {
      },
    },
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
    role: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */
    accesslevel: {
      refType: createRefToElmWithValue(enums.generic_accesslevel_searchlevel),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
    searchlevel: {
      refType: createRefToElmWithValue(enums.generic_accesslevel_searchlevel),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
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
    roleaccess: {
      refType: createRefToElmWithValue(new ListType(scheduledscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess)),
      annotations: {
      },
    },
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
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘custscript’. */
    fieldtype: {
      refType: createRefToElmWithValue(enums.generic_customfield_fieldtype),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_customfield_fieldtype.   The default value is 'TEXT'. */
    label: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    }, /* Original description: This field value can be up to 200 characters long.   This field accepts references to the string custom type. */
    selectrecordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the fieldtype value is equal to any of the following lists or values: SELECT, MULTISELECT.   This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
    applyformatting: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    defaultchecked: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    defaultselection: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    defaultvalue: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    description: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    displaytype: {
      refType: createRefToElmWithValue(enums.generic_customfield_displaytype),
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_displaytype.   The default value is 'NORMAL'. */
    dynamicdefault: {
      refType: createRefToElmWithValue(enums.generic_customfield_dynamicdefault),
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_dynamicdefault. */
    help: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the string custom type. */
    linktext: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    minvalue: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    maxvalue: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    storevalue: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    accesslevel: {
      refType: createRefToElmWithValue(enums.generic_accesslevel_searchlevel),
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    checkspelling: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    displayheight: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
      },
    }, /* Original description: This field value must be greater than or equal to 0. */
    displaywidth: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
      },
    }, /* Original description: This field value must be greater than or equal to 0. */
    isformula: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    ismandatory: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    maxlength: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    onparentdelete: {
      refType: createRefToElmWithValue(enums.generic_customfield_onparentdelete),
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_onparentdelete. */
    searchcomparefield: {
      refType: createRefToElmWithValue(enums.generic_standard_field),
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_standard_field. */
    searchdefault: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    searchlevel: {
      refType: createRefToElmWithValue(enums.generic_accesslevel_searchlevel),
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    setting: {
      refType: createRefToElmWithValue(enums.script_setting),
      annotations: {
      },
    }, /* Original description: For information about possible values, see script_setting. */
    customfieldfilters: {
      refType: createRefToElmWithValue(scheduledscript_scriptcustomfields_scriptcustomfield_customfieldfilters),
      annotations: {
      },
    },
    roleaccesses: {
      refType: createRefToElmWithValue(scheduledscript_scriptcustomfields_scriptcustomfield_roleaccesses),
      annotations: {
      },
    },
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
    scriptcustomfield: {
      refType: createRefToElmWithValue(new ListType(scheduledscript_scriptcustomfields_scriptcustomfield)),
      annotations: {
      },
    },
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
    startdate: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    starttime: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    everyxdays: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field value must range from 1 through 1000. (inclusive) */
    enddate: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    repeat: {
      refType: createRefToElmWithValue(enums.generic_repeat_time),
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_repeat_time. */
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
    startdate: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    starttime: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    enddate: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    repeat: {
      refType: createRefToElmWithValue(enums.generic_repeat_time),
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_repeat_time. */
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
    startdate: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    starttime: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    everyxmonths: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field value must range from 1 through 1000. (inclusive) */
    enddate: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    repeat: {
      refType: createRefToElmWithValue(enums.generic_repeat_time),
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_repeat_time. */
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
    startdate: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    starttime: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    orderofweek: {
      refType: createRefToElmWithValue(enums.generic_order_of_week),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_order_of_week. */
    dayofweek: {
      refType: createRefToElmWithValue(enums.generic_day_of_week),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_day_of_week. */
    everyxmonths: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field value must range from 1 through 1000. (inclusive) */
    enddate: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    repeat: {
      refType: createRefToElmWithValue(enums.generic_repeat_time),
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_repeat_time. */
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
    startdate: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    starttime: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    repeat: {
      refType: createRefToElmWithValue(enums.generic_repeat_time),
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_repeat_time. */
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
    startdate: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    starttime: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    everyxweeks: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field value must range from 1 through 1000. (inclusive) */
    sunday: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
    monday: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
    tuesday: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
    wednesday: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
    thursday: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
    friday: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
    saturday: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
    enddate: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    repeat: {
      refType: createRefToElmWithValue(enums.generic_repeat_time),
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_repeat_time. */
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
    startdate: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    starttime: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    enddate: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    repeat: {
      refType: createRefToElmWithValue(enums.generic_repeat_time),
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_repeat_time. */
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
    startdate: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    starttime: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    orderofweek: {
      refType: createRefToElmWithValue(enums.generic_order_of_week),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_order_of_week. */
    dayofweek: {
      refType: createRefToElmWithValue(enums.generic_day_of_week),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_day_of_week. */
    enddate: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    repeat: {
      refType: createRefToElmWithValue(enums.generic_repeat_time),
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_repeat_time. */
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
    daily: {
      refType: createRefToElmWithValue(scheduledscript_scriptdeployments_scriptdeployment_recurrence_daily),
      annotations: {
      },
    },
    everyweekday: {
      refType: createRefToElmWithValue(scheduledscript_scriptdeployments_scriptdeployment_recurrence_everyweekday),
      annotations: {
      },
    },
    monthly: {
      refType: createRefToElmWithValue(scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthly),
      annotations: {
      },
    },
    monthlydayofweek: {
      refType: createRefToElmWithValue(scheduledscript_scriptdeployments_scriptdeployment_recurrence_monthlydayofweek),
      annotations: {
      },
    },
    single: {
      refType: createRefToElmWithValue(scheduledscript_scriptdeployments_scriptdeployment_recurrence_single),
      annotations: {
      },
    },
    weekly: {
      refType: createRefToElmWithValue(scheduledscript_scriptdeployments_scriptdeployment_recurrence_weekly),
      annotations: {
      },
    },
    yearly: {
      refType: createRefToElmWithValue(scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearly),
      annotations: {
      },
    },
    yearlydayofweek: {
      refType: createRefToElmWithValue(scheduledscript_scriptdeployments_scriptdeployment_recurrence_yearlydayofweek),
      annotations: {
      },
    },
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
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customdeploy’. */
    status: {
      refType: createRefToElmWithValue(enums.script_status),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see script_status.   The default value is 'TESTING'. */
    title: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    isdeployed: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    loglevel: {
      refType: createRefToElmWithValue(enums.script_loglevel),
      annotations: {
      },
    }, /* Original description: For information about possible values, see script_loglevel.   The default value is 'DEBUG'. */
    recurrence: {
      refType: createRefToElmWithValue(scheduledscript_scriptdeployments_scriptdeployment_recurrence),
      annotations: {
      },
    },
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
    scriptdeployment: {
      refType: createRefToElmWithValue(new ListType(scheduledscript_scriptdeployments_scriptdeployment)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})

scheduledscriptInnerTypes.push(scheduledscript_scriptdeployments)


export const scheduledscript = new ObjectType({
  elemID: scheduledscriptElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^customscript[0-9a-z_]+' }),
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customscript’. */
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    }, /* Original description: This field value can be up to 40 characters long. */
    scriptfile: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was filereference */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field must reference a .js file. */
    defaultfunction: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    description: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    }, /* Original description: This field value can be up to 999 characters long. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    notifyadmins: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    notifyemails: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    }, /* Original description: This field value can be up to 999 characters long. */
    notifygroup: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    }, /* Original description: Note Account-specific values are not supported by SDF. */
    notifyowner: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    customplugintypes: {
      refType: createRefToElmWithValue(scheduledscript_customplugintypes),
      annotations: {
      },
    },
    libraries: {
      refType: createRefToElmWithValue(scheduledscript_libraries),
      annotations: {
      },
    },
    scriptcustomfields: {
      refType: createRefToElmWithValue(scheduledscript_scriptcustomfields),
      annotations: {
      },
    },
    scriptdeployments: {
      refType: createRefToElmWithValue(scheduledscript_scriptdeployments),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, scheduledscriptElemID.name],
})
