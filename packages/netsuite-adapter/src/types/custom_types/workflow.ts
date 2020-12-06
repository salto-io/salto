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
import { fieldTypes } from '../field_types'

export const workflowInnerTypes: ObjectType[] = []

const workflowElemID = new ElemID(constants.NETSUITE, 'workflow')
const workflow_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_initcondition_parameters_parameter')

const workflow_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: {
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    value: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_initcondition_parameters_parameter)

const workflow_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_initcondition_parameters')

const workflow_initcondition_parameters = new ObjectType({
  elemID: workflow_initcondition_parametersElemID,
  annotations: {
  },
  fields: {
    parameter: {
      refType: createRefToElmWithValue(new ListType(workflow_initcondition_parameters_parameter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_initcondition_parameters)

const workflow_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_initcondition')

const workflow_initcondition = new ObjectType({
  elemID: workflow_initconditionElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(enums.workflow_condition_type),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    formula: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
      },
    },
    parameters: {
      refType: createRefToElmWithValue(workflow_initcondition_parameters),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_initcondition)

const workflow_recurrence_dailyElemID = new ElemID(constants.NETSUITE, 'workflow_recurrence_daily')

const workflow_recurrence_daily = new ObjectType({
  elemID: workflow_recurrence_dailyElemID,
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
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_recurrence_daily)

const workflow_recurrence_every30minutesElemID = new ElemID(constants.NETSUITE, 'workflow_recurrence_every30minutes')

const workflow_recurrence_every30minutes = new ObjectType({
  elemID: workflow_recurrence_every30minutesElemID,
  annotations: {
  },
  fields: {
    startdate: {
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
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_recurrence_every30minutes)

const workflow_recurrence_everyweekdayElemID = new ElemID(constants.NETSUITE, 'workflow_recurrence_everyweekday')

const workflow_recurrence_everyweekday = new ObjectType({
  elemID: workflow_recurrence_everyweekdayElemID,
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
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_recurrence_everyweekday)

const workflow_recurrence_monthlyElemID = new ElemID(constants.NETSUITE, 'workflow_recurrence_monthly')

const workflow_recurrence_monthly = new ObjectType({
  elemID: workflow_recurrence_monthlyElemID,
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
    dayofmonth: {
      refType: createRefToElmWithValue(enums.generic_day_of_month),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_day_of_month. */
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
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_recurrence_monthly)

const workflow_recurrence_monthlydayofweekElemID = new ElemID(constants.NETSUITE, 'workflow_recurrence_monthlydayofweek')

const workflow_recurrence_monthlydayofweek = new ObjectType({
  elemID: workflow_recurrence_monthlydayofweekElemID,
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
      refType: createRefToElmWithValue(enums.workflow_order_of_week),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_order_of_week. */
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
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_recurrence_monthlydayofweek)

const workflow_recurrence_singleElemID = new ElemID(constants.NETSUITE, 'workflow_recurrence_single')

const workflow_recurrence_single = new ObjectType({
  elemID: workflow_recurrence_singleElemID,
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
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_recurrence_single)

const workflow_recurrence_weeklyElemID = new ElemID(constants.NETSUITE, 'workflow_recurrence_weekly')

const workflow_recurrence_weekly = new ObjectType({
  elemID: workflow_recurrence_weeklyElemID,
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
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_recurrence_weekly)

const workflow_recurrence_yearlyElemID = new ElemID(constants.NETSUITE, 'workflow_recurrence_yearly')

const workflow_recurrence_yearly = new ObjectType({
  elemID: workflow_recurrence_yearlyElemID,
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
    month: {
      refType: createRefToElmWithValue(enums.generic_month),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_month. */
    dayofmonth: {
      refType: createRefToElmWithValue(enums.generic_day_of_month),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_day_of_month. */
    enddate: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_recurrence_yearly)

const workflow_recurrence_yearlydayofweekElemID = new ElemID(constants.NETSUITE, 'workflow_recurrence_yearlydayofweek')

const workflow_recurrence_yearlydayofweek = new ObjectType({
  elemID: workflow_recurrence_yearlydayofweekElemID,
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
    month: {
      refType: createRefToElmWithValue(enums.generic_month),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_month. */
    enddate: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_recurrence_yearlydayofweek)

const workflow_recurrenceElemID = new ElemID(constants.NETSUITE, 'workflow_recurrence')

const workflow_recurrence = new ObjectType({
  elemID: workflow_recurrenceElemID,
  annotations: {
  },
  fields: {
    daily: {
      refType: createRefToElmWithValue(workflow_recurrence_daily),
      annotations: {
      },
    },
    every30minutes: {
      refType: createRefToElmWithValue(workflow_recurrence_every30minutes),
      annotations: {
      },
    },
    everyweekday: {
      refType: createRefToElmWithValue(workflow_recurrence_everyweekday),
      annotations: {
      },
    },
    monthly: {
      refType: createRefToElmWithValue(workflow_recurrence_monthly),
      annotations: {
      },
    },
    monthlydayofweek: {
      refType: createRefToElmWithValue(workflow_recurrence_monthlydayofweek),
      annotations: {
      },
    },
    single: {
      refType: createRefToElmWithValue(workflow_recurrence_single),
      annotations: {
      },
    },
    weekly: {
      refType: createRefToElmWithValue(workflow_recurrence_weekly),
      annotations: {
      },
    },
    yearly: {
      refType: createRefToElmWithValue(workflow_recurrence_yearly),
      annotations: {
      },
    },
    yearlydayofweek: {
      refType: createRefToElmWithValue(workflow_recurrence_yearlydayofweek),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_recurrence)

const workflow_workflowcustomfields_workflowcustomfield_customfieldfilters_customfieldfilterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowcustomfields_workflowcustomfield_customfieldfilters_customfieldfilter')

const workflow_workflowcustomfields_workflowcustomfield_customfieldfilters_customfieldfilter = new ObjectType({
  elemID: workflow_workflowcustomfields_workflowcustomfield_customfieldfilters_customfieldfilterElemID,
  annotations: {
  },
  fields: {
    fldfilter: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
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
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowcustomfields_workflowcustomfield_customfieldfilters_customfieldfilter)

const workflow_workflowcustomfields_workflowcustomfield_customfieldfiltersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowcustomfields_workflowcustomfield_customfieldfilters')

const workflow_workflowcustomfields_workflowcustomfield_customfieldfilters = new ObjectType({
  elemID: workflow_workflowcustomfields_workflowcustomfield_customfieldfiltersElemID,
  annotations: {
  },
  fields: {
    customfieldfilter: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowcustomfields_workflowcustomfield_customfieldfilters_customfieldfilter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowcustomfields_workflowcustomfield_customfieldfilters)

const workflow_workflowcustomfields_workflowcustomfield_roleaccesses_roleaccessElemID = new ElemID(constants.NETSUITE, 'workflow_workflowcustomfields_workflowcustomfield_roleaccesses_roleaccess')

const workflow_workflowcustomfields_workflowcustomfield_roleaccesses_roleaccess = new ObjectType({
  elemID: workflow_workflowcustomfields_workflowcustomfield_roleaccesses_roleaccessElemID,
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
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowcustomfields_workflowcustomfield_roleaccesses_roleaccess)

const workflow_workflowcustomfields_workflowcustomfield_roleaccessesElemID = new ElemID(constants.NETSUITE, 'workflow_workflowcustomfields_workflowcustomfield_roleaccesses')

const workflow_workflowcustomfields_workflowcustomfield_roleaccesses = new ObjectType({
  elemID: workflow_workflowcustomfields_workflowcustomfield_roleaccessesElemID,
  annotations: {
  },
  fields: {
    roleaccess: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowcustomfields_workflowcustomfield_roleaccesses_roleaccess)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowcustomfields_workflowcustomfield_roleaccesses)

const workflow_workflowcustomfields_workflowcustomfieldElemID = new ElemID(constants.NETSUITE, 'workflow_workflowcustomfields_workflowcustomfield')

const workflow_workflowcustomfields_workflowcustomfield = new ObjectType({
  elemID: workflow_workflowcustomfields_workflowcustomfieldElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 42 characters long.   The default value is ‘custworkflow’. */
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
    customfieldfilters: {
      refType: createRefToElmWithValue(workflow_workflowcustomfields_workflowcustomfield_customfieldfilters),
      annotations: {
      },
    },
    roleaccesses: {
      refType: createRefToElmWithValue(workflow_workflowcustomfields_workflowcustomfield_roleaccesses),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowcustomfields_workflowcustomfield)

const workflow_workflowcustomfieldsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowcustomfields')

const workflow_workflowcustomfields = new ObjectType({
  elemID: workflow_workflowcustomfieldsElemID,
  annotations: {
  },
  fields: {
    workflowcustomfield: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowcustomfields_workflowcustomfield)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowcustomfields)

const workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: {
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    value: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: {
    parameter: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parameters_parameter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initconditionElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(enums.workflow_condition_type),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    formula: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
      },
    },
    parameters: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parameters),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_addbuttonactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_addbuttonaction')

const workflow_workflowstates_workflowstate_workflowactions_addbuttonaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_addbuttonactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    label: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the string custom type. */
    eventtypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    saverecordfirst: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    checkconditionbeforeexecution: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    initcondition: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_addbuttonaction)

const workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: {
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    value: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: {
    parameter: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parameters_parameter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_confirmaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_confirmaction_initconditionElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(enums.workflow_condition_type),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    formula: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
      },
    },
    parameters: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parameters),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_confirmactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_confirmaction')

const workflow_workflowstates_workflowstate_workflowactions_confirmaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_confirmactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    messagetext: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the string custom type. */
    clienttriggerfieldssublist: {
      refType: createRefToElmWithValue(enums.workflow_sublists),
      annotations: {
      },
    }, /* Original description: This field is available when the clienttriggerfieldsissublistfield value is equal to T.   This field is mandatory when the clienttriggerfieldsissublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    clienttriggerfieldsissublistfield: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: This field is available when the triggertype value is present in workflowaction_triggertype_client.   The default value is F. */
    clienttriggerfields: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    contexttypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    initcondition: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_confirmaction)

const workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings_fieldsettingElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings_fieldsetting')

const workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings_fieldsetting = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings_fieldsettingElemID,
  annotations: {
  },
  fields: {
    targetfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuetext: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    valuechecked: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    },
    valuedate: {
      refType: createRefToElmWithValue(enums.workflowaction_valuedate),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    valueselect: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuejoinfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings_fieldsetting)

const workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettingsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings')

const workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettingsElemID,
  annotations: {
  },
  fields: {
    fieldsetting: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings_fieldsetting)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings)

const workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: {
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    value: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: {
    parameter: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parameters_parameter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_createlineaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_createlineaction_initconditionElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(enums.workflow_condition_type),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    formula: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
      },
    },
    parameters: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parameters),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_createlineactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_createlineaction')

const workflow_workflowstates_workflowstate_workflowactions_createlineaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_createlineactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    sublist: {
      refType: createRefToElmWithValue(enums.workflow_sublists),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_sublists.   The default value is 'item'. */
    eventtypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    position: {
      refType: createRefToElmWithValue(enums.workflowaction_createline_position),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_createline_position.   The default value is 'AFTERLASTLINE'. */
    fieldsettings: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings),
      annotations: {
      },
    },
    initcondition: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_createlineaction)

const workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings_fieldsettingElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings_fieldsetting')

const workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings_fieldsetting = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings_fieldsettingElemID,
  annotations: {
  },
  fields: {
    targetfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuetext: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    valuechecked: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    },
    valuedate: {
      refType: createRefToElmWithValue(enums.workflowaction_valuedate),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    valueselect: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuejoinfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings_fieldsetting)

const workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettingsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings')

const workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettingsElemID,
  annotations: {
  },
  fields: {
    fieldsetting: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings_fieldsetting)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings)

const workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: {
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    value: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: {
    parameter: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parameters_parameter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initconditionElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(enums.workflow_condition_type),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    formula: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
      },
    },
    parameters: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parameters),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_createrecordactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_createrecordaction')

const workflow_workflowstates_workflowstate_workflowactions_createrecordaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_createrecordactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    recordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   customtransactiontype   customrecordtype   For information about other possible values, see generic_standard_recordtype. */
    eventtypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    scheduledelay: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
      },
    },
    scheduletimeofday: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    schedulerecurrence: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
      },
    },
    scheduletimeunit: {
      refType: createRefToElmWithValue(enums.workflow_timeunit),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflow_timeunit. */
    schedulemode: {
      refType: createRefToElmWithValue(enums.workflowaction_radioschedulemode),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    resultfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    fieldsettings: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings),
      annotations: {
      },
    },
    initcondition: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_createrecordaction)

const workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: {
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    value: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: {
    parameter: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parameters_parameter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_customaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_customaction_initconditionElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(enums.workflow_condition_type),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    formula: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
      },
    },
    parameters: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parameters),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings_parametersettingElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings_parametersetting')

const workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings_parametersetting = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings_parametersettingElemID,
  annotations: {
  },
  fields: {
    targetparameter: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuetext: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    valuechecked: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    },
    valuedate: {
      refType: createRefToElmWithValue(enums.workflowaction_valuedate),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    valueselect: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuejoinfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings_parametersetting)

const workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettingsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings')

const workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettingsElemID,
  annotations: {
  },
  fields: {
    parametersetting: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings_parametersetting)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings)

const workflow_workflowstates_workflowstate_workflowactions_customactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_customaction')

const workflow_workflowstates_workflowstate_workflowactions_customaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_customactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    scripttype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the workflowactionscript custom type. */
    eventtypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    scheduledelay: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
      },
    },
    scheduletimeofday: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    schedulerecurrence: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
      },
    },
    scheduletimeunit: {
      refType: createRefToElmWithValue(enums.workflow_timeunit),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflow_timeunit. */
    schedulemode: {
      refType: createRefToElmWithValue(enums.workflowaction_radioschedulemode),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    resultfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    initcondition: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition),
      annotations: {
      },
    },
    parametersettings: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_customaction)

const workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: {
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    value: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: {
    parameter: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parameters_parameter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initconditionElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(enums.workflow_condition_type),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    formula: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
      },
    },
    parameters: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parameters),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_gotopageactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_gotopageaction')

const workflow_workflowstates_workflowstate_workflowactions_gotopageaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_gotopageactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    targetpage: {
      refType: createRefToElmWithValue(enums.generic_standard_task),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the targetpageobject value is not defined.   For information about possible values, see generic_standard_task. */
    targetpageobject: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the targetpage value is not defined.   This field accepts references to the following custom types:   workflowactionscript   usereventscript   scriptdeployment   suitelet   scheduledscript   savedsearch   restlet   portlet   massupdatescript   mapreducescript   customrecordtype   clientscript   centertab   bundleinstallationscript */
    targetpagetasktype: {
      refType: createRefToElmWithValue(enums.centercategory_tasktype),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the targetpageobject value is defined.   For information about possible values, see centercategory_tasktype. */
    eventtypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    initcondition: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_gotopageaction)

const workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings_fieldsettingElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings_fieldsetting')

const workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings_fieldsetting = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings_fieldsettingElemID,
  annotations: {
  },
  fields: {
    targetfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuetext: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    valuechecked: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    },
    valuedate: {
      refType: createRefToElmWithValue(enums.workflowaction_valuedate),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    valueselect: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuejoinfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings_fieldsetting)

const workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettingsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings')

const workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettingsElemID,
  annotations: {
  },
  fields: {
    fieldsetting: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings_fieldsetting)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings)

const workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: {
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    value: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: {
    parameter: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parameters_parameter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initconditionElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(enums.workflow_condition_type),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    formula: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
      },
    },
    parameters: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parameters),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_gotorecordactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_gotorecordaction')

const workflow_workflowstates_workflowstate_workflowactions_gotorecordaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_gotorecordactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    recordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   customtransactiontype   customrecordtype   For information about other possible values, see generic_standard_recordtype. */
    eventtypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    recordidfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    recordidjoinfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    ineditmode: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fieldsettings: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings),
      annotations: {
      },
    },
    initcondition: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_gotorecordaction)

const workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: {
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    value: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: {
    parameter: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parameters_parameter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initconditionElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(enums.workflow_condition_type),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    formula: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
      },
    },
    parameters: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parameters),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings_workflowfieldsettingElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings_workflowfieldsetting')

const workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings_workflowfieldsetting = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings_workflowfieldsettingElemID,
  annotations: {
  },
  fields: {
    targetworkflowfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuetext: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    valuechecked: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    },
    valuedate: {
      refType: createRefToElmWithValue(enums.workflowaction_valuedate),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    valueselect: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuejoinfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings_workflowfieldsetting)

const workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettingsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings')

const workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettingsElemID,
  annotations: {
  },
  fields: {
    workflowfieldsetting: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings_workflowfieldsetting)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings)

const workflow_workflowstates_workflowstate_workflowactions_initiateworkflowactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction')

const workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_initiateworkflowactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    initiatedworkflow: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the workflow custom type. */
    eventtypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    scheduledelay: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
      },
    },
    scheduletimeofday: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    schedulerecurrence: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
      },
    },
    scheduletimeunit: {
      refType: createRefToElmWithValue(enums.workflow_timeunit),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflow_timeunit. */
    schedulemode: {
      refType: createRefToElmWithValue(enums.workflowaction_radioschedulemode),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    initcondition: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition),
      annotations: {
      },
    },
    workflowfieldsettings: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction)

const workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: {
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    value: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: {
    parameter: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parameters_parameter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initconditionElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(enums.workflow_condition_type),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    formula: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
      },
    },
    parameters: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parameters),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_lockrecordactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_lockrecordaction')

const workflow_workflowstates_workflowstate_workflowactions_lockrecordaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_lockrecordactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    eventtypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    initcondition: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_lockrecordaction)

const workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: {
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    value: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: {
    parameter: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parameters_parameter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initconditionElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(enums.workflow_condition_type),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    formula: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
      },
    },
    parameters: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parameters),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_removebuttonactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_removebuttonaction')

const workflow_workflowstates_workflowstate_workflowactions_removebuttonaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_removebuttonactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    buttonid: {
      refType: createRefToElmWithValue(enums.workflowaction_buttonid),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflowaction_buttonid. */
    eventtypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    initcondition: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_removebuttonaction)

const workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: {
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    value: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parametersElemID,
  annotations: {
  },
  fields: {
    parameter: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parameters_parameter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initconditionElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(enums.workflow_condition_type),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    formula: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
      },
    },
    parameters: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parameters),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_returnusererroractionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_returnusererroraction')

const workflow_workflowstates_workflowstate_workflowactions_returnusererroraction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_returnusererroractionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    errortext: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the string custom type. */
    clienttriggerfieldssublist: {
      refType: createRefToElmWithValue(enums.workflow_sublists),
      annotations: {
      },
    }, /* Original description: This field is available when the clienttriggerfieldsissublistfield value is equal to T.   This field is mandatory when the clienttriggerfieldsissublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    clienttriggerfieldsissublistfield: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: This field is available when the triggertype value is present in workflowaction_triggertype_client.   The default value is F. */
    clienttriggerfields: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    eventtypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    initcondition: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_returnusererroraction)

const workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: {
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    value: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: {
    parameter: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parameters_parameter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initconditionElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(enums.workflow_condition_type),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    formula: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
      },
    },
    parameters: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parameters),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction')

const workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    recipientfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    eventtypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    scheduledelay: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
      },
    },
    scheduletimeofday: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    schedulerecurrence: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
      },
    },
    scheduletimeunit: {
      refType: createRefToElmWithValue(enums.workflow_timeunit),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflow_timeunit. */
    schedulemode: {
      refType: createRefToElmWithValue(enums.workflowaction_radioschedulemode),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    resultfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    recipientiscurrentrecord: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    recipientjoinfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    campaignevent: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    }, /* Original description: Note Account-specific values are not supported by SDF. */
    initcondition: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction)

const workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: {
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    value: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: {
    parameter: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parameters_parameter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initconditionElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(enums.workflow_condition_type),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    formula: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
      },
    },
    parameters: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parameters),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_sendemailaction')

const workflow_workflowstates_workflowstate_workflowactions_sendemailaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    sendertype: {
      refType: createRefToElmWithValue(enums.workflowaction_sendertype),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflowaction_sendertype. */
    recipienttype: {
      refType: createRefToElmWithValue(enums.workflowaction_recipienttype),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflowaction_recipienttype. */
    sender: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the sendertype value is equal to SPECIFIC.   Note Account-specific values are not supported by SDF. */
    senderfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the sendertype value is equal to FIELD.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    recipient: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the recipienttype value is equal to SPECIFIC.   Note Account-specific values are not supported by SDF. */
    recipientemail: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the recipienttype value is equal to ADDRESS. */
    recipientfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the recipienttype value is equal to FIELD.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    template: {
      refType: createRefToElmWithValue(enums.generic_standard_template),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the usetemplate value is equal to T.   For information about possible values, see generic_standard_template. */
    eventtypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    scheduledelay: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
      },
    },
    scheduletimeofday: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    schedulerecurrence: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
      },
    },
    scheduletimeunit: {
      refType: createRefToElmWithValue(enums.workflow_timeunit),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflow_timeunit. */
    schedulemode: {
      refType: createRefToElmWithValue(enums.workflowaction_radioschedulemode),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    senderjoinfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    recipientjoinfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    recipientccemail: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    recipientbccemail: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    usetemplate: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    subject: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    body: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    includerecordlink: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    attachmenttype: {
      refType: createRefToElmWithValue(enums.workflowaction_attachmenttype),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_attachmenttype. */
    attachmentfile: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was filereference */),
      annotations: {
      },
    },
    attachmentjoinfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    attachmentfield: {
      refType: createRefToElmWithValue(enums.generic_standard_field),
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_standard_field. */
    includetransaction: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    includeformat: {
      refType: createRefToElmWithValue(enums.workflowaction_transtatementtype),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_transtatementtype. */
    initcondition: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_sendemailaction)

const workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: {
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    value: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: {
    parameter: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parameters_parameter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initconditionElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(enums.workflow_condition_type),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    formula: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
      },
    },
    parameters: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parameters),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction')

const workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    field: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    clienttriggerfieldssublist: {
      refType: createRefToElmWithValue(enums.workflow_sublists),
      annotations: {
      },
    }, /* Original description: This field is available when the clienttriggerfieldsissublistfield value is equal to T.   This field is mandatory when the clienttriggerfieldsissublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    sublist: {
      refType: createRefToElmWithValue(enums.workflow_sublists),
      annotations: {
      },
    }, /* Original description: This field is available when the issublistfield value is equal to T.   This field is mandatory when the issublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    clienttriggerfieldsissublistfield: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: This field is available when the triggertype value is present in workflowaction_triggertype_client.   The default value is F. */
    clienttriggerfields: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    eventtypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    issublistfield: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    displaylabel: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the string custom type. */
    initcondition: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction)

const workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: {
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    value: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: {
    parameter: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parameters_parameter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initconditionElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(enums.workflow_condition_type),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    formula: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
      },
    },
    parameters: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parameters),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction')

const workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    field: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    displaytype: {
      refType: createRefToElmWithValue(enums.workflowaction_displaytype),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflowaction_displaytype. */
    clienttriggerfieldssublist: {
      refType: createRefToElmWithValue(enums.workflow_sublists),
      annotations: {
      },
    }, /* Original description: This field is available when the clienttriggerfieldsissublistfield value is equal to T.   This field is mandatory when the clienttriggerfieldsissublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    sublist: {
      refType: createRefToElmWithValue(enums.workflow_sublists),
      annotations: {
      },
    }, /* Original description: This field is available when the issublistfield value is equal to T.   This field is mandatory when the issublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    clienttriggerfieldsissublistfield: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: This field is available when the triggertype value is present in workflowaction_triggertype_client.   The default value is F. */
    clienttriggerfields: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    eventtypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    issublistfield: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    initcondition: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction)

const workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: {
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    value: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: {
    parameter: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parameters_parameter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initconditionElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(enums.workflow_condition_type),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    formula: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
      },
    },
    parameters: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parameters),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction')

const workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    field: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    clienttriggerfieldssublist: {
      refType: createRefToElmWithValue(enums.workflow_sublists),
      annotations: {
      },
    }, /* Original description: This field is available when the clienttriggerfieldsissublistfield value is equal to T.   This field is mandatory when the clienttriggerfieldsissublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    sublist: {
      refType: createRefToElmWithValue(enums.workflow_sublists),
      annotations: {
      },
    }, /* Original description: This field is available when the issublistfield value is equal to T.   This field is mandatory when the issublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    clienttriggerfieldsissublistfield: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: This field is available when the triggertype value is present in workflowaction_triggertype_client.   The default value is F. */
    clienttriggerfields: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    eventtypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    issublistfield: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    ismandatory: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    initcondition: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction)

const workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: {
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    value: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: {
    parameter: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parameters_parameter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initconditionElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(enums.workflow_condition_type),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    formula: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
      },
    },
    parameters: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parameters),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_setfieldvalueactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction')

const workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setfieldvalueactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    field: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    clienttriggerfieldssublist: {
      refType: createRefToElmWithValue(enums.workflow_sublists),
      annotations: {
      },
    }, /* Original description: This field is available when the clienttriggerfieldsissublistfield value is equal to T.   This field is mandatory when the clienttriggerfieldsissublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    clienttriggerfieldsissublistfield: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: This field is available when the triggertype value is present in workflowaction_triggertype_client.   The default value is F. */
    clienttriggerfields: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    eventtypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    scheduledelay: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
      },
    },
    scheduletimeofday: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    schedulerecurrence: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
      },
    },
    scheduletimeunit: {
      refType: createRefToElmWithValue(enums.workflow_timeunit),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflow_timeunit. */
    schedulemode: {
      refType: createRefToElmWithValue(enums.workflowaction_radioschedulemode),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    valuetype: {
      refType: createRefToElmWithValue(enums.workflowaction_valuetype),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuetype. */
    valuetext: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    valuechecked: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    valueselect: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuemultiselect: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuedate: {
      refType: createRefToElmWithValue(enums.workflowaction_valuedate),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    valuejoinfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    initcondition: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction)

const workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: {
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    value: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: {
    parameter: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parameters_parameter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initconditionElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(enums.workflow_condition_type),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    formula: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
      },
    },
    parameters: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parameters),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_showmessageactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_showmessageaction')

const workflow_workflowstates_workflowstate_workflowactions_showmessageaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_showmessageactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    messagetext: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the string custom type. */
    clienttriggerfieldssublist: {
      refType: createRefToElmWithValue(enums.workflow_sublists),
      annotations: {
      },
    }, /* Original description: This field is available when the clienttriggerfieldsissublistfield value is equal to T.   This field is mandatory when the clienttriggerfieldsissublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    clienttriggerfieldsissublistfield: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: This field is available when the triggertype value is present in workflowaction_triggertype_client.   The default value is F. */
    clienttriggerfields: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    contexttypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    initcondition: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_showmessageaction)

const workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: {
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    value: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: {
    parameter: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parameters_parameter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initconditionElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(enums.workflow_condition_type),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    formula: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
      },
    },
    parameters: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parameters),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_subscribetorecordactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction')

const workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_subscribetorecordactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    eventtypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    scheduledelay: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
      },
    },
    scheduletimeofday: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    schedulerecurrence: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
      },
    },
    scheduletimeunit: {
      refType: createRefToElmWithValue(enums.workflow_timeunit),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflow_timeunit. */
    schedulemode: {
      refType: createRefToElmWithValue(enums.workflowaction_radioschedulemode),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    recordfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    initcondition: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction)

const workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings_fieldsettingElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings_fieldsetting')

const workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings_fieldsetting = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings_fieldsettingElemID,
  annotations: {
  },
  fields: {
    targetfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuetext: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    valuechecked: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    },
    valuedate: {
      refType: createRefToElmWithValue(enums.workflowaction_valuedate),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    valueselect: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuejoinfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings_fieldsetting)

const workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettingsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings')

const workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettingsElemID,
  annotations: {
  },
  fields: {
    fieldsetting: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings_fieldsetting)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings)

const workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: {
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    value: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: {
    parameter: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parameters_parameter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initconditionElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(enums.workflow_condition_type),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    formula: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
      },
    },
    parameters: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parameters),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_transformrecordactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_transformrecordaction')

const workflow_workflowstates_workflowstate_workflowactions_transformrecordaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_transformrecordactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    recordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   customtransactiontype   customrecordtype   For information about other possible values, see generic_standard_recordtype. */
    eventtypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    scheduledelay: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
      },
    },
    scheduletimeofday: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    schedulerecurrence: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
      },
    },
    scheduletimeunit: {
      refType: createRefToElmWithValue(enums.workflow_timeunit),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflow_timeunit. */
    schedulemode: {
      refType: createRefToElmWithValue(enums.workflowaction_radioschedulemode),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    resultfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    isredirectwithoutsaving: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fieldsettings: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings),
      annotations: {
      },
    },
    initcondition: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_transformrecordaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_addbuttonactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_addbuttonaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_addbuttonaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_addbuttonactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    label: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the string custom type. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    saverecordfirst: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    checkconditionbeforeexecution: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_addbuttonaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings_fieldsettingElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings_fieldsetting')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings_fieldsetting = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings_fieldsettingElemID,
  annotations: {
  },
  fields: {
    targetfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuetext: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    valuechecked: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    },
    valuedate: {
      refType: createRefToElmWithValue(enums.workflowaction_valuedate),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    valueselect: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuejoinfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings_fieldsetting)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettingsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettingsElemID,
  annotations: {
  },
  fields: {
    fieldsetting: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings_fieldsetting)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    sublist: {
      refType: createRefToElmWithValue(enums.workflow_sublists),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_sublists.   The default value is 'item'. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    position: {
      refType: createRefToElmWithValue(enums.workflowaction_createline_position),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_createline_position.   The default value is 'AFTERLASTLINE'. */
    fieldsettings: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings_fieldsettingElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings_fieldsetting')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings_fieldsetting = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings_fieldsettingElemID,
  annotations: {
  },
  fields: {
    targetfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuetext: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    valuechecked: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    },
    valuedate: {
      refType: createRefToElmWithValue(enums.workflowaction_valuedate),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    valueselect: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuejoinfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings_fieldsetting)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettingsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettingsElemID,
  annotations: {
  },
  fields: {
    fieldsetting: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings_fieldsetting)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    recordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   customtransactiontype   customrecordtype   For information about other possible values, see generic_standard_recordtype. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    resultfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    fieldsettings: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings_parametersettingElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings_parametersetting')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings_parametersetting = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings_parametersettingElemID,
  annotations: {
  },
  fields: {
    targetparameter: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuetext: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    valuechecked: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    },
    valuedate: {
      refType: createRefToElmWithValue(enums.workflowaction_valuedate),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    valueselect: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuejoinfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings_parametersetting)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettingsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettingsElemID,
  annotations: {
  },
  fields: {
    parametersetting: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings_parametersetting)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    scripttype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the workflowactionscript custom type. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    resultfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    parametersettings: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotopageactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotopageaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotopageaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotopageactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    targetpage: {
      refType: createRefToElmWithValue(enums.generic_standard_task),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the targetpageobject value is not defined.   For information about possible values, see generic_standard_task. */
    targetpageobject: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the targetpage value is not defined.   This field accepts references to the following custom types:   workflowactionscript   usereventscript   scriptdeployment   suitelet   scheduledscript   savedsearch   restlet   portlet   massupdatescript   mapreducescript   customrecordtype   clientscript   centertab   bundleinstallationscript */
    targetpagetasktype: {
      refType: createRefToElmWithValue(enums.centercategory_tasktype),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the targetpageobject value is defined.   For information about possible values, see centercategory_tasktype. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotopageaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings_fieldsettingElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings_fieldsetting')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings_fieldsetting = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings_fieldsettingElemID,
  annotations: {
  },
  fields: {
    targetfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuetext: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    valuechecked: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    },
    valuedate: {
      refType: createRefToElmWithValue(enums.workflowaction_valuedate),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    valueselect: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuejoinfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings_fieldsetting)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettingsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettingsElemID,
  annotations: {
  },
  fields: {
    fieldsetting: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings_fieldsetting)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    recordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   customtransactiontype   customrecordtype   For information about other possible values, see generic_standard_recordtype. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    recordidfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    recordidjoinfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    ineditmode: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fieldsettings: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: {
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    value: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parametersElemID,
  annotations: {
  },
  fields: {
    parameter: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parameters_parameter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initconditionElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(enums.workflow_condition_type),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    formula: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
      },
    },
    parameters: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parameters),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings_workflowfieldsettingElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings_workflowfieldsetting')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings_workflowfieldsetting = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings_workflowfieldsettingElemID,
  annotations: {
  },
  fields: {
    targetworkflowfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuetext: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    valuechecked: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    },
    valuedate: {
      refType: createRefToElmWithValue(enums.workflowaction_valuedate),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    valueselect: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuejoinfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings_workflowfieldsetting)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettingsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettingsElemID,
  annotations: {
  },
  fields: {
    workflowfieldsetting: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings_workflowfieldsetting)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    initiatedworkflow: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the workflow custom type. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    workflowfieldsettings: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_lockrecordactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_lockrecordaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_lockrecordaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_lockrecordactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_lockrecordaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_removebuttonactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_removebuttonaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_removebuttonaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_removebuttonactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    buttonid: {
      refType: createRefToElmWithValue(enums.workflowaction_buttonid),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflowaction_buttonid. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_removebuttonaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_returnusererroractionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_returnusererroraction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_returnusererroraction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_returnusererroractionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    errortext: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the string custom type. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_returnusererroraction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendcampaignemailactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendcampaignemailaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendcampaignemailaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendcampaignemailactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    recipientfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    resultfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    recipientiscurrentrecord: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    recipientjoinfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    campaignevent: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    }, /* Original description: Note Account-specific values are not supported by SDF. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendcampaignemailaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    sendertype: {
      refType: createRefToElmWithValue(enums.workflowaction_sendertype),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflowaction_sendertype. */
    recipienttype: {
      refType: createRefToElmWithValue(enums.workflowaction_recipienttype),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflowaction_recipienttype. */
    sender: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the sendertype value is equal to SPECIFIC.   Note Account-specific values are not supported by SDF. */
    senderfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the sendertype value is equal to FIELD.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    recipient: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the recipienttype value is equal to SPECIFIC.   Note Account-specific values are not supported by SDF. */
    recipientemail: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the recipienttype value is equal to ADDRESS. */
    recipientfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the recipienttype value is equal to FIELD.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    template: {
      refType: createRefToElmWithValue(enums.generic_standard_template),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the usetemplate value is equal to T.   For information about possible values, see generic_standard_template. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    senderjoinfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    recipientjoinfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    recipientccemail: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    recipientbccemail: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    usetemplate: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    subject: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    body: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    includerecordlink: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    attachmenttype: {
      refType: createRefToElmWithValue(enums.workflowaction_attachmenttype),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_attachmenttype. */
    attachmentfile: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was filereference */),
      annotations: {
      },
    },
    attachmentjoinfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    attachmentfield: {
      refType: createRefToElmWithValue(enums.generic_standard_field),
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_standard_field. */
    includetransaction: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    includeformat: {
      refType: createRefToElmWithValue(enums.workflowaction_transtatementtype),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_transtatementtype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaylabelactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaylabelaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaylabelaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaylabelactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    field: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    sublist: {
      refType: createRefToElmWithValue(enums.workflow_sublists),
      annotations: {
      },
    }, /* Original description: This field is available when the issublistfield value is equal to T.   This field is mandatory when the issublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    issublistfield: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    displaylabel: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the string custom type. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaylabelaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaytypeactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaytypeaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaytypeaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaytypeactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    field: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    displaytype: {
      refType: createRefToElmWithValue(enums.workflowaction_displaytype),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflowaction_displaytype. */
    sublist: {
      refType: createRefToElmWithValue(enums.workflow_sublists),
      annotations: {
      },
    }, /* Original description: This field is available when the issublistfield value is equal to T.   This field is mandatory when the issublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    issublistfield: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaytypeaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldmandatoryactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldmandatoryaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldmandatoryaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldmandatoryactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    field: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    sublist: {
      refType: createRefToElmWithValue(enums.workflow_sublists),
      annotations: {
      },
    }, /* Original description: This field is available when the issublistfield value is equal to T.   This field is mandatory when the issublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    issublistfield: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    ismandatory: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldmandatoryaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldvalueactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldvalueaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldvalueaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldvalueactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    field: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    valuetype: {
      refType: createRefToElmWithValue(enums.workflowaction_valuetype),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuetype. */
    valuetext: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    valuechecked: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    valueselect: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuemultiselect: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuedate: {
      refType: createRefToElmWithValue(enums.workflowaction_valuedate),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    valuejoinfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldvalueaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_subscribetorecordactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_subscribetorecordaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_subscribetorecordaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_subscribetorecordactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    recordfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_subscribetorecordaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings_fieldsettingElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings_fieldsetting')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings_fieldsetting = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings_fieldsettingElemID,
  annotations: {
  },
  fields: {
    targetfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuetext: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    valuechecked: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    },
    valuedate: {
      refType: createRefToElmWithValue(enums.workflowaction_valuedate),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    valueselect: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuejoinfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings_fieldsetting)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettingsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettingsElemID,
  annotations: {
  },
  fields: {
    fieldsetting: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings_fieldsetting)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    recordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   customtransactiontype   customrecordtype   For information about other possible values, see generic_standard_recordtype. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    resultfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    isredirectwithoutsaving: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fieldsettings: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    scheduletimeofday: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the schedulemode value is equal to TIMEOFDAY. */
    eventtypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    scheduledelay: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
      },
    },
    schedulerecurrence: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
      },
    },
    scheduletimeunit: {
      refType: createRefToElmWithValue(enums.workflow_timeunit),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflow_timeunit. */
    schedulemode: {
      refType: createRefToElmWithValue(enums.workflowaction_radioschedulemode),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    addbuttonaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_addbuttonaction)),
      annotations: {
      },
    },
    createlineaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction)),
      annotations: {
      },
    },
    createrecordaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction)),
      annotations: {
      },
    },
    customaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction)),
      annotations: {
      },
    },
    gotopageaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotopageaction)),
      annotations: {
      },
    },
    gotorecordaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction)),
      annotations: {
      },
    },
    initcondition: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition),
      annotations: {
      },
    },
    initiateworkflowaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction)),
      annotations: {
      },
    },
    lockrecordaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_lockrecordaction)),
      annotations: {
      },
    },
    removebuttonaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_removebuttonaction)),
      annotations: {
      },
    },
    returnusererroraction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_returnusererroraction)),
      annotations: {
      },
    },
    sendcampaignemailaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendcampaignemailaction)),
      annotations: {
      },
    },
    sendemailaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailaction)),
      annotations: {
      },
    },
    setdisplaylabelaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaylabelaction)),
      annotations: {
      },
    },
    setdisplaytypeaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaytypeaction)),
      annotations: {
      },
    },
    setfieldmandatoryaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldmandatoryaction)),
      annotations: {
      },
    },
    setfieldvalueaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldvalueaction)),
      annotations: {
      },
    },
    subscribetorecordaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_subscribetorecordaction)),
      annotations: {
      },
    },
    transformrecordaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings_fieldsettingElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings_fieldsetting')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings_fieldsetting = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings_fieldsettingElemID,
  annotations: {
  },
  fields: {
    targetfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuetext: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    valuechecked: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    },
    valuedate: {
      refType: createRefToElmWithValue(enums.workflowaction_valuedate),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    valueselect: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuejoinfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings_fieldsetting)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettingsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettingsElemID,
  annotations: {
  },
  fields: {
    fieldsetting: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings_fieldsetting)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: {
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    value: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: {
    parameter: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parameters_parameter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initconditionElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(enums.workflow_condition_type),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    formula: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
      },
    },
    parameters: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parameters),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    recordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   customtransactiontype   customrecordtype   For information about other possible values, see generic_standard_recordtype. */
    conditionsavedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    resultfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    fieldsettings: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings),
      annotations: {
      },
    },
    initcondition: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: {
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    value: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parametersElemID,
  annotations: {
  },
  fields: {
    parameter: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parameters_parameter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initconditionElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(enums.workflow_condition_type),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    formula: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
      },
    },
    parameters: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parameters),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: {
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    value: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parametersElemID,
  annotations: {
  },
  fields: {
    parameter: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parameters_parameter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initconditionElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(enums.workflow_condition_type),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    formula: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
      },
    },
    parameters: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parameters),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroractionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroractionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    errortext: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the string custom type. */
    conditionsavedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    initcondition: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: {
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    value: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: {
    parameter: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parameters_parameter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initconditionElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(enums.workflow_condition_type),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    formula: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
      },
    },
    parameters: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parameters),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    sendertype: {
      refType: createRefToElmWithValue(enums.workflowaction_sendertype),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflowaction_sendertype. */
    recipienttype: {
      refType: createRefToElmWithValue(enums.workflowaction_recipienttype),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflowaction_recipienttype. */
    sender: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the sendertype value is equal to SPECIFIC.   Note Account-specific values are not supported by SDF. */
    senderfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the sendertype value is equal to FIELD.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    recipient: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the recipienttype value is equal to SPECIFIC.   Note Account-specific values are not supported by SDF. */
    recipientemail: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the recipienttype value is equal to ADDRESS. */
    recipientfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the recipienttype value is equal to FIELD.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    template: {
      refType: createRefToElmWithValue(enums.generic_standard_template),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the usetemplate value is equal to T.   For information about possible values, see generic_standard_template. */
    conditionsavedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    senderjoinfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    recipientjoinfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    recipientccemail: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    recipientbccemail: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    usetemplate: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    subject: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    body: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    includerecordlink: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    attachmenttype: {
      refType: createRefToElmWithValue(enums.workflowaction_attachmenttype),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_attachmenttype. */
    attachmentfile: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was filereference */),
      annotations: {
      },
    },
    attachmentjoinfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    attachmentfield: {
      refType: createRefToElmWithValue(enums.generic_standard_field),
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_standard_field. */
    includetransaction: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    includeformat: {
      refType: createRefToElmWithValue(enums.workflowaction_transtatementtype),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_transtatementtype. */
    initcondition: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: {
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    value: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: {
    parameter: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parameters_parameter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initconditionElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(enums.workflow_condition_type),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    formula: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
      },
    },
    parameters: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parameters),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueactionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    field: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    conditionsavedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    valuetype: {
      refType: createRefToElmWithValue(enums.workflowaction_valuetype),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuetype. */
    valuetext: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    valuechecked: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    valueselect: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuemultiselect: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuedate: {
      refType: createRefToElmWithValue(enums.workflowaction_valuedate),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    valuejoinfield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    initcondition: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroupElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroupElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    sublist: {
      refType: createRefToElmWithValue(enums.workflow_sublists),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_sublists. */
    scheduletimeofday: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the schedulemode value is equal to TIMEOFDAY. */
    eventtypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    scheduledelay: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
      },
    },
    schedulerecurrence: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
      },
    },
    scheduletimeunit: {
      refType: createRefToElmWithValue(enums.workflow_timeunit),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflow_timeunit. */
    schedulemode: {
      refType: createRefToElmWithValue(enums.workflowaction_radioschedulemode),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    createrecordaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction)),
      annotations: {
      },
    },
    initcondition: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition),
      annotations: {
      },
    },
    returnusererroraction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction)),
      annotations: {
      },
    },
    sendemailaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction)),
      annotations: {
      },
    },
    setfieldvalueaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup)

const workflow_workflowstates_workflowstate_workflowactionsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions')

const workflow_workflowstates_workflowstate_workflowactions = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactionsElemID,
  annotations: {
  },
  fields: {
    triggertype: {
      refType: createRefToElmWithValue(enums.workflowaction_triggertype),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: For information about possible values, see workflowaction_triggertype. */
    addbuttonaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_addbuttonaction)),
      annotations: {
      },
    },
    confirmaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_confirmaction)),
      annotations: {
      },
    },
    createlineaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_createlineaction)),
      annotations: {
      },
    },
    createrecordaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_createrecordaction)),
      annotations: {
      },
    },
    customaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_customaction)),
      annotations: {
      },
    },
    gotopageaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_gotopageaction)),
      annotations: {
      },
    },
    gotorecordaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_gotorecordaction)),
      annotations: {
      },
    },
    initiateworkflowaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction)),
      annotations: {
      },
    },
    lockrecordaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_lockrecordaction)),
      annotations: {
      },
    },
    removebuttonaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_removebuttonaction)),
      annotations: {
      },
    },
    returnusererroraction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_returnusererroraction)),
      annotations: {
      },
    },
    sendcampaignemailaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction)),
      annotations: {
      },
    },
    sendemailaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_sendemailaction)),
      annotations: {
      },
    },
    setdisplaylabelaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction)),
      annotations: {
      },
    },
    setdisplaytypeaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction)),
      annotations: {
      },
    },
    setfieldmandatoryaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction)),
      annotations: {
      },
    },
    setfieldvalueaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction)),
      annotations: {
      },
    },
    showmessageaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_showmessageaction)),
      annotations: {
      },
    },
    subscribetorecordaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction)),
      annotations: {
      },
    },
    transformrecordaction: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_transformrecordaction)),
      annotations: {
      },
    },
    workflowactiongroup: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup)),
      annotations: {
      },
    },
    workflowsublistactiongroup: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions)

const workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters_customfieldfilterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters_customfieldfilter')

const workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters_customfieldfilter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters_customfieldfilterElemID,
  annotations: {
  },
  fields: {
    fldfilter: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
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
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters_customfieldfilter)

const workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfiltersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters')

const workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfiltersElemID,
  annotations: {
  },
  fields: {
    customfieldfilter: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters_customfieldfilter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters)

const workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccesses_roleaccessElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccesses_roleaccess')

const workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccesses_roleaccess = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccesses_roleaccessElemID,
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
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccesses_roleaccess)

const workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccessesElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccesses')

const workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccesses = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccessesElemID,
  annotations: {
  },
  fields: {
    roleaccess: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccesses_roleaccess)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccesses)

const workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfieldElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield')

const workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfieldElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 41 characters long.   The default value is ‘custwfstate’. */
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
    customfieldfilters: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters),
      annotations: {
      },
    },
    roleaccesses: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccesses),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield)

const workflow_workflowstates_workflowstate_workflowstatecustomfieldsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowstatecustomfields')

const workflow_workflowstates_workflowstate_workflowstatecustomfields = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowstatecustomfieldsElemID,
  annotations: {
  },
  fields: {
    workflowstatecustomfield: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowstatecustomfields)

const workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: {
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    value: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parametersElemID,
  annotations: {
  },
  fields: {
    parameter: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parameters_parameter)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition')

const workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initconditionElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(enums.workflow_condition_type),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    formula: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
      },
    },
    parameters: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parameters),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition)

const workflow_workflowstates_workflowstate_workflowtransitions_workflowtransitionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition')

const workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowtransitions_workflowtransitionElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowtransition’. */
    tostate: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the workflowstate custom type. */
    eventtypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    triggertype: {
      refType: createRefToElmWithValue(enums.workflowtransition_triggertype),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowtransition_triggertype. */
    waitforworkflow: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the workflow custom type. */
    waitforworkflowstate: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the workflowstate custom type. */
    buttonaction: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   addbuttonaction   addbuttonaction */
    scheduledelay: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    scheduletimeunit: {
      refType: createRefToElmWithValue(enums.workflow_timeunit),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflow_timeunit. */
    initcondition: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition)

const workflow_workflowstates_workflowstate_workflowtransitionsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowtransitions')

const workflow_workflowstates_workflowstate_workflowtransitions = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowtransitionsElemID,
  annotations: {
  },
  fields: {
    workflowtransition: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowtransitions)

const workflow_workflowstates_workflowstateElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate')

const workflow_workflowstates_workflowstate = new ObjectType({
  elemID: workflow_workflowstates_workflowstateElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowstate’. */
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the string custom type. */
    description: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    donotexitworkflow: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    positionx: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
      },
    },
    positiony: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
      },
    },
    workflowactions: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate_workflowactions)),
      annotations: {
      },
    },
    workflowstatecustomfields: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowstatecustomfields),
      annotations: {
      },
    },
    workflowtransitions: {
      refType: createRefToElmWithValue(workflow_workflowstates_workflowstate_workflowtransitions),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate)

const workflow_workflowstatesElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates')

const workflow_workflowstates = new ObjectType({
  elemID: workflow_workflowstatesElemID,
  annotations: {
  },
  fields: {
    workflowstate: {
      refType: createRefToElmWithValue(new ListType(workflow_workflowstates_workflowstate)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates)


export const workflow = new ObjectType({
  elemID: workflowElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^customworkflow[0-9a-z_]+' }),
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customworkflow’. */
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the string custom type. */
    recordtypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   customtransactiontype   customrecordtype   For information about other possible values, see generic_standard_recordtype. */
    description: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
      },
    },
    initcontexts: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    initeventtypes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflow_eventtype. */
    initsavedsearchcondition: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    initsavedsearchfilter: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    inittriggertype: {
      refType: createRefToElmWithValue(enums.workflow_triggertype),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflow_triggertype. */
    initoncreate: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    initonvieworupdate: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    initlocalizationcontext: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see countries. */
    isinactive: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    islogenabled: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    releasestatus: {
      refType: createRefToElmWithValue(enums.workflow_releasestatus),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflow_releasestatus.   The default value is 'NOTINITIATING'. */
    runasadmin: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    keephistory: {
      refType: createRefToElmWithValue(enums.workflow_keephistory),
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflow_keephistory.   The default value is 'ONLYWHENTESTING'. */
    initcondition: {
      refType: createRefToElmWithValue(workflow_initcondition),
      annotations: {
      },
    },
    recurrence: {
      refType: createRefToElmWithValue(workflow_recurrence),
      annotations: {
      },
    },
    workflowcustomfields: {
      refType: createRefToElmWithValue(workflow_workflowcustomfields),
      annotations: {
      },
    },
    workflowstates: {
      refType: createRefToElmWithValue(workflow_workflowstates),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})
