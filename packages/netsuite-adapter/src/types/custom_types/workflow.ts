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
import { fieldTypes } from '../field_types'

export const workflowInnerTypes: ObjectType[] = []

const workflowElemID = new ElemID(constants.NETSUITE, 'workflow')
const workflow_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_initcondition_parameters_parameter')

const workflow_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'value',
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_initcondition_parameters_parameter)

const workflow_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_initcondition_parameters')

const workflow_initcondition_parameters = new ObjectType({
  elemID: workflow_initcondition_parametersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parameter',
      type: new ListType(workflow_initcondition_parameters_parameter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_initcondition_parameters)

const workflow_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_initcondition')

const workflow_initcondition = new ObjectType({
  elemID: workflow_initconditionElemID,
  annotations: {
  },
  fields: [
    {
      name: 'type',
      type: enums.workflow_condition_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    {
      name: 'formula',
      type: fieldTypes.cdata,
      annotations: {
      },
    },
    {
      name: 'parameters',
      type: workflow_initcondition_parameters,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_initcondition)

const workflow_recurrence_dailyElemID = new ElemID(constants.NETSUITE, 'workflow_recurrence_daily')

const workflow_recurrence_daily = new ObjectType({
  elemID: workflow_recurrence_dailyElemID,
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
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_recurrence_daily)

const workflow_recurrence_every30minutesElemID = new ElemID(constants.NETSUITE, 'workflow_recurrence_every30minutes')

const workflow_recurrence_every30minutes = new ObjectType({
  elemID: workflow_recurrence_every30minutesElemID,
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
      name: 'enddate',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_recurrence_every30minutes)

const workflow_recurrence_everyweekdayElemID = new ElemID(constants.NETSUITE, 'workflow_recurrence_everyweekday')

const workflow_recurrence_everyweekday = new ObjectType({
  elemID: workflow_recurrence_everyweekdayElemID,
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
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_recurrence_everyweekday)

const workflow_recurrence_monthlyElemID = new ElemID(constants.NETSUITE, 'workflow_recurrence_monthly')

const workflow_recurrence_monthly = new ObjectType({
  elemID: workflow_recurrence_monthlyElemID,
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
      name: 'dayofmonth',
      type: enums.generic_day_of_month,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_day_of_month. */
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
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_recurrence_monthly)

const workflow_recurrence_monthlydayofweekElemID = new ElemID(constants.NETSUITE, 'workflow_recurrence_monthlydayofweek')

const workflow_recurrence_monthlydayofweek = new ObjectType({
  elemID: workflow_recurrence_monthlydayofweekElemID,
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
      type: enums.workflow_order_of_week,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_order_of_week. */
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
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_recurrence_monthlydayofweek)

const workflow_recurrence_singleElemID = new ElemID(constants.NETSUITE, 'workflow_recurrence_single')

const workflow_recurrence_single = new ObjectType({
  elemID: workflow_recurrence_singleElemID,
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
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_recurrence_single)

const workflow_recurrence_weeklyElemID = new ElemID(constants.NETSUITE, 'workflow_recurrence_weekly')

const workflow_recurrence_weekly = new ObjectType({
  elemID: workflow_recurrence_weeklyElemID,
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
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_recurrence_weekly)

const workflow_recurrence_yearlyElemID = new ElemID(constants.NETSUITE, 'workflow_recurrence_yearly')

const workflow_recurrence_yearly = new ObjectType({
  elemID: workflow_recurrence_yearlyElemID,
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
      name: 'month',
      type: enums.generic_month,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_month. */
    {
      name: 'dayofmonth',
      type: enums.generic_day_of_month,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_day_of_month. */
    {
      name: 'enddate',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_recurrence_yearly)

const workflow_recurrence_yearlydayofweekElemID = new ElemID(constants.NETSUITE, 'workflow_recurrence_yearlydayofweek')

const workflow_recurrence_yearlydayofweek = new ObjectType({
  elemID: workflow_recurrence_yearlydayofweekElemID,
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
      name: 'month',
      type: enums.generic_month,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_month. */
    {
      name: 'enddate',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_recurrence_yearlydayofweek)

const workflow_recurrenceElemID = new ElemID(constants.NETSUITE, 'workflow_recurrence')

const workflow_recurrence = new ObjectType({
  elemID: workflow_recurrenceElemID,
  annotations: {
  },
  fields: [
    {
      name: 'daily',
      type: workflow_recurrence_daily,
      annotations: {
      },
    },
    {
      name: 'every30minutes',
      type: workflow_recurrence_every30minutes,
      annotations: {
      },
    },
    {
      name: 'everyweekday',
      type: workflow_recurrence_everyweekday,
      annotations: {
      },
    },
    {
      name: 'monthly',
      type: workflow_recurrence_monthly,
      annotations: {
      },
    },
    {
      name: 'monthlydayofweek',
      type: workflow_recurrence_monthlydayofweek,
      annotations: {
      },
    },
    {
      name: 'single',
      type: workflow_recurrence_single,
      annotations: {
      },
    },
    {
      name: 'weekly',
      type: workflow_recurrence_weekly,
      annotations: {
      },
    },
    {
      name: 'yearly',
      type: workflow_recurrence_yearly,
      annotations: {
      },
    },
    {
      name: 'yearlydayofweek',
      type: workflow_recurrence_yearlydayofweek,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_recurrence)

const workflow_workflowcustomfields_workflowcustomfield_customfieldfilters_customfieldfilterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowcustomfields_workflowcustomfield_customfieldfilters_customfieldfilter')

const workflow_workflowcustomfields_workflowcustomfield_customfieldfilters_customfieldfilter = new ObjectType({
  elemID: workflow_workflowcustomfields_workflowcustomfield_customfieldfilters_customfieldfilterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'fldfilter',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
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
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowcustomfields_workflowcustomfield_customfieldfilters_customfieldfilter)

const workflow_workflowcustomfields_workflowcustomfield_customfieldfiltersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowcustomfields_workflowcustomfield_customfieldfilters')

const workflow_workflowcustomfields_workflowcustomfield_customfieldfilters = new ObjectType({
  elemID: workflow_workflowcustomfields_workflowcustomfield_customfieldfiltersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'customfieldfilter',
      type: new ListType(workflow_workflowcustomfields_workflowcustomfield_customfieldfilters_customfieldfilter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowcustomfields_workflowcustomfield_customfieldfilters)

const workflow_workflowcustomfields_workflowcustomfield_roleaccesses_roleaccessElemID = new ElemID(constants.NETSUITE, 'workflow_workflowcustomfields_workflowcustomfield_roleaccesses_roleaccess')

const workflow_workflowcustomfields_workflowcustomfield_roleaccesses_roleaccess = new ObjectType({
  elemID: workflow_workflowcustomfields_workflowcustomfield_roleaccesses_roleaccessElemID,
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
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowcustomfields_workflowcustomfield_roleaccesses_roleaccess)

const workflow_workflowcustomfields_workflowcustomfield_roleaccessesElemID = new ElemID(constants.NETSUITE, 'workflow_workflowcustomfields_workflowcustomfield_roleaccesses')

const workflow_workflowcustomfields_workflowcustomfield_roleaccesses = new ObjectType({
  elemID: workflow_workflowcustomfields_workflowcustomfield_roleaccessesElemID,
  annotations: {
  },
  fields: [
    {
      name: 'roleaccess',
      type: new ListType(workflow_workflowcustomfields_workflowcustomfield_roleaccesses_roleaccess),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowcustomfields_workflowcustomfield_roleaccesses)

const workflow_workflowcustomfields_workflowcustomfieldElemID = new ElemID(constants.NETSUITE, 'workflow_workflowcustomfields_workflowcustomfield')

const workflow_workflowcustomfields_workflowcustomfield = new ObjectType({
  elemID: workflow_workflowcustomfields_workflowcustomfieldElemID,
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
    }, /* Original description: This attribute value can be up to 42 characters long.   The default value is ‘custworkflow’. */
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
      name: 'customfieldfilters',
      type: workflow_workflowcustomfields_workflowcustomfield_customfieldfilters,
      annotations: {
      },
    },
    {
      name: 'roleaccesses',
      type: workflow_workflowcustomfields_workflowcustomfield_roleaccesses,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowcustomfields_workflowcustomfield)

const workflow_workflowcustomfieldsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowcustomfields')

const workflow_workflowcustomfields = new ObjectType({
  elemID: workflow_workflowcustomfieldsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'workflowcustomfield',
      type: new ListType(workflow_workflowcustomfields_workflowcustomfield),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowcustomfields)

const workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'value',
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parameter',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parameters_parameter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initconditionElemID,
  annotations: {
  },
  fields: [
    {
      name: 'type',
      type: enums.workflow_condition_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    {
      name: 'formula',
      type: fieldTypes.cdata,
      annotations: {
      },
    },
    {
      name: 'parameters',
      type: workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parameters,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_addbuttonactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_addbuttonaction')

const workflow_workflowstates_workflowstate_workflowactions_addbuttonaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_addbuttonactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'label',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the string custom type. */
    {
      name: 'eventtypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    {
      name: 'contexttypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    {
      name: 'conditionsavedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'saverecordfirst',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'checkconditionbeforeexecution',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'initcondition',
      type: workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_addbuttonaction)

const workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'value',
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parameter',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parameters_parameter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_confirmaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_confirmaction_initconditionElemID,
  annotations: {
  },
  fields: [
    {
      name: 'type',
      type: enums.workflow_condition_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    {
      name: 'formula',
      type: fieldTypes.cdata,
      annotations: {
      },
    },
    {
      name: 'parameters',
      type: workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parameters,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_confirmactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_confirmaction')

const workflow_workflowstates_workflowstate_workflowactions_confirmaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_confirmactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'messagetext',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the string custom type. */
    {
      name: 'clienttriggerfieldssublist',
      type: enums.workflow_sublists,
      annotations: {
      },
    }, /* Original description: This field is available when the clienttriggerfieldsissublistfield value is equal to T.   This field is mandatory when the clienttriggerfieldsissublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    {
      name: 'clienttriggerfieldsissublistfield',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the triggertype value is present in workflowaction_triggertype_client.   The default value is F. */
    {
      name: 'clienttriggerfields',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'contexttypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    {
      name: 'conditionsavedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'initcondition',
      type: workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_confirmaction)

const workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings_fieldsettingElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings_fieldsetting')

const workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings_fieldsetting = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings_fieldsettingElemID,
  annotations: {
  },
  fields: [
    {
      name: 'targetfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valuetext',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'valuechecked',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    },
    {
      name: 'valuedate',
      type: enums.workflowaction_valuedate,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    {
      name: 'valueselect',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'valuejoinfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valuefield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valueformula',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings_fieldsetting)

const workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettingsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings')

const workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettingsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'fieldsetting',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings_fieldsetting),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings)

const workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'value',
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parameter',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parameters_parameter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_createlineaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_createlineaction_initconditionElemID,
  annotations: {
  },
  fields: [
    {
      name: 'type',
      type: enums.workflow_condition_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    {
      name: 'formula',
      type: fieldTypes.cdata,
      annotations: {
      },
    },
    {
      name: 'parameters',
      type: workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parameters,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_createlineactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_createlineaction')

const workflow_workflowstates_workflowstate_workflowactions_createlineaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_createlineactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'sublist',
      type: enums.workflow_sublists,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_sublists.   The default value is 'item'. */
    {
      name: 'eventtypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    {
      name: 'contexttypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    {
      name: 'conditionsavedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'position',
      type: enums.workflowaction_createline_position,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_createline_position.   The default value is 'AFTERLASTLINE'. */
    {
      name: 'fieldsettings',
      type: workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings,
      annotations: {
      },
    },
    {
      name: 'initcondition',
      type: workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_createlineaction)

const workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings_fieldsettingElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings_fieldsetting')

const workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings_fieldsetting = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings_fieldsettingElemID,
  annotations: {
  },
  fields: [
    {
      name: 'targetfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valuetext',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'valuechecked',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    },
    {
      name: 'valuedate',
      type: enums.workflowaction_valuedate,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    {
      name: 'valueselect',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'valuejoinfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valuefield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valueformula',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings_fieldsetting)

const workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettingsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings')

const workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettingsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'fieldsetting',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings_fieldsetting),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings)

const workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'value',
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parameter',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parameters_parameter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initconditionElemID,
  annotations: {
  },
  fields: [
    {
      name: 'type',
      type: enums.workflow_condition_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    {
      name: 'formula',
      type: fieldTypes.cdata,
      annotations: {
      },
    },
    {
      name: 'parameters',
      type: workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parameters,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_createrecordactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_createrecordaction')

const workflow_workflowstates_workflowstate_workflowactions_createrecordaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_createrecordactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'recordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   customtransactiontype   customrecordtype   For information about other possible values, see generic_standard_recordtype. */
    {
      name: 'eventtypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    {
      name: 'contexttypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    {
      name: 'conditionsavedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'scheduledelay',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    },
    {
      name: 'scheduletimeofday',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'schedulerecurrence',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    },
    {
      name: 'scheduletimeunit',
      type: enums.workflow_timeunit,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflow_timeunit. */
    {
      name: 'schedulemode',
      type: enums.workflowaction_radioschedulemode,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'resultfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'fieldsettings',
      type: workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings,
      annotations: {
      },
    },
    {
      name: 'initcondition',
      type: workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_createrecordaction)

const workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'value',
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parameter',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parameters_parameter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_customaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_customaction_initconditionElemID,
  annotations: {
  },
  fields: [
    {
      name: 'type',
      type: enums.workflow_condition_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    {
      name: 'formula',
      type: fieldTypes.cdata,
      annotations: {
      },
    },
    {
      name: 'parameters',
      type: workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parameters,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings_parametersettingElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings_parametersetting')

const workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings_parametersetting = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings_parametersettingElemID,
  annotations: {
  },
  fields: [
    {
      name: 'targetparameter',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valuetext',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'valuechecked',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    },
    {
      name: 'valuedate',
      type: enums.workflowaction_valuedate,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    {
      name: 'valueselect',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'valuejoinfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valuefield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valueformula',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings_parametersetting)

const workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettingsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings')

const workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettingsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parametersetting',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings_parametersetting),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings)

const workflow_workflowstates_workflowstate_workflowactions_customactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_customaction')

const workflow_workflowstates_workflowstate_workflowactions_customaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_customactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'scripttype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the workflowactionscript custom type. */
    {
      name: 'eventtypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    {
      name: 'contexttypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    {
      name: 'conditionsavedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'scheduledelay',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    },
    {
      name: 'scheduletimeofday',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'schedulerecurrence',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    },
    {
      name: 'scheduletimeunit',
      type: enums.workflow_timeunit,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflow_timeunit. */
    {
      name: 'schedulemode',
      type: enums.workflowaction_radioschedulemode,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'resultfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'initcondition',
      type: workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition,
      annotations: {
      },
    },
    {
      name: 'parametersettings',
      type: workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_customaction)

const workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'value',
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parameter',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parameters_parameter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initconditionElemID,
  annotations: {
  },
  fields: [
    {
      name: 'type',
      type: enums.workflow_condition_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    {
      name: 'formula',
      type: fieldTypes.cdata,
      annotations: {
      },
    },
    {
      name: 'parameters',
      type: workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parameters,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_gotopageactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_gotopageaction')

const workflow_workflowstates_workflowstate_workflowactions_gotopageaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_gotopageactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'targetpage',
      type: enums.generic_standard_task,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the targetpageobject value is not defined.   For information about possible values, see generic_standard_task. */
    {
      name: 'targetpageobject',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the targetpage value is not defined.   This field accepts references to the following custom types:   workflowactionscript   usereventscript   scriptdeployment   suitelet   scheduledscript   savedsearch   restlet   portlet   massupdatescript   mapreducescript   customrecordtype   clientscript   centertab   bundleinstallationscript */
    {
      name: 'targetpagetasktype',
      type: enums.centercategory_tasktype,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the targetpageobject value is defined.   For information about possible values, see centercategory_tasktype. */
    {
      name: 'eventtypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    {
      name: 'contexttypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    {
      name: 'conditionsavedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'initcondition',
      type: workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_gotopageaction)

const workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings_fieldsettingElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings_fieldsetting')

const workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings_fieldsetting = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings_fieldsettingElemID,
  annotations: {
  },
  fields: [
    {
      name: 'targetfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valuetext',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'valuechecked',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    },
    {
      name: 'valuedate',
      type: enums.workflowaction_valuedate,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    {
      name: 'valueselect',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'valuejoinfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valuefield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valueformula',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings_fieldsetting)

const workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettingsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings')

const workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettingsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'fieldsetting',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings_fieldsetting),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings)

const workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'value',
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parameter',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parameters_parameter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initconditionElemID,
  annotations: {
  },
  fields: [
    {
      name: 'type',
      type: enums.workflow_condition_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    {
      name: 'formula',
      type: fieldTypes.cdata,
      annotations: {
      },
    },
    {
      name: 'parameters',
      type: workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parameters,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_gotorecordactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_gotorecordaction')

const workflow_workflowstates_workflowstate_workflowactions_gotorecordaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_gotorecordactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'recordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   customtransactiontype   customrecordtype   For information about other possible values, see generic_standard_recordtype. */
    {
      name: 'eventtypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    {
      name: 'contexttypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    {
      name: 'conditionsavedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'recordidfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'recordidjoinfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'ineditmode',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'fieldsettings',
      type: workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings,
      annotations: {
      },
    },
    {
      name: 'initcondition',
      type: workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_gotorecordaction)

const workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'value',
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parameter',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parameters_parameter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initconditionElemID,
  annotations: {
  },
  fields: [
    {
      name: 'type',
      type: enums.workflow_condition_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    {
      name: 'formula',
      type: fieldTypes.cdata,
      annotations: {
      },
    },
    {
      name: 'parameters',
      type: workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parameters,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings_workflowfieldsettingElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings_workflowfieldsetting')

const workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings_workflowfieldsetting = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings_workflowfieldsettingElemID,
  annotations: {
  },
  fields: [
    {
      name: 'targetworkflowfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valuetext',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'valuechecked',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    },
    {
      name: 'valuedate',
      type: enums.workflowaction_valuedate,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    {
      name: 'valueselect',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'valuejoinfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valuefield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valueformula',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings_workflowfieldsetting)

const workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettingsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings')

const workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettingsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'workflowfieldsetting',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings_workflowfieldsetting),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings)

const workflow_workflowstates_workflowstate_workflowactions_initiateworkflowactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction')

const workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_initiateworkflowactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'initiatedworkflow',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the workflow custom type. */
    {
      name: 'eventtypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    {
      name: 'contexttypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    {
      name: 'conditionsavedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'scheduledelay',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    },
    {
      name: 'scheduletimeofday',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'schedulerecurrence',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    },
    {
      name: 'scheduletimeunit',
      type: enums.workflow_timeunit,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflow_timeunit. */
    {
      name: 'schedulemode',
      type: enums.workflowaction_radioschedulemode,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'initcondition',
      type: workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition,
      annotations: {
      },
    },
    {
      name: 'workflowfieldsettings',
      type: workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction)

const workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'value',
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parameter',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parameters_parameter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initconditionElemID,
  annotations: {
  },
  fields: [
    {
      name: 'type',
      type: enums.workflow_condition_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    {
      name: 'formula',
      type: fieldTypes.cdata,
      annotations: {
      },
    },
    {
      name: 'parameters',
      type: workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parameters,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_lockrecordactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_lockrecordaction')

const workflow_workflowstates_workflowstate_workflowactions_lockrecordaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_lockrecordactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'eventtypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    {
      name: 'contexttypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    {
      name: 'conditionsavedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'initcondition',
      type: workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_lockrecordaction)

const workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'value',
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parameter',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parameters_parameter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initconditionElemID,
  annotations: {
  },
  fields: [
    {
      name: 'type',
      type: enums.workflow_condition_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    {
      name: 'formula',
      type: fieldTypes.cdata,
      annotations: {
      },
    },
    {
      name: 'parameters',
      type: workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parameters,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_removebuttonactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_removebuttonaction')

const workflow_workflowstates_workflowstate_workflowactions_removebuttonaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_removebuttonactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'buttonid',
      type: enums.workflowaction_buttonid,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflowaction_buttonid. */
    {
      name: 'eventtypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    {
      name: 'contexttypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    {
      name: 'conditionsavedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'initcondition',
      type: workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_removebuttonaction)

const workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'value',
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parametersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parameter',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parameters_parameter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initconditionElemID,
  annotations: {
  },
  fields: [
    {
      name: 'type',
      type: enums.workflow_condition_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    {
      name: 'formula',
      type: fieldTypes.cdata,
      annotations: {
      },
    },
    {
      name: 'parameters',
      type: workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parameters,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_returnusererroractionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_returnusererroraction')

const workflow_workflowstates_workflowstate_workflowactions_returnusererroraction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_returnusererroractionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'errortext',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the string custom type. */
    {
      name: 'clienttriggerfieldssublist',
      type: enums.workflow_sublists,
      annotations: {
      },
    }, /* Original description: This field is available when the clienttriggerfieldsissublistfield value is equal to T.   This field is mandatory when the clienttriggerfieldsissublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    {
      name: 'clienttriggerfieldsissublistfield',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the triggertype value is present in workflowaction_triggertype_client.   The default value is F. */
    {
      name: 'clienttriggerfields',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'eventtypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    {
      name: 'contexttypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    {
      name: 'conditionsavedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'initcondition',
      type: workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_returnusererroraction)

const workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'value',
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parameter',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parameters_parameter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initconditionElemID,
  annotations: {
  },
  fields: [
    {
      name: 'type',
      type: enums.workflow_condition_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    {
      name: 'formula',
      type: fieldTypes.cdata,
      annotations: {
      },
    },
    {
      name: 'parameters',
      type: workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parameters,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction')

const workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'recipientfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'eventtypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    {
      name: 'contexttypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    {
      name: 'conditionsavedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'scheduledelay',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    },
    {
      name: 'scheduletimeofday',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'schedulerecurrence',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    },
    {
      name: 'scheduletimeunit',
      type: enums.workflow_timeunit,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflow_timeunit. */
    {
      name: 'schedulemode',
      type: enums.workflowaction_radioschedulemode,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'resultfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'recipientiscurrentrecord',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'recipientjoinfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'campaignevent',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: Note Account-specific values are not supported by SDF. */
    {
      name: 'initcondition',
      type: workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction)

const workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'value',
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parameter',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parameters_parameter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initconditionElemID,
  annotations: {
  },
  fields: [
    {
      name: 'type',
      type: enums.workflow_condition_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    {
      name: 'formula',
      type: fieldTypes.cdata,
      annotations: {
      },
    },
    {
      name: 'parameters',
      type: workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parameters,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_sendemailaction')

const workflow_workflowstates_workflowstate_workflowactions_sendemailaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'sendertype',
      type: enums.workflowaction_sendertype,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflowaction_sendertype. */
    {
      name: 'recipienttype',
      type: enums.workflowaction_recipienttype,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflowaction_recipienttype. */
    {
      name: 'sender',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the sendertype value is equal to SPECIFIC.   Note Account-specific values are not supported by SDF. */
    {
      name: 'senderfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the sendertype value is equal to FIELD.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'recipient',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the recipienttype value is equal to SPECIFIC.   Note Account-specific values are not supported by SDF. */
    {
      name: 'recipientemail',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the recipienttype value is equal to ADDRESS. */
    {
      name: 'recipientfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the recipienttype value is equal to FIELD.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'template',
      type: enums.generic_standard_template,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the usetemplate value is equal to T.   For information about possible values, see generic_standard_template. */
    {
      name: 'eventtypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    {
      name: 'contexttypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    {
      name: 'conditionsavedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'scheduledelay',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    },
    {
      name: 'scheduletimeofday',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'schedulerecurrence',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    },
    {
      name: 'scheduletimeunit',
      type: enums.workflow_timeunit,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflow_timeunit. */
    {
      name: 'schedulemode',
      type: enums.workflowaction_radioschedulemode,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'senderjoinfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'recipientjoinfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'recipientccemail',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'recipientbccemail',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'usetemplate',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'subject',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'body',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'includerecordlink',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'attachmenttype',
      type: enums.workflowaction_attachmenttype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_attachmenttype. */
    {
      name: 'attachmentfile',
      type: BuiltinTypes.STRING /* Original type was filereference */,
      annotations: {
      },
    },
    {
      name: 'attachmentjoinfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'attachmentfield',
      type: enums.generic_standard_field,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_standard_field. */
    {
      name: 'includetransaction',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'includeformat',
      type: enums.workflowaction_transtatementtype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_transtatementtype. */
    {
      name: 'initcondition',
      type: workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_sendemailaction)

const workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'value',
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parameter',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parameters_parameter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initconditionElemID,
  annotations: {
  },
  fields: [
    {
      name: 'type',
      type: enums.workflow_condition_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    {
      name: 'formula',
      type: fieldTypes.cdata,
      annotations: {
      },
    },
    {
      name: 'parameters',
      type: workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parameters,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction')

const workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'clienttriggerfieldssublist',
      type: enums.workflow_sublists,
      annotations: {
      },
    }, /* Original description: This field is available when the clienttriggerfieldsissublistfield value is equal to T.   This field is mandatory when the clienttriggerfieldsissublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    {
      name: 'sublist',
      type: enums.workflow_sublists,
      annotations: {
      },
    }, /* Original description: This field is available when the issublistfield value is equal to T.   This field is mandatory when the issublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    {
      name: 'clienttriggerfieldsissublistfield',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the triggertype value is present in workflowaction_triggertype_client.   The default value is F. */
    {
      name: 'clienttriggerfields',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'eventtypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    {
      name: 'contexttypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    {
      name: 'conditionsavedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'field',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'issublistfield',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'displaylabel',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'initcondition',
      type: workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction)

const workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'value',
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parameter',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parameters_parameter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initconditionElemID,
  annotations: {
  },
  fields: [
    {
      name: 'type',
      type: enums.workflow_condition_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    {
      name: 'formula',
      type: fieldTypes.cdata,
      annotations: {
      },
    },
    {
      name: 'parameters',
      type: workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parameters,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction')

const workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'displaytype',
      type: enums.workflowaction_displaytype,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflowaction_displaytype. */
    {
      name: 'clienttriggerfieldssublist',
      type: enums.workflow_sublists,
      annotations: {
      },
    }, /* Original description: This field is available when the clienttriggerfieldsissublistfield value is equal to T.   This field is mandatory when the clienttriggerfieldsissublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    {
      name: 'sublist',
      type: enums.workflow_sublists,
      annotations: {
      },
    }, /* Original description: This field is available when the issublistfield value is equal to T.   This field is mandatory when the issublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    {
      name: 'clienttriggerfieldsissublistfield',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the triggertype value is present in workflowaction_triggertype_client.   The default value is F. */
    {
      name: 'clienttriggerfields',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'eventtypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    {
      name: 'contexttypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    {
      name: 'conditionsavedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'field',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'issublistfield',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'initcondition',
      type: workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction)

const workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'value',
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parameter',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parameters_parameter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initconditionElemID,
  annotations: {
  },
  fields: [
    {
      name: 'type',
      type: enums.workflow_condition_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    {
      name: 'formula',
      type: fieldTypes.cdata,
      annotations: {
      },
    },
    {
      name: 'parameters',
      type: workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parameters,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction')

const workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'clienttriggerfieldssublist',
      type: enums.workflow_sublists,
      annotations: {
      },
    }, /* Original description: This field is available when the clienttriggerfieldsissublistfield value is equal to T.   This field is mandatory when the clienttriggerfieldsissublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    {
      name: 'sublist',
      type: enums.workflow_sublists,
      annotations: {
      },
    }, /* Original description: This field is available when the issublistfield value is equal to T.   This field is mandatory when the issublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    {
      name: 'clienttriggerfieldsissublistfield',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the triggertype value is present in workflowaction_triggertype_client.   The default value is F. */
    {
      name: 'clienttriggerfields',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'eventtypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    {
      name: 'contexttypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    {
      name: 'conditionsavedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'field',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'issublistfield',
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
      name: 'initcondition',
      type: workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction)

const workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'value',
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parameter',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parameters_parameter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initconditionElemID,
  annotations: {
  },
  fields: [
    {
      name: 'type',
      type: enums.workflow_condition_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    {
      name: 'formula',
      type: fieldTypes.cdata,
      annotations: {
      },
    },
    {
      name: 'parameters',
      type: workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parameters,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_setfieldvalueactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction')

const workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_setfieldvalueactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'field',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'clienttriggerfieldssublist',
      type: enums.workflow_sublists,
      annotations: {
      },
    }, /* Original description: This field is available when the clienttriggerfieldsissublistfield value is equal to T.   This field is mandatory when the clienttriggerfieldsissublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    {
      name: 'clienttriggerfieldsissublistfield',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the triggertype value is present in workflowaction_triggertype_client.   The default value is F. */
    {
      name: 'clienttriggerfields',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'eventtypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    {
      name: 'contexttypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    {
      name: 'conditionsavedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'scheduledelay',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    },
    {
      name: 'scheduletimeofday',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'schedulerecurrence',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    },
    {
      name: 'scheduletimeunit',
      type: enums.workflow_timeunit,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflow_timeunit. */
    {
      name: 'schedulemode',
      type: enums.workflowaction_radioschedulemode,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'valuetype',
      type: enums.workflowaction_valuetype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuetype. */
    {
      name: 'valuetext',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'valuechecked',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'valueselect',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'valuemultiselect',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'valuedate',
      type: enums.workflowaction_valuedate,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    {
      name: 'valuejoinfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valuefield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valueformula',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'initcondition',
      type: workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction)

const workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'value',
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parameter',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parameters_parameter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initconditionElemID,
  annotations: {
  },
  fields: [
    {
      name: 'type',
      type: enums.workflow_condition_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    {
      name: 'formula',
      type: fieldTypes.cdata,
      annotations: {
      },
    },
    {
      name: 'parameters',
      type: workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parameters,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_showmessageactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_showmessageaction')

const workflow_workflowstates_workflowstate_workflowactions_showmessageaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_showmessageactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'messagetext',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the string custom type. */
    {
      name: 'clienttriggerfieldssublist',
      type: enums.workflow_sublists,
      annotations: {
      },
    }, /* Original description: This field is available when the clienttriggerfieldsissublistfield value is equal to T.   This field is mandatory when the clienttriggerfieldsissublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    {
      name: 'clienttriggerfieldsissublistfield',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the triggertype value is present in workflowaction_triggertype_client.   The default value is F. */
    {
      name: 'clienttriggerfields',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'contexttypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    {
      name: 'conditionsavedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'initcondition',
      type: workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_showmessageaction)

const workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'value',
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parameter',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parameters_parameter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initconditionElemID,
  annotations: {
  },
  fields: [
    {
      name: 'type',
      type: enums.workflow_condition_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    {
      name: 'formula',
      type: fieldTypes.cdata,
      annotations: {
      },
    },
    {
      name: 'parameters',
      type: workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parameters,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_subscribetorecordactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction')

const workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_subscribetorecordactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'eventtypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    {
      name: 'contexttypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    {
      name: 'conditionsavedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'scheduledelay',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    },
    {
      name: 'scheduletimeofday',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'schedulerecurrence',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    },
    {
      name: 'scheduletimeunit',
      type: enums.workflow_timeunit,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflow_timeunit. */
    {
      name: 'schedulemode',
      type: enums.workflowaction_radioschedulemode,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'recordfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'initcondition',
      type: workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction)

const workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings_fieldsettingElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings_fieldsetting')

const workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings_fieldsetting = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings_fieldsettingElemID,
  annotations: {
  },
  fields: [
    {
      name: 'targetfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valuetext',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'valuechecked',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    },
    {
      name: 'valuedate',
      type: enums.workflowaction_valuedate,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    {
      name: 'valueselect',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'valuejoinfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valuefield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valueformula',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings_fieldsetting)

const workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettingsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings')

const workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettingsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'fieldsetting',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings_fieldsetting),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings)

const workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'value',
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parameter',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parameters_parameter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initconditionElemID,
  annotations: {
  },
  fields: [
    {
      name: 'type',
      type: enums.workflow_condition_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    {
      name: 'formula',
      type: fieldTypes.cdata,
      annotations: {
      },
    },
    {
      name: 'parameters',
      type: workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parameters,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_transformrecordactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_transformrecordaction')

const workflow_workflowstates_workflowstate_workflowactions_transformrecordaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_transformrecordactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'recordtype',
      type: enums.generic_standard_recordtype,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_standard_recordtype. */
    {
      name: 'eventtypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    {
      name: 'contexttypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    {
      name: 'conditionsavedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'scheduledelay',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    },
    {
      name: 'scheduletimeofday',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'schedulerecurrence',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    },
    {
      name: 'scheduletimeunit',
      type: enums.workflow_timeunit,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflow_timeunit. */
    {
      name: 'schedulemode',
      type: enums.workflowaction_radioschedulemode,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'resultfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'fieldsettings',
      type: workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings,
      annotations: {
      },
    },
    {
      name: 'initcondition',
      type: workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_transformrecordaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_addbuttonactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_addbuttonaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_addbuttonaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_addbuttonactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'label',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the string custom type. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'saverecordfirst',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'checkconditionbeforeexecution',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_addbuttonaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings_fieldsettingElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings_fieldsetting')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings_fieldsetting = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings_fieldsettingElemID,
  annotations: {
  },
  fields: [
    {
      name: 'targetfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valuetext',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'valuechecked',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    },
    {
      name: 'valuedate',
      type: enums.workflowaction_valuedate,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    {
      name: 'valueselect',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'valuejoinfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valuefield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valueformula',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings_fieldsetting)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettingsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettingsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'fieldsetting',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings_fieldsetting),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'sublist',
      type: enums.workflow_sublists,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_sublists.   The default value is 'item'. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'position',
      type: enums.workflowaction_createline_position,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_createline_position.   The default value is 'AFTERLASTLINE'. */
    {
      name: 'fieldsettings',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings_fieldsettingElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings_fieldsetting')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings_fieldsetting = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings_fieldsettingElemID,
  annotations: {
  },
  fields: [
    {
      name: 'targetfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valuetext',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'valuechecked',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    },
    {
      name: 'valuedate',
      type: enums.workflowaction_valuedate,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    {
      name: 'valueselect',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'valuejoinfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valuefield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valueformula',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings_fieldsetting)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettingsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettingsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'fieldsetting',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings_fieldsetting),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'recordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   customtransactiontype   customrecordtype   For information about other possible values, see generic_standard_recordtype. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'resultfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'fieldsettings',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings_parametersettingElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings_parametersetting')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings_parametersetting = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings_parametersettingElemID,
  annotations: {
  },
  fields: [
    {
      name: 'targetparameter',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valuetext',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'valuechecked',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    },
    {
      name: 'valuedate',
      type: enums.workflowaction_valuedate,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    {
      name: 'valueselect',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'valuejoinfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valuefield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valueformula',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings_parametersetting)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettingsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettingsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parametersetting',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings_parametersetting),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'scripttype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the workflowactionscript custom type. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'resultfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'parametersettings',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotopageactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotopageaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotopageaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotopageactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'targetpage',
      type: enums.generic_standard_task,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the targetpageobject value is not defined.   For information about possible values, see generic_standard_task. */
    {
      name: 'targetpageobject',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the targetpage value is not defined.   This field accepts references to the following custom types:   workflowactionscript   usereventscript   scriptdeployment   suitelet   scheduledscript   savedsearch   restlet   portlet   massupdatescript   mapreducescript   customrecordtype   clientscript   centertab   bundleinstallationscript */
    {
      name: 'targetpagetasktype',
      type: enums.centercategory_tasktype,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the targetpageobject value is defined.   For information about possible values, see centercategory_tasktype. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotopageaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings_fieldsettingElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings_fieldsetting')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings_fieldsetting = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings_fieldsettingElemID,
  annotations: {
  },
  fields: [
    {
      name: 'targetfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valuetext',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'valuechecked',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    },
    {
      name: 'valuedate',
      type: enums.workflowaction_valuedate,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    {
      name: 'valueselect',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'valuejoinfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valuefield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valueformula',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings_fieldsetting)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettingsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettingsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'fieldsetting',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings_fieldsetting),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'recordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   customtransactiontype   customrecordtype   For information about other possible values, see generic_standard_recordtype. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'recordidfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'recordidjoinfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'ineditmode',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'fieldsettings',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'value',
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parametersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parameter',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parameters_parameter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initconditionElemID,
  annotations: {
  },
  fields: [
    {
      name: 'type',
      type: enums.workflow_condition_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    {
      name: 'formula',
      type: fieldTypes.cdata,
      annotations: {
      },
    },
    {
      name: 'parameters',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parameters,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings_workflowfieldsettingElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings_workflowfieldsetting')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings_workflowfieldsetting = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings_workflowfieldsettingElemID,
  annotations: {
  },
  fields: [
    {
      name: 'targetworkflowfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valuetext',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'valuechecked',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    },
    {
      name: 'valuedate',
      type: enums.workflowaction_valuedate,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    {
      name: 'valueselect',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'valuejoinfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valuefield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valueformula',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings_workflowfieldsetting)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettingsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettingsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'workflowfieldsetting',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings_workflowfieldsetting),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'initiatedworkflow',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the workflow custom type. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'workflowfieldsettings',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_lockrecordactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_lockrecordaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_lockrecordaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_lockrecordactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_lockrecordaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_removebuttonactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_removebuttonaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_removebuttonaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_removebuttonactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'buttonid',
      type: enums.workflowaction_buttonid,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflowaction_buttonid. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_removebuttonaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_returnusererroractionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_returnusererroraction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_returnusererroraction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_returnusererroractionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'errortext',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the string custom type. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_returnusererroraction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendcampaignemailactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendcampaignemailaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendcampaignemailaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendcampaignemailactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'recipientfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'resultfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'recipientiscurrentrecord',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'recipientjoinfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'campaignevent',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: Note Account-specific values are not supported by SDF. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendcampaignemailaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'sendertype',
      type: enums.workflowaction_sendertype,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflowaction_sendertype. */
    {
      name: 'recipienttype',
      type: enums.workflowaction_recipienttype,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflowaction_recipienttype. */
    {
      name: 'sender',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the sendertype value is equal to SPECIFIC.   Note Account-specific values are not supported by SDF. */
    {
      name: 'senderfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the sendertype value is equal to FIELD.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'recipient',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the recipienttype value is equal to SPECIFIC.   Note Account-specific values are not supported by SDF. */
    {
      name: 'recipientemail',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the recipienttype value is equal to ADDRESS. */
    {
      name: 'recipientfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the recipienttype value is equal to FIELD.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'template',
      type: enums.generic_standard_template,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the usetemplate value is equal to T.   For information about possible values, see generic_standard_template. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'senderjoinfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'recipientjoinfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'recipientccemail',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'recipientbccemail',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'usetemplate',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'subject',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'body',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'includerecordlink',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'attachmenttype',
      type: enums.workflowaction_attachmenttype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_attachmenttype. */
    {
      name: 'attachmentfile',
      type: BuiltinTypes.STRING /* Original type was filereference */,
      annotations: {
      },
    },
    {
      name: 'attachmentjoinfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'attachmentfield',
      type: enums.generic_standard_field,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_standard_field. */
    {
      name: 'includetransaction',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'includeformat',
      type: enums.workflowaction_transtatementtype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_transtatementtype. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaylabelactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaylabelaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaylabelaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaylabelactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'sublist',
      type: enums.workflow_sublists,
      annotations: {
      },
    }, /* Original description: This field is available when the issublistfield value is equal to T.   This field is mandatory when the issublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    {
      name: 'field',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'issublistfield',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'displaylabel',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaylabelaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaytypeactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaytypeaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaytypeaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaytypeactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'displaytype',
      type: enums.workflowaction_displaytype,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflowaction_displaytype. */
    {
      name: 'sublist',
      type: enums.workflow_sublists,
      annotations: {
      },
    }, /* Original description: This field is available when the issublistfield value is equal to T.   This field is mandatory when the issublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    {
      name: 'field',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'issublistfield',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaytypeaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldmandatoryactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldmandatoryaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldmandatoryaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldmandatoryactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'sublist',
      type: enums.workflow_sublists,
      annotations: {
      },
    }, /* Original description: This field is available when the issublistfield value is equal to T.   This field is mandatory when the issublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    {
      name: 'field',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'issublistfield',
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
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldmandatoryaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldvalueactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldvalueaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldvalueaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldvalueactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'field',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'valuetype',
      type: enums.workflowaction_valuetype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuetype. */
    {
      name: 'valuetext',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'valuechecked',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'valueselect',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'valuemultiselect',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'valuedate',
      type: enums.workflowaction_valuedate,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    {
      name: 'valuejoinfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valuefield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valueformula',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldvalueaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_subscribetorecordactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_subscribetorecordaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_subscribetorecordaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_subscribetorecordactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'recordfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_subscribetorecordaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings_fieldsettingElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings_fieldsetting')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings_fieldsetting = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings_fieldsettingElemID,
  annotations: {
  },
  fields: [
    {
      name: 'targetfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valuetext',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'valuechecked',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    },
    {
      name: 'valuedate',
      type: enums.workflowaction_valuedate,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    {
      name: 'valueselect',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'valuejoinfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valuefield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valueformula',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings_fieldsetting)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettingsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettingsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'fieldsetting',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings_fieldsetting),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'recordtype',
      type: enums.generic_standard_recordtype,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_standard_recordtype. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'resultfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'fieldsettings',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup')

const workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'scheduletimeofday',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the schedulemode value is equal to TIMEOFDAY. */
    {
      name: 'eventtypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    {
      name: 'contexttypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    {
      name: 'conditionsavedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'scheduledelay',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    },
    {
      name: 'schedulerecurrence',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    },
    {
      name: 'scheduletimeunit',
      type: enums.workflow_timeunit,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflow_timeunit. */
    {
      name: 'schedulemode',
      type: enums.workflowaction_radioschedulemode,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'addbuttonaction',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_addbuttonaction,
      annotations: {
      },
    },
    {
      name: 'createlineaction',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction,
      annotations: {
      },
    },
    {
      name: 'createrecordaction',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction,
      annotations: {
      },
    },
    {
      name: 'customaction',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction,
      annotations: {
      },
    },
    {
      name: 'gotopageaction',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotopageaction,
      annotations: {
      },
    },
    {
      name: 'gotorecordaction',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction,
      annotations: {
      },
    },
    {
      name: 'initcondition',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition,
      annotations: {
      },
    },
    {
      name: 'initiateworkflowaction',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction,
      annotations: {
      },
    },
    {
      name: 'lockrecordaction',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_lockrecordaction,
      annotations: {
      },
    },
    {
      name: 'removebuttonaction',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_removebuttonaction,
      annotations: {
      },
    },
    {
      name: 'returnusererroraction',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_returnusererroraction,
      annotations: {
      },
    },
    {
      name: 'sendcampaignemailaction',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendcampaignemailaction,
      annotations: {
      },
    },
    {
      name: 'sendemailaction',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailaction,
      annotations: {
      },
    },
    {
      name: 'setdisplaylabelaction',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaylabelaction,
      annotations: {
      },
    },
    {
      name: 'setdisplaytypeaction',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaytypeaction,
      annotations: {
      },
    },
    {
      name: 'setfieldmandatoryaction',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldmandatoryaction,
      annotations: {
      },
    },
    {
      name: 'setfieldvalueaction',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldvalueaction,
      annotations: {
      },
    },
    {
      name: 'subscribetorecordaction',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_subscribetorecordaction,
      annotations: {
      },
    },
    {
      name: 'transformrecordaction',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings_fieldsettingElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings_fieldsetting')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings_fieldsetting = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings_fieldsettingElemID,
  annotations: {
  },
  fields: [
    {
      name: 'targetfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valuetext',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'valuechecked',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    },
    {
      name: 'valuedate',
      type: enums.workflowaction_valuedate,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    {
      name: 'valueselect',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'valuejoinfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valuefield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valueformula',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings_fieldsetting)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettingsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettingsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'fieldsetting',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings_fieldsetting),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'value',
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parameter',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parameters_parameter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initconditionElemID,
  annotations: {
  },
  fields: [
    {
      name: 'type',
      type: enums.workflow_condition_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    {
      name: 'formula',
      type: fieldTypes.cdata,
      annotations: {
      },
    },
    {
      name: 'parameters',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parameters,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'recordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   customtransactiontype   customrecordtype   For information about other possible values, see generic_standard_recordtype. */
    {
      name: 'conditionsavedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'resultfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'fieldsettings',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings,
      annotations: {
      },
    },
    {
      name: 'initcondition',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'value',
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parametersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parameter',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parameters_parameter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initconditionElemID,
  annotations: {
  },
  fields: [
    {
      name: 'type',
      type: enums.workflow_condition_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    {
      name: 'formula',
      type: fieldTypes.cdata,
      annotations: {
      },
    },
    {
      name: 'parameters',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parameters,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'value',
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parametersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parameter',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parameters_parameter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initconditionElemID,
  annotations: {
  },
  fields: [
    {
      name: 'type',
      type: enums.workflow_condition_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    {
      name: 'formula',
      type: fieldTypes.cdata,
      annotations: {
      },
    },
    {
      name: 'parameters',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parameters,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroractionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroractionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'errortext',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the string custom type. */
    {
      name: 'conditionsavedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'initcondition',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'value',
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parameter',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parameters_parameter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initconditionElemID,
  annotations: {
  },
  fields: [
    {
      name: 'type',
      type: enums.workflow_condition_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    {
      name: 'formula',
      type: fieldTypes.cdata,
      annotations: {
      },
    },
    {
      name: 'parameters',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parameters,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'sendertype',
      type: enums.workflowaction_sendertype,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflowaction_sendertype. */
    {
      name: 'recipienttype',
      type: enums.workflowaction_recipienttype,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflowaction_recipienttype. */
    {
      name: 'sender',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the sendertype value is equal to SPECIFIC.   Note Account-specific values are not supported by SDF. */
    {
      name: 'senderfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the sendertype value is equal to FIELD.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'recipient',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the recipienttype value is equal to SPECIFIC.   Note Account-specific values are not supported by SDF. */
    {
      name: 'recipientemail',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the recipienttype value is equal to ADDRESS. */
    {
      name: 'recipientfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the recipienttype value is equal to FIELD.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'template',
      type: enums.generic_standard_template,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the usetemplate value is equal to T.   For information about possible values, see generic_standard_template. */
    {
      name: 'conditionsavedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'senderjoinfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'recipientjoinfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'recipientccemail',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'recipientbccemail',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'usetemplate',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'subject',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'body',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'includerecordlink',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'attachmenttype',
      type: enums.workflowaction_attachmenttype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_attachmenttype. */
    {
      name: 'attachmentfile',
      type: BuiltinTypes.STRING /* Original type was filereference */,
      annotations: {
      },
    },
    {
      name: 'attachmentjoinfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'attachmentfield',
      type: enums.generic_standard_field,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_standard_field. */
    {
      name: 'includetransaction',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'includeformat',
      type: enums.workflowaction_transtatementtype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_transtatementtype. */
    {
      name: 'initcondition',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'value',
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parametersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parameter',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parameters_parameter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initconditionElemID,
  annotations: {
  },
  fields: [
    {
      name: 'type',
      type: enums.workflow_condition_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    {
      name: 'formula',
      type: fieldTypes.cdata,
      annotations: {
      },
    },
    {
      name: 'parameters',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parameters,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueactionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueactionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'field',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'conditionsavedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'valuetype',
      type: enums.workflowaction_valuetype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuetype. */
    {
      name: 'valuetext',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'valuechecked',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'valueselect',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'valuemultiselect',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'valuedate',
      type: enums.workflowaction_valuedate,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_valuedate. */
    {
      name: 'valuejoinfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valuefield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'valueformula',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'initcondition',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction)

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroupElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup')

const workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroupElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    {
      name: 'sublist',
      type: enums.workflow_sublists,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_sublists. */
    {
      name: 'scheduletimeofday',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the schedulemode value is equal to TIMEOFDAY. */
    {
      name: 'eventtypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    {
      name: 'contexttypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    {
      name: 'conditionsavedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'scheduledelay',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    },
    {
      name: 'schedulerecurrence',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    },
    {
      name: 'scheduletimeunit',
      type: enums.workflow_timeunit,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflow_timeunit. */
    {
      name: 'schedulemode',
      type: enums.workflowaction_radioschedulemode,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'createrecordaction',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction,
      annotations: {
      },
    },
    {
      name: 'initcondition',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition,
      annotations: {
      },
    },
    {
      name: 'returnusererroraction',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction,
      annotations: {
      },
    },
    {
      name: 'sendemailaction',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction,
      annotations: {
      },
    },
    {
      name: 'setfieldvalueaction',
      type: workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup)

const workflow_workflowstates_workflowstate_workflowactionsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowactions')

const workflow_workflowstates_workflowstate_workflowactions = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowactionsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'triggertype',
      type: enums.workflowaction_triggertype,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: For information about possible values, see workflowaction_triggertype. */
    {
      name: 'addbuttonaction',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_addbuttonaction),
      annotations: {
      },
    },
    {
      name: 'confirmaction',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_confirmaction),
      annotations: {
      },
    },
    {
      name: 'createlineaction',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_createlineaction),
      annotations: {
      },
    },
    {
      name: 'createrecordaction',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_createrecordaction),
      annotations: {
      },
    },
    {
      name: 'customaction',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_customaction),
      annotations: {
      },
    },
    {
      name: 'gotopageaction',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_gotopageaction),
      annotations: {
      },
    },
    {
      name: 'gotorecordaction',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_gotorecordaction),
      annotations: {
      },
    },
    {
      name: 'initiateworkflowaction',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction),
      annotations: {
      },
    },
    {
      name: 'lockrecordaction',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_lockrecordaction),
      annotations: {
      },
    },
    {
      name: 'removebuttonaction',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_removebuttonaction),
      annotations: {
      },
    },
    {
      name: 'returnusererroraction',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_returnusererroraction),
      annotations: {
      },
    },
    {
      name: 'sendcampaignemailaction',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction),
      annotations: {
      },
    },
    {
      name: 'sendemailaction',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_sendemailaction),
      annotations: {
      },
    },
    {
      name: 'setdisplaylabelaction',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction),
      annotations: {
      },
    },
    {
      name: 'setdisplaytypeaction',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction),
      annotations: {
      },
    },
    {
      name: 'setfieldmandatoryaction',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction),
      annotations: {
      },
    },
    {
      name: 'setfieldvalueaction',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction),
      annotations: {
      },
    },
    {
      name: 'showmessageaction',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_showmessageaction),
      annotations: {
      },
    },
    {
      name: 'subscribetorecordaction',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction),
      annotations: {
      },
    },
    {
      name: 'transformrecordaction',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_transformrecordaction),
      annotations: {
      },
    },
    {
      name: 'workflowactiongroup',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup),
      annotations: {
      },
    },
    {
      name: 'workflowsublistactiongroup',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowactions)

const workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters_customfieldfilterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters_customfieldfilter')

const workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters_customfieldfilter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters_customfieldfilterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'fldfilter',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
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
    }, /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters_customfieldfilter)

const workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfiltersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters')

const workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfiltersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'customfieldfilter',
      type: new ListType(workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters_customfieldfilter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters)

const workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccesses_roleaccessElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccesses_roleaccess')

const workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccesses_roleaccess = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccesses_roleaccessElemID,
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
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccesses_roleaccess)

const workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccessesElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccesses')

const workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccesses = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccessesElemID,
  annotations: {
  },
  fields: [
    {
      name: 'roleaccess',
      type: new ListType(workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccesses_roleaccess),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccesses)

const workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfieldElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield')

const workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfieldElemID,
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
    }, /* Original description: This attribute value can be up to 41 characters long.   The default value is ‘custwfstate’. */
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
      name: 'customfieldfilters',
      type: workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters,
      annotations: {
      },
    },
    {
      name: 'roleaccesses',
      type: workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccesses,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield)

const workflow_workflowstates_workflowstate_workflowstatecustomfieldsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowstatecustomfields')

const workflow_workflowstates_workflowstate_workflowstatecustomfields = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowstatecustomfieldsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'workflowstatecustomfield',
      type: new ListType(workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowstatecustomfields)

const workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parameters_parameter')

const workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'value',
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parameters_parameter)

const workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parametersElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parameters')

const workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parameters = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parametersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'parameter',
      type: new ListType(workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parameters_parameter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parameters)

const workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initconditionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition')

const workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initconditionElemID,
  annotations: {
  },
  fields: [
    {
      name: 'type',
      type: enums.workflow_condition_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see workflow_condition_type. */
    {
      name: 'formula',
      type: fieldTypes.cdata,
      annotations: {
      },
    },
    {
      name: 'parameters',
      type: workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parameters,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition)

const workflow_workflowstates_workflowstate_workflowtransitions_workflowtransitionElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition')

const workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowtransitions_workflowtransitionElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowtransition’. */
    {
      name: 'tostate',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the workflowstate custom type. */
    {
      name: 'eventtypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    {
      name: 'contexttypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    {
      name: 'conditionsavedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'triggertype',
      type: enums.workflowtransition_triggertype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflowtransition_triggertype. */
    {
      name: 'waitforworkflow',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the workflow custom type. */
    {
      name: 'waitforworkflowstate',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the workflowstate custom type. */
    {
      name: 'buttonaction',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   addbuttonaction   addbuttonaction */
    {
      name: 'scheduledelay',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'scheduletimeunit',
      type: enums.workflow_timeunit,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflow_timeunit. */
    {
      name: 'initcondition',
      type: workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition)

const workflow_workflowstates_workflowstate_workflowtransitionsElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate_workflowtransitions')

const workflow_workflowstates_workflowstate_workflowtransitions = new ObjectType({
  elemID: workflow_workflowstates_workflowstate_workflowtransitionsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'workflowtransition',
      type: new ListType(workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate_workflowtransitions)

const workflow_workflowstates_workflowstateElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates_workflowstate')

const workflow_workflowstates_workflowstate = new ObjectType({
  elemID: workflow_workflowstates_workflowstateElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowstate’. */
    {
      name: 'name',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the string custom type. */
    {
      name: 'description',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'donotexitworkflow',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'positionx',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    },
    {
      name: 'positiony',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    },
    {
      name: 'workflowactions',
      type: new ListType(workflow_workflowstates_workflowstate_workflowactions),
      annotations: {
      },
    },
    {
      name: 'workflowstatecustomfields',
      type: workflow_workflowstates_workflowstate_workflowstatecustomfields,
      annotations: {
      },
    },
    {
      name: 'workflowtransitions',
      type: workflow_workflowstates_workflowstate_workflowtransitions,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates_workflowstate)

const workflow_workflowstatesElemID = new ElemID(constants.NETSUITE, 'workflow_workflowstates')

const workflow_workflowstates = new ObjectType({
  elemID: workflow_workflowstatesElemID,
  annotations: {
  },
  fields: [
    {
      name: 'workflowstate',
      type: new ListType(workflow_workflowstates_workflowstate),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates)


export const workflow = new ObjectType({
  elemID: workflowElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'customworkflow_',
  },
  fields: [
    {
      name: 'scriptid',
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customworkflow’. */
    {
      name: 'name',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
      },
    }, /* Original description: This field accepts references to the string custom type. */
    {
      name: 'recordtypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   customtransactiontype   customrecordtype   For information about other possible values, see generic_standard_recordtype. */
    {
      name: 'description',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'initcontexts',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    {
      name: 'initeventtypes',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflow_eventtype. */
    {
      name: 'initsavedsearchcondition',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'initsavedsearchfilter',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'inittriggertype',
      type: enums.workflow_triggertype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflow_triggertype. */
    {
      name: 'initoncreate',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'initonvieworupdate',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'islogenabled',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'releasestatus',
      type: enums.workflow_releasestatus,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflow_releasestatus.   The default value is 'NOTINITIATING'. */
    {
      name: 'runasadmin',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'keephistory',
      type: enums.workflow_keephistory,
      annotations: {
      },
    }, /* Original description: For information about possible values, see workflow_keephistory.   The default value is 'ONLYWHENTESTING'. */
    {
      name: 'initcondition',
      type: workflow_initcondition,
      annotations: {
      },
    },
    {
      name: 'recurrence',
      type: workflow_recurrence,
      annotations: {
      },
    },
    {
      name: 'workflowcustomfields',
      type: workflow_workflowcustomfields,
      annotations: {
      },
    },
    {
      name: 'workflowstates',
      type: workflow_workflowstates,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})
