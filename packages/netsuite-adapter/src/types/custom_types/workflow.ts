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
import { fieldTypes } from '../field_types'

export const workflowInnerTypes: ObjectType[] = []

const workflowElemID = new ElemID(constants.NETSUITE, 'workflow')
const workflow_initcondition_parameters_parameterElemID = new ElemID(constants.NETSUITE, 'workflow_initcondition_parameters_parameter')

const workflow_initcondition_parameters_parameter = new ObjectType({
  elemID: workflow_initcondition_parameters_parameterElemID,
  annotations: {
  },
  fields: {
    name: new Field(
      workflow_initcondition_parameters_parameterElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    value: new Field(
      workflow_initcondition_parameters_parameterElemID,
      'value',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: new Field(
      workflow_initcondition_parameters_parameterElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
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
    parameter: new Field(
      workflow_initcondition_parametersElemID,
      'parameter',
      new ListType(workflow_initcondition_parameters_parameter),
      {
      },
    ),
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
    type: new Field(
      workflow_initconditionElemID,
      'type',
      enums.workflow_condition_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_condition_type. */
    formula: new Field(
      workflow_initconditionElemID,
      'formula',
      fieldTypes.cdata,
      {
      },
    ),
    parameters: new Field(
      workflow_initconditionElemID,
      'parameters',
      workflow_initcondition_parameters,
      {
      },
    ),
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
    startdate: new Field(
      workflow_recurrence_dailyElemID,
      'startdate',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    starttime: new Field(
      workflow_recurrence_dailyElemID,
      'starttime',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    everyxdays: new Field(
      workflow_recurrence_dailyElemID,
      'everyxdays',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    enddate: new Field(
      workflow_recurrence_dailyElemID,
      'enddate',
      BuiltinTypes.STRING,
      {
      },
    ),
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
    startdate: new Field(
      workflow_recurrence_every30minutesElemID,
      'startdate',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    enddate: new Field(
      workflow_recurrence_every30minutesElemID,
      'enddate',
      BuiltinTypes.STRING,
      {
      },
    ),
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
    startdate: new Field(
      workflow_recurrence_everyweekdayElemID,
      'startdate',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    starttime: new Field(
      workflow_recurrence_everyweekdayElemID,
      'starttime',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    enddate: new Field(
      workflow_recurrence_everyweekdayElemID,
      'enddate',
      BuiltinTypes.STRING,
      {
      },
    ),
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
    startdate: new Field(
      workflow_recurrence_monthlyElemID,
      'startdate',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    starttime: new Field(
      workflow_recurrence_monthlyElemID,
      'starttime',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    dayofmonth: new Field(
      workflow_recurrence_monthlyElemID,
      'dayofmonth',
      enums.generic_day_of_month,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_day_of_month. */
    everyxmonths: new Field(
      workflow_recurrence_monthlyElemID,
      'everyxmonths',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    enddate: new Field(
      workflow_recurrence_monthlyElemID,
      'enddate',
      BuiltinTypes.STRING,
      {
      },
    ),
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
    startdate: new Field(
      workflow_recurrence_monthlydayofweekElemID,
      'startdate',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    starttime: new Field(
      workflow_recurrence_monthlydayofweekElemID,
      'starttime',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    orderofweek: new Field(
      workflow_recurrence_monthlydayofweekElemID,
      'orderofweek',
      enums.workflow_order_of_week,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_order_of_week. */
    dayofweek: new Field(
      workflow_recurrence_monthlydayofweekElemID,
      'dayofweek',
      enums.generic_day_of_week,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_day_of_week. */
    everyxmonths: new Field(
      workflow_recurrence_monthlydayofweekElemID,
      'everyxmonths',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    enddate: new Field(
      workflow_recurrence_monthlydayofweekElemID,
      'enddate',
      BuiltinTypes.STRING,
      {
      },
    ),
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
    startdate: new Field(
      workflow_recurrence_singleElemID,
      'startdate',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    starttime: new Field(
      workflow_recurrence_singleElemID,
      'starttime',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
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
    startdate: new Field(
      workflow_recurrence_weeklyElemID,
      'startdate',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    starttime: new Field(
      workflow_recurrence_weeklyElemID,
      'starttime',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    everyxweeks: new Field(
      workflow_recurrence_weeklyElemID,
      'everyxweeks',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    sunday: new Field(
      workflow_recurrence_weeklyElemID,
      'sunday',
      BuiltinTypes.BOOLEAN,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: The default value is F. */
    monday: new Field(
      workflow_recurrence_weeklyElemID,
      'monday',
      BuiltinTypes.BOOLEAN,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: The default value is F. */
    tuesday: new Field(
      workflow_recurrence_weeklyElemID,
      'tuesday',
      BuiltinTypes.BOOLEAN,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: The default value is F. */
    wednesday: new Field(
      workflow_recurrence_weeklyElemID,
      'wednesday',
      BuiltinTypes.BOOLEAN,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: The default value is F. */
    thursday: new Field(
      workflow_recurrence_weeklyElemID,
      'thursday',
      BuiltinTypes.BOOLEAN,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: The default value is F. */
    friday: new Field(
      workflow_recurrence_weeklyElemID,
      'friday',
      BuiltinTypes.BOOLEAN,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: The default value is F. */
    saturday: new Field(
      workflow_recurrence_weeklyElemID,
      'saturday',
      BuiltinTypes.BOOLEAN,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: The default value is F. */
    enddate: new Field(
      workflow_recurrence_weeklyElemID,
      'enddate',
      BuiltinTypes.STRING,
      {
      },
    ),
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
    startdate: new Field(
      workflow_recurrence_yearlyElemID,
      'startdate',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    starttime: new Field(
      workflow_recurrence_yearlyElemID,
      'starttime',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    month: new Field(
      workflow_recurrence_yearlyElemID,
      'month',
      enums.generic_month,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_month. */
    dayofmonth: new Field(
      workflow_recurrence_yearlyElemID,
      'dayofmonth',
      enums.generic_day_of_month,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_day_of_month. */
    enddate: new Field(
      workflow_recurrence_yearlyElemID,
      'enddate',
      BuiltinTypes.STRING,
      {
      },
    ),
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
    startdate: new Field(
      workflow_recurrence_yearlydayofweekElemID,
      'startdate',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    starttime: new Field(
      workflow_recurrence_yearlydayofweekElemID,
      'starttime',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    orderofweek: new Field(
      workflow_recurrence_yearlydayofweekElemID,
      'orderofweek',
      enums.generic_order_of_week,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_order_of_week. */
    dayofweek: new Field(
      workflow_recurrence_yearlydayofweekElemID,
      'dayofweek',
      enums.generic_day_of_week,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_day_of_week. */
    month: new Field(
      workflow_recurrence_yearlydayofweekElemID,
      'month',
      enums.generic_month,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_month. */
    enddate: new Field(
      workflow_recurrence_yearlydayofweekElemID,
      'enddate',
      BuiltinTypes.STRING,
      {
      },
    ),
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
    daily: new Field(
      workflow_recurrenceElemID,
      'daily',
      workflow_recurrence_daily,
      {
      },
    ),
    every30minutes: new Field(
      workflow_recurrenceElemID,
      'every30minutes',
      workflow_recurrence_every30minutes,
      {
      },
    ),
    everyweekday: new Field(
      workflow_recurrenceElemID,
      'everyweekday',
      workflow_recurrence_everyweekday,
      {
      },
    ),
    monthly: new Field(
      workflow_recurrenceElemID,
      'monthly',
      workflow_recurrence_monthly,
      {
      },
    ),
    monthlydayofweek: new Field(
      workflow_recurrenceElemID,
      'monthlydayofweek',
      workflow_recurrence_monthlydayofweek,
      {
      },
    ),
    single: new Field(
      workflow_recurrenceElemID,
      'single',
      workflow_recurrence_single,
      {
      },
    ),
    weekly: new Field(
      workflow_recurrenceElemID,
      'weekly',
      workflow_recurrence_weekly,
      {
      },
    ),
    yearly: new Field(
      workflow_recurrenceElemID,
      'yearly',
      workflow_recurrence_yearly,
      {
      },
    ),
    yearlydayofweek: new Field(
      workflow_recurrenceElemID,
      'yearlydayofweek',
      workflow_recurrence_yearlydayofweek,
      {
      },
    ),
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
    fldfilter: new Field(
      workflow_workflowcustomfields_workflowcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilter',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    fldfilterchecked: new Field(
      workflow_workflowcustomfields_workflowcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilterchecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldfiltercomparetype: new Field(
      workflow_workflowcustomfields_workflowcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfiltercomparetype',
      enums.generic_customfield_fldfiltercomparetype,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_fldfiltercomparetype.   The default value is 'EQ'. */
    fldfiltersel: new Field(
      workflow_workflowcustomfields_workflowcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfiltersel',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    fldfilterval: new Field(
      workflow_workflowcustomfields_workflowcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilterval',
      BuiltinTypes.STRING,
      {
      },
    ),
    fldfilternotnull: new Field(
      workflow_workflowcustomfields_workflowcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilternotnull',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldfilternull: new Field(
      workflow_workflowcustomfields_workflowcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilternull',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldcomparefield: new Field(
      workflow_workflowcustomfields_workflowcustomfield_customfieldfilters_customfieldfilterElemID,
      'fldcomparefield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
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
    customfieldfilter: new Field(
      workflow_workflowcustomfields_workflowcustomfield_customfieldfiltersElemID,
      'customfieldfilter',
      new ListType(workflow_workflowcustomfields_workflowcustomfield_customfieldfilters_customfieldfilter),
      {
      },
    ),
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
    role: new Field(
      workflow_workflowcustomfields_workflowcustomfield_roleaccesses_roleaccessElemID,
      'role',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */
    accesslevel: new Field(
      workflow_workflowcustomfields_workflowcustomfield_roleaccesses_roleaccessElemID,
      'accesslevel',
      enums.generic_accesslevel_searchlevel,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
    searchlevel: new Field(
      workflow_workflowcustomfields_workflowcustomfield_roleaccesses_roleaccessElemID,
      'searchlevel',
      enums.generic_accesslevel_searchlevel,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
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
    roleaccess: new Field(
      workflow_workflowcustomfields_workflowcustomfield_roleaccessesElemID,
      'roleaccess',
      new ListType(workflow_workflowcustomfields_workflowcustomfield_roleaccesses_roleaccess),
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowcustomfields_workflowcustomfieldElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 42 characters long.   The default value is ‘custworkflow’. */
    fieldtype: new Field(
      workflow_workflowcustomfields_workflowcustomfieldElemID,
      'fieldtype',
      enums.generic_customfield_fieldtype,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_customfield_fieldtype.   The default value is 'TEXT'. */
    label: new Field(
      workflow_workflowcustomfields_workflowcustomfieldElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    ), /* Original description: This field value can be up to 200 characters long. */
    selectrecordtype: new Field(
      workflow_workflowcustomfields_workflowcustomfieldElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is mandatory when the fieldtype value is equal to any of the following lists or values: SELECT, MULTISELECT.   This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
    applyformatting: new Field(
      workflow_workflowcustomfields_workflowcustomfieldElemID,
      'applyformatting',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    defaultchecked: new Field(
      workflow_workflowcustomfields_workflowcustomfieldElemID,
      'defaultchecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    defaultselection: new Field(
      workflow_workflowcustomfields_workflowcustomfieldElemID,
      'defaultselection',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    defaultvalue: new Field(
      workflow_workflowcustomfields_workflowcustomfieldElemID,
      'defaultvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    description: new Field(
      workflow_workflowcustomfields_workflowcustomfieldElemID,
      'description',
      BuiltinTypes.STRING,
      {
      },
    ),
    displaytype: new Field(
      workflow_workflowcustomfields_workflowcustomfieldElemID,
      'displaytype',
      enums.generic_customfield_displaytype,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_displaytype.   The default value is 'NORMAL'. */
    dynamicdefault: new Field(
      workflow_workflowcustomfields_workflowcustomfieldElemID,
      'dynamicdefault',
      enums.generic_customfield_dynamicdefault,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_dynamicdefault. */
    help: new Field(
      workflow_workflowcustomfields_workflowcustomfieldElemID,
      'help',
      BuiltinTypes.STRING,
      {
      },
    ),
    linktext: new Field(
      workflow_workflowcustomfields_workflowcustomfieldElemID,
      'linktext',
      BuiltinTypes.STRING,
      {
      },
    ),
    minvalue: new Field(
      workflow_workflowcustomfields_workflowcustomfieldElemID,
      'minvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    maxvalue: new Field(
      workflow_workflowcustomfields_workflowcustomfieldElemID,
      'maxvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    storevalue: new Field(
      workflow_workflowcustomfields_workflowcustomfieldElemID,
      'storevalue',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    customfieldfilters: new Field(
      workflow_workflowcustomfields_workflowcustomfieldElemID,
      'customfieldfilters',
      workflow_workflowcustomfields_workflowcustomfield_customfieldfilters,
      {
      },
    ),
    roleaccesses: new Field(
      workflow_workflowcustomfields_workflowcustomfieldElemID,
      'roleaccesses',
      workflow_workflowcustomfields_workflowcustomfield_roleaccesses,
      {
      },
    ),
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
    workflowcustomfield: new Field(
      workflow_workflowcustomfieldsElemID,
      'workflowcustomfield',
      new ListType(workflow_workflowcustomfields_workflowcustomfield),
      {
      },
    ),
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
    name: new Field(
      workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parameters_parameterElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    value: new Field(
      workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parameters_parameterElemID,
      'value',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parameters_parameterElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
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
    parameter: new Field(
      workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parametersElemID,
      'parameter',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parameters_parameter),
      {
      },
    ),
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
    type: new Field(
      workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initconditionElemID,
      'type',
      enums.workflow_condition_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_condition_type. */
    formula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initconditionElemID,
      'formula',
      fieldTypes.cdata,
      {
      },
    ),
    parameters: new Field(
      workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initconditionElemID,
      'parameters',
      workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_parameters,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_addbuttonactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    label: new Field(
      workflow_workflowstates_workflowstate_workflowactions_addbuttonactionElemID,
      'label',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the string custom type. */
    eventtypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_addbuttonactionElemID,
      'eventtypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_addbuttonactionElemID,
      'contexttypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: new Field(
      workflow_workflowstates_workflowstate_workflowactions_addbuttonactionElemID,
      'conditionsavedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_addbuttonactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    saverecordfirst: new Field(
      workflow_workflowstates_workflowstate_workflowactions_addbuttonactionElemID,
      'saverecordfirst',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    checkconditionbeforeexecution: new Field(
      workflow_workflowstates_workflowstate_workflowactions_addbuttonactionElemID,
      'checkconditionbeforeexecution',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    initcondition: new Field(
      workflow_workflowstates_workflowstate_workflowactions_addbuttonactionElemID,
      'initcondition',
      workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition,
      {
      },
    ),
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
    name: new Field(
      workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parameters_parameterElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    value: new Field(
      workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parameters_parameterElemID,
      'value',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parameters_parameterElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
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
    parameter: new Field(
      workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parametersElemID,
      'parameter',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parameters_parameter),
      {
      },
    ),
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
    type: new Field(
      workflow_workflowstates_workflowstate_workflowactions_confirmaction_initconditionElemID,
      'type',
      enums.workflow_condition_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_condition_type. */
    formula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_confirmaction_initconditionElemID,
      'formula',
      fieldTypes.cdata,
      {
      },
    ),
    parameters: new Field(
      workflow_workflowstates_workflowstate_workflowactions_confirmaction_initconditionElemID,
      'parameters',
      workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_parameters,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_confirmactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    messagetext: new Field(
      workflow_workflowstates_workflowstate_workflowactions_confirmactionElemID,
      'messagetext',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the string custom type. */
    clienttriggerfieldssublist: new Field(
      workflow_workflowstates_workflowstate_workflowactions_confirmactionElemID,
      'clienttriggerfieldssublist',
      enums.workflow_sublists,
      {
      },
    ), /* Original description: This field is available when the clienttriggerfieldsissublistfield value is equal to T.   This field is mandatory when the clienttriggerfieldsissublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    clienttriggerfieldsissublistfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_confirmactionElemID,
      'clienttriggerfieldsissublistfield',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: This field is available when the triggertype value is present in workflowaction_triggertype_client.   The default value is F. */
    clienttriggerfields: new Field(
      workflow_workflowstates_workflowstate_workflowactions_confirmactionElemID,
      'clienttriggerfields',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    contexttypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_confirmactionElemID,
      'contexttypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: new Field(
      workflow_workflowstates_workflowstate_workflowactions_confirmactionElemID,
      'conditionsavedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_confirmactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    initcondition: new Field(
      workflow_workflowstates_workflowstate_workflowactions_confirmactionElemID,
      'initcondition',
      workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition,
      {
      },
    ),
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
    targetfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings_fieldsettingElemID,
      'targetfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuetext: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings_fieldsettingElemID,
      'valuetext',
      BuiltinTypes.STRING,
      {
      },
    ),
    valuechecked: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings_fieldsettingElemID,
      'valuechecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ),
    valuedate: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings_fieldsettingElemID,
      'valuedate',
      enums.workflowaction_valuedate,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_valuedate. */
    valueselect: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings_fieldsettingElemID,
      'valueselect',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuejoinfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings_fieldsettingElemID,
      'valuejoinfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings_fieldsettingElemID,
      'valuefield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings_fieldsettingElemID,
      'valueformula',
      BuiltinTypes.STRING,
      {
      },
    ),
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
    fieldsetting: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettingsElemID,
      'fieldsetting',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings_fieldsetting),
      {
      },
    ),
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
    name: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parameters_parameterElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    value: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parameters_parameterElemID,
      'value',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parameters_parameterElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
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
    parameter: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parametersElemID,
      'parameter',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parameters_parameter),
      {
      },
    ),
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
    type: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createlineaction_initconditionElemID,
      'type',
      enums.workflow_condition_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_condition_type. */
    formula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createlineaction_initconditionElemID,
      'formula',
      fieldTypes.cdata,
      {
      },
    ),
    parameters: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createlineaction_initconditionElemID,
      'parameters',
      workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_parameters,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createlineactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    sublist: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createlineactionElemID,
      'sublist',
      enums.workflow_sublists,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_sublists.   The default value is 'item'. */
    eventtypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createlineactionElemID,
      'eventtypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createlineactionElemID,
      'contexttypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createlineactionElemID,
      'conditionsavedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createlineactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    position: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createlineactionElemID,
      'position',
      enums.workflowaction_createline_position,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_createline_position.   The default value is 'AFTERLASTLINE'. */
    fieldsettings: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createlineactionElemID,
      'fieldsettings',
      workflow_workflowstates_workflowstate_workflowactions_createlineaction_fieldsettings,
      {
      },
    ),
    initcondition: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createlineactionElemID,
      'initcondition',
      workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition,
      {
      },
    ),
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
    targetfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings_fieldsettingElemID,
      'targetfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuetext: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings_fieldsettingElemID,
      'valuetext',
      BuiltinTypes.STRING,
      {
      },
    ),
    valuechecked: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings_fieldsettingElemID,
      'valuechecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ),
    valuedate: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings_fieldsettingElemID,
      'valuedate',
      enums.workflowaction_valuedate,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_valuedate. */
    valueselect: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings_fieldsettingElemID,
      'valueselect',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuejoinfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings_fieldsettingElemID,
      'valuejoinfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings_fieldsettingElemID,
      'valuefield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings_fieldsettingElemID,
      'valueformula',
      BuiltinTypes.STRING,
      {
      },
    ),
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
    fieldsetting: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettingsElemID,
      'fieldsetting',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings_fieldsetting),
      {
      },
    ),
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
    name: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parameters_parameterElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    value: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parameters_parameterElemID,
      'value',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parameters_parameterElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
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
    parameter: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parametersElemID,
      'parameter',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parameters_parameter),
      {
      },
    ),
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
    type: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initconditionElemID,
      'type',
      enums.workflow_condition_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_condition_type. */
    formula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initconditionElemID,
      'formula',
      fieldTypes.cdata,
      {
      },
    ),
    parameters: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initconditionElemID,
      'parameters',
      workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_parameters,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    recordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordactionElemID,
      'recordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   customtransactiontype   customrecordtype   For information about other possible values, see generic_standard_recordtype. */
    eventtypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordactionElemID,
      'eventtypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordactionElemID,
      'contexttypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordactionElemID,
      'conditionsavedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    scheduledelay: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordactionElemID,
      'scheduledelay',
      BuiltinTypes.NUMBER,
      {
      },
    ),
    scheduletimeofday: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordactionElemID,
      'scheduletimeofday',
      BuiltinTypes.STRING,
      {
      },
    ),
    schedulerecurrence: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordactionElemID,
      'schedulerecurrence',
      BuiltinTypes.NUMBER,
      {
      },
    ),
    scheduletimeunit: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordactionElemID,
      'scheduletimeunit',
      enums.workflow_timeunit,
      {
      },
    ), /* Original description: For information about possible values, see workflow_timeunit. */
    schedulemode: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordactionElemID,
      'schedulemode',
      enums.workflowaction_radioschedulemode,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    resultfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordactionElemID,
      'resultfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    fieldsettings: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordactionElemID,
      'fieldsettings',
      workflow_workflowstates_workflowstate_workflowactions_createrecordaction_fieldsettings,
      {
      },
    ),
    initcondition: new Field(
      workflow_workflowstates_workflowstate_workflowactions_createrecordactionElemID,
      'initcondition',
      workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition,
      {
      },
    ),
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
    name: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parameters_parameterElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    value: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parameters_parameterElemID,
      'value',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parameters_parameterElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
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
    parameter: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parametersElemID,
      'parameter',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parameters_parameter),
      {
      },
    ),
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
    type: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customaction_initconditionElemID,
      'type',
      enums.workflow_condition_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_condition_type. */
    formula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customaction_initconditionElemID,
      'formula',
      fieldTypes.cdata,
      {
      },
    ),
    parameters: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customaction_initconditionElemID,
      'parameters',
      workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_parameters,
      {
      },
    ),
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
    targetparameter: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings_parametersettingElemID,
      'targetparameter',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuetext: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings_parametersettingElemID,
      'valuetext',
      BuiltinTypes.STRING,
      {
      },
    ),
    valuechecked: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings_parametersettingElemID,
      'valuechecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ),
    valuedate: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings_parametersettingElemID,
      'valuedate',
      enums.workflowaction_valuedate,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_valuedate. */
    valueselect: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings_parametersettingElemID,
      'valueselect',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuejoinfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings_parametersettingElemID,
      'valuejoinfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings_parametersettingElemID,
      'valuefield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings_parametersettingElemID,
      'valueformula',
      BuiltinTypes.STRING,
      {
      },
    ),
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
    parametersetting: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettingsElemID,
      'parametersetting',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings_parametersetting),
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    scripttype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customactionElemID,
      'scripttype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the workflowactionscript custom type. */
    eventtypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customactionElemID,
      'eventtypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customactionElemID,
      'contexttypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customactionElemID,
      'conditionsavedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    scheduledelay: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customactionElemID,
      'scheduledelay',
      BuiltinTypes.NUMBER,
      {
      },
    ),
    scheduletimeofday: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customactionElemID,
      'scheduletimeofday',
      BuiltinTypes.STRING,
      {
      },
    ),
    schedulerecurrence: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customactionElemID,
      'schedulerecurrence',
      BuiltinTypes.NUMBER,
      {
      },
    ),
    scheduletimeunit: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customactionElemID,
      'scheduletimeunit',
      enums.workflow_timeunit,
      {
      },
    ), /* Original description: For information about possible values, see workflow_timeunit. */
    schedulemode: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customactionElemID,
      'schedulemode',
      enums.workflowaction_radioschedulemode,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    resultfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customactionElemID,
      'resultfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    initcondition: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customactionElemID,
      'initcondition',
      workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition,
      {
      },
    ),
    parametersettings: new Field(
      workflow_workflowstates_workflowstate_workflowactions_customactionElemID,
      'parametersettings',
      workflow_workflowstates_workflowstate_workflowactions_customaction_parametersettings,
      {
      },
    ),
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
    name: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parameters_parameterElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    value: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parameters_parameterElemID,
      'value',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parameters_parameterElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
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
    parameter: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parametersElemID,
      'parameter',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parameters_parameter),
      {
      },
    ),
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
    type: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initconditionElemID,
      'type',
      enums.workflow_condition_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_condition_type. */
    formula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initconditionElemID,
      'formula',
      fieldTypes.cdata,
      {
      },
    ),
    parameters: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initconditionElemID,
      'parameters',
      workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_parameters,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotopageactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    targetpage: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotopageactionElemID,
      'targetpage',
      enums.generic_standard_task,
      {
      },
    ), /* Original description: This field is mandatory when the targetpageobject value is not defined.   For information about possible values, see generic_standard_task. */
    targetpageobject: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotopageactionElemID,
      'targetpageobject',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is mandatory when the targetpage value is not defined.   This field accepts references to the following custom types:   workflowactionscript   usereventscript   scriptdeployment   suitelet   scheduledscript   savedsearch   restlet   portlet   massupdatescript   mapreducescript   customrecordtype   clientscript   centertab   bundleinstallationscript */
    targetpagetasktype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotopageactionElemID,
      'targetpagetasktype',
      enums.centercategory_tasktype,
      {
      },
    ), /* Original description: This field is mandatory when the targetpageobject value is defined.   For information about possible values, see centercategory_tasktype. */
    eventtypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotopageactionElemID,
      'eventtypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotopageactionElemID,
      'contexttypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotopageactionElemID,
      'conditionsavedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotopageactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    initcondition: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotopageactionElemID,
      'initcondition',
      workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition,
      {
      },
    ),
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
    targetfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings_fieldsettingElemID,
      'targetfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuetext: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings_fieldsettingElemID,
      'valuetext',
      BuiltinTypes.STRING,
      {
      },
    ),
    valuechecked: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings_fieldsettingElemID,
      'valuechecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ),
    valuedate: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings_fieldsettingElemID,
      'valuedate',
      enums.workflowaction_valuedate,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_valuedate. */
    valueselect: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings_fieldsettingElemID,
      'valueselect',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuejoinfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings_fieldsettingElemID,
      'valuejoinfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings_fieldsettingElemID,
      'valuefield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings_fieldsettingElemID,
      'valueformula',
      BuiltinTypes.STRING,
      {
      },
    ),
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
    fieldsetting: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettingsElemID,
      'fieldsetting',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings_fieldsetting),
      {
      },
    ),
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
    name: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parameters_parameterElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    value: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parameters_parameterElemID,
      'value',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parameters_parameterElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
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
    parameter: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parametersElemID,
      'parameter',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parameters_parameter),
      {
      },
    ),
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
    type: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initconditionElemID,
      'type',
      enums.workflow_condition_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_condition_type. */
    formula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initconditionElemID,
      'formula',
      fieldTypes.cdata,
      {
      },
    ),
    parameters: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initconditionElemID,
      'parameters',
      workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_parameters,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotorecordactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    recordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotorecordactionElemID,
      'recordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   customtransactiontype   customrecordtype   For information about other possible values, see generic_standard_recordtype. */
    eventtypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotorecordactionElemID,
      'eventtypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotorecordactionElemID,
      'contexttypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotorecordactionElemID,
      'conditionsavedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotorecordactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    recordidfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotorecordactionElemID,
      'recordidfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    recordidjoinfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotorecordactionElemID,
      'recordidjoinfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    ineditmode: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotorecordactionElemID,
      'ineditmode',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fieldsettings: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotorecordactionElemID,
      'fieldsettings',
      workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_fieldsettings,
      {
      },
    ),
    initcondition: new Field(
      workflow_workflowstates_workflowstate_workflowactions_gotorecordactionElemID,
      'initcondition',
      workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition,
      {
      },
    ),
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
    name: new Field(
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parameters_parameterElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    value: new Field(
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parameters_parameterElemID,
      'value',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parameters_parameterElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
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
    parameter: new Field(
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parametersElemID,
      'parameter',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parameters_parameter),
      {
      },
    ),
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
    type: new Field(
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initconditionElemID,
      'type',
      enums.workflow_condition_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_condition_type. */
    formula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initconditionElemID,
      'formula',
      fieldTypes.cdata,
      {
      },
    ),
    parameters: new Field(
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initconditionElemID,
      'parameters',
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_parameters,
      {
      },
    ),
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
    targetworkflowfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings_workflowfieldsettingElemID,
      'targetworkflowfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuetext: new Field(
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings_workflowfieldsettingElemID,
      'valuetext',
      BuiltinTypes.STRING,
      {
      },
    ),
    valuechecked: new Field(
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings_workflowfieldsettingElemID,
      'valuechecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ),
    valuedate: new Field(
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings_workflowfieldsettingElemID,
      'valuedate',
      enums.workflowaction_valuedate,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_valuedate. */
    valueselect: new Field(
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings_workflowfieldsettingElemID,
      'valueselect',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuejoinfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings_workflowfieldsettingElemID,
      'valuejoinfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings_workflowfieldsettingElemID,
      'valuefield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings_workflowfieldsettingElemID,
      'valueformula',
      BuiltinTypes.STRING,
      {
      },
    ),
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
    workflowfieldsetting: new Field(
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettingsElemID,
      'workflowfieldsetting',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings_workflowfieldsetting),
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    initiatedworkflow: new Field(
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowactionElemID,
      'initiatedworkflow',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the workflow custom type. */
    eventtypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowactionElemID,
      'eventtypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowactionElemID,
      'contexttypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: new Field(
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowactionElemID,
      'conditionsavedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    scheduledelay: new Field(
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowactionElemID,
      'scheduledelay',
      BuiltinTypes.NUMBER,
      {
      },
    ),
    scheduletimeofday: new Field(
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowactionElemID,
      'scheduletimeofday',
      BuiltinTypes.STRING,
      {
      },
    ),
    schedulerecurrence: new Field(
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowactionElemID,
      'schedulerecurrence',
      BuiltinTypes.NUMBER,
      {
      },
    ),
    scheduletimeunit: new Field(
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowactionElemID,
      'scheduletimeunit',
      enums.workflow_timeunit,
      {
      },
    ), /* Original description: For information about possible values, see workflow_timeunit. */
    schedulemode: new Field(
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowactionElemID,
      'schedulemode',
      enums.workflowaction_radioschedulemode,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    initcondition: new Field(
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowactionElemID,
      'initcondition',
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition,
      {
      },
    ),
    workflowfieldsettings: new Field(
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowactionElemID,
      'workflowfieldsettings',
      workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_workflowfieldsettings,
      {
      },
    ),
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
    name: new Field(
      workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parameters_parameterElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    value: new Field(
      workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parameters_parameterElemID,
      'value',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parameters_parameterElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
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
    parameter: new Field(
      workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parametersElemID,
      'parameter',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parameters_parameter),
      {
      },
    ),
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
    type: new Field(
      workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initconditionElemID,
      'type',
      enums.workflow_condition_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_condition_type. */
    formula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initconditionElemID,
      'formula',
      fieldTypes.cdata,
      {
      },
    ),
    parameters: new Field(
      workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initconditionElemID,
      'parameters',
      workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_parameters,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_lockrecordactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    eventtypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_lockrecordactionElemID,
      'eventtypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_lockrecordactionElemID,
      'contexttypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: new Field(
      workflow_workflowstates_workflowstate_workflowactions_lockrecordactionElemID,
      'conditionsavedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_lockrecordactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    initcondition: new Field(
      workflow_workflowstates_workflowstate_workflowactions_lockrecordactionElemID,
      'initcondition',
      workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition,
      {
      },
    ),
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
    name: new Field(
      workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parameters_parameterElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    value: new Field(
      workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parameters_parameterElemID,
      'value',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parameters_parameterElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
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
    parameter: new Field(
      workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parametersElemID,
      'parameter',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parameters_parameter),
      {
      },
    ),
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
    type: new Field(
      workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initconditionElemID,
      'type',
      enums.workflow_condition_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_condition_type. */
    formula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initconditionElemID,
      'formula',
      fieldTypes.cdata,
      {
      },
    ),
    parameters: new Field(
      workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initconditionElemID,
      'parameters',
      workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_parameters,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_removebuttonactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    buttonid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_removebuttonactionElemID,
      'buttonid',
      enums.workflowaction_buttonid,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflowaction_buttonid. */
    eventtypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_removebuttonactionElemID,
      'eventtypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_removebuttonactionElemID,
      'contexttypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: new Field(
      workflow_workflowstates_workflowstate_workflowactions_removebuttonactionElemID,
      'conditionsavedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_removebuttonactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    initcondition: new Field(
      workflow_workflowstates_workflowstate_workflowactions_removebuttonactionElemID,
      'initcondition',
      workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition,
      {
      },
    ),
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
    name: new Field(
      workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parameters_parameterElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    value: new Field(
      workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parameters_parameterElemID,
      'value',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parameters_parameterElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
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
    parameter: new Field(
      workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parametersElemID,
      'parameter',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parameters_parameter),
      {
      },
    ),
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
    type: new Field(
      workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initconditionElemID,
      'type',
      enums.workflow_condition_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_condition_type. */
    formula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initconditionElemID,
      'formula',
      fieldTypes.cdata,
      {
      },
    ),
    parameters: new Field(
      workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initconditionElemID,
      'parameters',
      workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_parameters,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_returnusererroractionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    errortext: new Field(
      workflow_workflowstates_workflowstate_workflowactions_returnusererroractionElemID,
      'errortext',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the string custom type. */
    clienttriggerfieldssublist: new Field(
      workflow_workflowstates_workflowstate_workflowactions_returnusererroractionElemID,
      'clienttriggerfieldssublist',
      enums.workflow_sublists,
      {
      },
    ), /* Original description: This field is available when the clienttriggerfieldsissublistfield value is equal to T.   This field is mandatory when the clienttriggerfieldsissublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    clienttriggerfieldsissublistfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_returnusererroractionElemID,
      'clienttriggerfieldsissublistfield',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: This field is available when the triggertype value is present in workflowaction_triggertype_client.   The default value is F. */
    clienttriggerfields: new Field(
      workflow_workflowstates_workflowstate_workflowactions_returnusererroractionElemID,
      'clienttriggerfields',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    eventtypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_returnusererroractionElemID,
      'eventtypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_returnusererroractionElemID,
      'contexttypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: new Field(
      workflow_workflowstates_workflowstate_workflowactions_returnusererroractionElemID,
      'conditionsavedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_returnusererroractionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    initcondition: new Field(
      workflow_workflowstates_workflowstate_workflowactions_returnusererroractionElemID,
      'initcondition',
      workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition,
      {
      },
    ),
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
    name: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parameters_parameterElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    value: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parameters_parameterElemID,
      'value',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parameters_parameterElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
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
    parameter: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parametersElemID,
      'parameter',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parameters_parameter),
      {
      },
    ),
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
    type: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initconditionElemID,
      'type',
      enums.workflow_condition_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_condition_type. */
    formula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initconditionElemID,
      'formula',
      fieldTypes.cdata,
      {
      },
    ),
    parameters: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initconditionElemID,
      'parameters',
      workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_parameters,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    recipientfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailactionElemID,
      'recipientfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    eventtypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailactionElemID,
      'eventtypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailactionElemID,
      'contexttypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailactionElemID,
      'conditionsavedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    scheduledelay: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailactionElemID,
      'scheduledelay',
      BuiltinTypes.NUMBER,
      {
      },
    ),
    scheduletimeofday: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailactionElemID,
      'scheduletimeofday',
      BuiltinTypes.STRING,
      {
      },
    ),
    schedulerecurrence: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailactionElemID,
      'schedulerecurrence',
      BuiltinTypes.NUMBER,
      {
      },
    ),
    scheduletimeunit: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailactionElemID,
      'scheduletimeunit',
      enums.workflow_timeunit,
      {
      },
    ), /* Original description: For information about possible values, see workflow_timeunit. */
    schedulemode: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailactionElemID,
      'schedulemode',
      enums.workflowaction_radioschedulemode,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    resultfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailactionElemID,
      'resultfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    recipientiscurrentrecord: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailactionElemID,
      'recipientiscurrentrecord',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    recipientjoinfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailactionElemID,
      'recipientjoinfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    campaignevent: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailactionElemID,
      'campaignevent',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: Note Account-specific values are not supported by SDF. */
    initcondition: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailactionElemID,
      'initcondition',
      workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition,
      {
      },
    ),
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
    name: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parameters_parameterElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    value: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parameters_parameterElemID,
      'value',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parameters_parameterElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
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
    parameter: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parametersElemID,
      'parameter',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parameters_parameter),
      {
      },
    ),
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
    type: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initconditionElemID,
      'type',
      enums.workflow_condition_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_condition_type. */
    formula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initconditionElemID,
      'formula',
      fieldTypes.cdata,
      {
      },
    ),
    parameters: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initconditionElemID,
      'parameters',
      workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_parameters,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    sendertype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'sendertype',
      enums.workflowaction_sendertype,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflowaction_sendertype. */
    recipienttype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'recipienttype',
      enums.workflowaction_recipienttype,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflowaction_recipienttype. */
    sender: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'sender',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: This field is mandatory when the sendertype value is equal to SPECIFIC.   Note Account-specific values are not supported by SDF. */
    senderfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'senderfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is mandatory when the sendertype value is equal to FIELD.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    recipient: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'recipient',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: This field is mandatory when the recipienttype value is equal to SPECIFIC.   Note Account-specific values are not supported by SDF. */
    recipientemail: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'recipientemail',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: This field is mandatory when the recipienttype value is equal to ADDRESS. */
    recipientfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'recipientfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is mandatory when the recipienttype value is equal to FIELD.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    template: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'template',
      enums.generic_standard_template,
      {
      },
    ), /* Original description: This field is mandatory when the usetemplate value is equal to T.   For information about possible values, see generic_standard_template. */
    eventtypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'eventtypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'contexttypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'conditionsavedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    scheduledelay: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'scheduledelay',
      BuiltinTypes.NUMBER,
      {
      },
    ),
    scheduletimeofday: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'scheduletimeofday',
      BuiltinTypes.STRING,
      {
      },
    ),
    schedulerecurrence: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'schedulerecurrence',
      BuiltinTypes.NUMBER,
      {
      },
    ),
    scheduletimeunit: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'scheduletimeunit',
      enums.workflow_timeunit,
      {
      },
    ), /* Original description: For information about possible values, see workflow_timeunit. */
    schedulemode: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'schedulemode',
      enums.workflowaction_radioschedulemode,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    senderjoinfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'senderjoinfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    recipientjoinfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'recipientjoinfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    recipientccemail: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'recipientccemail',
      BuiltinTypes.STRING,
      {
      },
    ),
    recipientbccemail: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'recipientbccemail',
      BuiltinTypes.STRING,
      {
      },
    ),
    usetemplate: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'usetemplate',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    subject: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'subject',
      BuiltinTypes.STRING,
      {
      },
    ),
    body: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'body',
      BuiltinTypes.STRING,
      {
      },
    ),
    includerecordlink: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'includerecordlink',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    attachmenttype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'attachmenttype',
      enums.workflowaction_attachmenttype,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_attachmenttype. */
    attachmentfile: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'attachmentfile',
      BuiltinTypes.STRING /* Original type was filereference */,
      {
      },
    ),
    attachmentjoinfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'attachmentjoinfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    attachmentfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'attachmentfield',
      enums.generic_standard_field,
      {
      },
    ), /* Original description: For information about possible values, see generic_standard_field. */
    includetransaction: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'includetransaction',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    includeformat: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'includeformat',
      enums.workflowaction_transtatementtype,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_transtatementtype. */
    initcondition: new Field(
      workflow_workflowstates_workflowstate_workflowactions_sendemailactionElemID,
      'initcondition',
      workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition,
      {
      },
    ),
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
    name: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parameters_parameterElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    value: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parameters_parameterElemID,
      'value',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parameters_parameterElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
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
    parameter: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parametersElemID,
      'parameter',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parameters_parameter),
      {
      },
    ),
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
    type: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initconditionElemID,
      'type',
      enums.workflow_condition_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_condition_type. */
    formula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initconditionElemID,
      'formula',
      fieldTypes.cdata,
      {
      },
    ),
    parameters: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initconditionElemID,
      'parameters',
      workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_parameters,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    clienttriggerfieldssublist: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelactionElemID,
      'clienttriggerfieldssublist',
      enums.workflow_sublists,
      {
      },
    ), /* Original description: This field is available when the clienttriggerfieldsissublistfield value is equal to T.   This field is mandatory when the clienttriggerfieldsissublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    sublist: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelactionElemID,
      'sublist',
      enums.workflow_sublists,
      {
      },
    ), /* Original description: This field is available when the issublistfield value is equal to T.   This field is mandatory when the issublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    clienttriggerfieldsissublistfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelactionElemID,
      'clienttriggerfieldsissublistfield',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: This field is available when the triggertype value is present in workflowaction_triggertype_client.   The default value is F. */
    clienttriggerfields: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelactionElemID,
      'clienttriggerfields',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    eventtypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelactionElemID,
      'eventtypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelactionElemID,
      'contexttypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelactionElemID,
      'conditionsavedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    field: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelactionElemID,
      'field',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    issublistfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelactionElemID,
      'issublistfield',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    displaylabel: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelactionElemID,
      'displaylabel',
      BuiltinTypes.STRING,
      {
      },
    ),
    initcondition: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelactionElemID,
      'initcondition',
      workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition,
      {
      },
    ),
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
    name: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parameters_parameterElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    value: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parameters_parameterElemID,
      'value',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parameters_parameterElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
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
    parameter: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parametersElemID,
      'parameter',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parameters_parameter),
      {
      },
    ),
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
    type: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initconditionElemID,
      'type',
      enums.workflow_condition_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_condition_type. */
    formula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initconditionElemID,
      'formula',
      fieldTypes.cdata,
      {
      },
    ),
    parameters: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initconditionElemID,
      'parameters',
      workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_parameters,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    displaytype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeactionElemID,
      'displaytype',
      enums.workflowaction_displaytype,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflowaction_displaytype. */
    clienttriggerfieldssublist: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeactionElemID,
      'clienttriggerfieldssublist',
      enums.workflow_sublists,
      {
      },
    ), /* Original description: This field is available when the clienttriggerfieldsissublistfield value is equal to T.   This field is mandatory when the clienttriggerfieldsissublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    sublist: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeactionElemID,
      'sublist',
      enums.workflow_sublists,
      {
      },
    ), /* Original description: This field is available when the issublistfield value is equal to T.   This field is mandatory when the issublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    clienttriggerfieldsissublistfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeactionElemID,
      'clienttriggerfieldsissublistfield',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: This field is available when the triggertype value is present in workflowaction_triggertype_client.   The default value is F. */
    clienttriggerfields: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeactionElemID,
      'clienttriggerfields',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    eventtypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeactionElemID,
      'eventtypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeactionElemID,
      'contexttypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeactionElemID,
      'conditionsavedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    field: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeactionElemID,
      'field',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    issublistfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeactionElemID,
      'issublistfield',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    initcondition: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeactionElemID,
      'initcondition',
      workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition,
      {
      },
    ),
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
    name: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parameters_parameterElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    value: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parameters_parameterElemID,
      'value',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parameters_parameterElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
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
    parameter: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parametersElemID,
      'parameter',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parameters_parameter),
      {
      },
    ),
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
    type: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initconditionElemID,
      'type',
      enums.workflow_condition_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_condition_type. */
    formula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initconditionElemID,
      'formula',
      fieldTypes.cdata,
      {
      },
    ),
    parameters: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initconditionElemID,
      'parameters',
      workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_parameters,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    clienttriggerfieldssublist: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryactionElemID,
      'clienttriggerfieldssublist',
      enums.workflow_sublists,
      {
      },
    ), /* Original description: This field is available when the clienttriggerfieldsissublistfield value is equal to T.   This field is mandatory when the clienttriggerfieldsissublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    sublist: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryactionElemID,
      'sublist',
      enums.workflow_sublists,
      {
      },
    ), /* Original description: This field is available when the issublistfield value is equal to T.   This field is mandatory when the issublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    clienttriggerfieldsissublistfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryactionElemID,
      'clienttriggerfieldsissublistfield',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: This field is available when the triggertype value is present in workflowaction_triggertype_client.   The default value is F. */
    clienttriggerfields: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryactionElemID,
      'clienttriggerfields',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    eventtypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryactionElemID,
      'eventtypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryactionElemID,
      'contexttypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryactionElemID,
      'conditionsavedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    field: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryactionElemID,
      'field',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    issublistfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryactionElemID,
      'issublistfield',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    ismandatory: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryactionElemID,
      'ismandatory',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    initcondition: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryactionElemID,
      'initcondition',
      workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition,
      {
      },
    ),
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
    name: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parameters_parameterElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    value: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parameters_parameterElemID,
      'value',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parameters_parameterElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
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
    parameter: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parametersElemID,
      'parameter',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parameters_parameter),
      {
      },
    ),
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
    type: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initconditionElemID,
      'type',
      enums.workflow_condition_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_condition_type. */
    formula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initconditionElemID,
      'formula',
      fieldTypes.cdata,
      {
      },
    ),
    parameters: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initconditionElemID,
      'parameters',
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_parameters,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    field: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueactionElemID,
      'field',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    clienttriggerfieldssublist: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueactionElemID,
      'clienttriggerfieldssublist',
      enums.workflow_sublists,
      {
      },
    ), /* Original description: This field is available when the clienttriggerfieldsissublistfield value is equal to T.   This field is mandatory when the clienttriggerfieldsissublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    clienttriggerfieldsissublistfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueactionElemID,
      'clienttriggerfieldsissublistfield',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: This field is available when the triggertype value is present in workflowaction_triggertype_client.   The default value is F. */
    clienttriggerfields: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueactionElemID,
      'clienttriggerfields',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    eventtypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueactionElemID,
      'eventtypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueactionElemID,
      'contexttypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueactionElemID,
      'conditionsavedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    scheduledelay: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueactionElemID,
      'scheduledelay',
      BuiltinTypes.NUMBER,
      {
      },
    ),
    scheduletimeofday: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueactionElemID,
      'scheduletimeofday',
      BuiltinTypes.STRING,
      {
      },
    ),
    schedulerecurrence: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueactionElemID,
      'schedulerecurrence',
      BuiltinTypes.NUMBER,
      {
      },
    ),
    scheduletimeunit: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueactionElemID,
      'scheduletimeunit',
      enums.workflow_timeunit,
      {
      },
    ), /* Original description: For information about possible values, see workflow_timeunit. */
    schedulemode: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueactionElemID,
      'schedulemode',
      enums.workflowaction_radioschedulemode,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    valuetype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueactionElemID,
      'valuetype',
      enums.workflowaction_valuetype,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_valuetype. */
    valuetext: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueactionElemID,
      'valuetext',
      BuiltinTypes.STRING,
      {
      },
    ),
    valuechecked: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueactionElemID,
      'valuechecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    valueselect: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueactionElemID,
      'valueselect',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuemultiselect: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueactionElemID,
      'valuemultiselect',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuedate: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueactionElemID,
      'valuedate',
      enums.workflowaction_valuedate,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_valuedate. */
    valuejoinfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueactionElemID,
      'valuejoinfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueactionElemID,
      'valuefield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueactionElemID,
      'valueformula',
      BuiltinTypes.STRING,
      {
      },
    ),
    initcondition: new Field(
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueactionElemID,
      'initcondition',
      workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition,
      {
      },
    ),
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
    name: new Field(
      workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parameters_parameterElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    value: new Field(
      workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parameters_parameterElemID,
      'value',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parameters_parameterElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
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
    parameter: new Field(
      workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parametersElemID,
      'parameter',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parameters_parameter),
      {
      },
    ),
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
    type: new Field(
      workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initconditionElemID,
      'type',
      enums.workflow_condition_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_condition_type. */
    formula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initconditionElemID,
      'formula',
      fieldTypes.cdata,
      {
      },
    ),
    parameters: new Field(
      workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initconditionElemID,
      'parameters',
      workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_parameters,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_showmessageactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    messagetext: new Field(
      workflow_workflowstates_workflowstate_workflowactions_showmessageactionElemID,
      'messagetext',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the string custom type. */
    clienttriggerfieldssublist: new Field(
      workflow_workflowstates_workflowstate_workflowactions_showmessageactionElemID,
      'clienttriggerfieldssublist',
      enums.workflow_sublists,
      {
      },
    ), /* Original description: This field is available when the clienttriggerfieldsissublistfield value is equal to T.   This field is mandatory when the clienttriggerfieldsissublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    clienttriggerfieldsissublistfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_showmessageactionElemID,
      'clienttriggerfieldsissublistfield',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: This field is available when the triggertype value is present in workflowaction_triggertype_client.   The default value is F. */
    clienttriggerfields: new Field(
      workflow_workflowstates_workflowstate_workflowactions_showmessageactionElemID,
      'clienttriggerfields',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    contexttypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_showmessageactionElemID,
      'contexttypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: new Field(
      workflow_workflowstates_workflowstate_workflowactions_showmessageactionElemID,
      'conditionsavedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_showmessageactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    initcondition: new Field(
      workflow_workflowstates_workflowstate_workflowactions_showmessageactionElemID,
      'initcondition',
      workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition,
      {
      },
    ),
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
    name: new Field(
      workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parameters_parameterElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    value: new Field(
      workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parameters_parameterElemID,
      'value',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parameters_parameterElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
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
    parameter: new Field(
      workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parametersElemID,
      'parameter',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parameters_parameter),
      {
      },
    ),
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
    type: new Field(
      workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initconditionElemID,
      'type',
      enums.workflow_condition_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_condition_type. */
    formula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initconditionElemID,
      'formula',
      fieldTypes.cdata,
      {
      },
    ),
    parameters: new Field(
      workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initconditionElemID,
      'parameters',
      workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_parameters,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_subscribetorecordactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    eventtypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_subscribetorecordactionElemID,
      'eventtypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_subscribetorecordactionElemID,
      'contexttypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: new Field(
      workflow_workflowstates_workflowstate_workflowactions_subscribetorecordactionElemID,
      'conditionsavedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    scheduledelay: new Field(
      workflow_workflowstates_workflowstate_workflowactions_subscribetorecordactionElemID,
      'scheduledelay',
      BuiltinTypes.NUMBER,
      {
      },
    ),
    scheduletimeofday: new Field(
      workflow_workflowstates_workflowstate_workflowactions_subscribetorecordactionElemID,
      'scheduletimeofday',
      BuiltinTypes.STRING,
      {
      },
    ),
    schedulerecurrence: new Field(
      workflow_workflowstates_workflowstate_workflowactions_subscribetorecordactionElemID,
      'schedulerecurrence',
      BuiltinTypes.NUMBER,
      {
      },
    ),
    scheduletimeunit: new Field(
      workflow_workflowstates_workflowstate_workflowactions_subscribetorecordactionElemID,
      'scheduletimeunit',
      enums.workflow_timeunit,
      {
      },
    ), /* Original description: For information about possible values, see workflow_timeunit. */
    schedulemode: new Field(
      workflow_workflowstates_workflowstate_workflowactions_subscribetorecordactionElemID,
      'schedulemode',
      enums.workflowaction_radioschedulemode,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_subscribetorecordactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    recordfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_subscribetorecordactionElemID,
      'recordfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    initcondition: new Field(
      workflow_workflowstates_workflowstate_workflowactions_subscribetorecordactionElemID,
      'initcondition',
      workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition,
      {
      },
    ),
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
    targetfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings_fieldsettingElemID,
      'targetfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuetext: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings_fieldsettingElemID,
      'valuetext',
      BuiltinTypes.STRING,
      {
      },
    ),
    valuechecked: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings_fieldsettingElemID,
      'valuechecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ),
    valuedate: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings_fieldsettingElemID,
      'valuedate',
      enums.workflowaction_valuedate,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_valuedate. */
    valueselect: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings_fieldsettingElemID,
      'valueselect',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuejoinfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings_fieldsettingElemID,
      'valuejoinfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings_fieldsettingElemID,
      'valuefield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings_fieldsettingElemID,
      'valueformula',
      BuiltinTypes.STRING,
      {
      },
    ),
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
    fieldsetting: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettingsElemID,
      'fieldsetting',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings_fieldsetting),
      {
      },
    ),
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
    name: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parameters_parameterElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    value: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parameters_parameterElemID,
      'value',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parameters_parameterElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
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
    parameter: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parametersElemID,
      'parameter',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parameters_parameter),
      {
      },
    ),
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
    type: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initconditionElemID,
      'type',
      enums.workflow_condition_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_condition_type. */
    formula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initconditionElemID,
      'formula',
      fieldTypes.cdata,
      {
      },
    ),
    parameters: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initconditionElemID,
      'parameters',
      workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_parameters,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    recordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordactionElemID,
      'recordtype',
      enums.generic_standard_recordtype,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_standard_recordtype. */
    eventtypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordactionElemID,
      'eventtypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordactionElemID,
      'contexttypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordactionElemID,
      'conditionsavedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    scheduledelay: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordactionElemID,
      'scheduledelay',
      BuiltinTypes.NUMBER,
      {
      },
    ),
    scheduletimeofday: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordactionElemID,
      'scheduletimeofday',
      BuiltinTypes.STRING,
      {
      },
    ),
    schedulerecurrence: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordactionElemID,
      'schedulerecurrence',
      BuiltinTypes.NUMBER,
      {
      },
    ),
    scheduletimeunit: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordactionElemID,
      'scheduletimeunit',
      enums.workflow_timeunit,
      {
      },
    ), /* Original description: For information about possible values, see workflow_timeunit. */
    schedulemode: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordactionElemID,
      'schedulemode',
      enums.workflowaction_radioschedulemode,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    resultfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordactionElemID,
      'resultfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    fieldsettings: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordactionElemID,
      'fieldsettings',
      workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_fieldsettings,
      {
      },
    ),
    initcondition: new Field(
      workflow_workflowstates_workflowstate_workflowactions_transformrecordactionElemID,
      'initcondition',
      workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_addbuttonactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    label: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_addbuttonactionElemID,
      'label',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the string custom type. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_addbuttonactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    saverecordfirst: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_addbuttonactionElemID,
      'saverecordfirst',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    checkconditionbeforeexecution: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_addbuttonactionElemID,
      'checkconditionbeforeexecution',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
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
    targetfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings_fieldsettingElemID,
      'targetfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuetext: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings_fieldsettingElemID,
      'valuetext',
      BuiltinTypes.STRING,
      {
      },
    ),
    valuechecked: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings_fieldsettingElemID,
      'valuechecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ),
    valuedate: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings_fieldsettingElemID,
      'valuedate',
      enums.workflowaction_valuedate,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_valuedate. */
    valueselect: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings_fieldsettingElemID,
      'valueselect',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuejoinfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings_fieldsettingElemID,
      'valuejoinfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings_fieldsettingElemID,
      'valuefield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings_fieldsettingElemID,
      'valueformula',
      BuiltinTypes.STRING,
      {
      },
    ),
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
    fieldsetting: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettingsElemID,
      'fieldsetting',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings_fieldsetting),
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    sublist: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineactionElemID,
      'sublist',
      enums.workflow_sublists,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_sublists.   The default value is 'item'. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    position: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineactionElemID,
      'position',
      enums.workflowaction_createline_position,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_createline_position.   The default value is 'AFTERLASTLINE'. */
    fieldsettings: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineactionElemID,
      'fieldsettings',
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction_fieldsettings,
      {
      },
    ),
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
    targetfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings_fieldsettingElemID,
      'targetfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuetext: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings_fieldsettingElemID,
      'valuetext',
      BuiltinTypes.STRING,
      {
      },
    ),
    valuechecked: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings_fieldsettingElemID,
      'valuechecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ),
    valuedate: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings_fieldsettingElemID,
      'valuedate',
      enums.workflowaction_valuedate,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_valuedate. */
    valueselect: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings_fieldsettingElemID,
      'valueselect',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuejoinfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings_fieldsettingElemID,
      'valuejoinfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings_fieldsettingElemID,
      'valuefield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings_fieldsettingElemID,
      'valueformula',
      BuiltinTypes.STRING,
      {
      },
    ),
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
    fieldsetting: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettingsElemID,
      'fieldsetting',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings_fieldsetting),
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    recordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordactionElemID,
      'recordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   customtransactiontype   customrecordtype   For information about other possible values, see generic_standard_recordtype. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    resultfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordactionElemID,
      'resultfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    fieldsettings: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordactionElemID,
      'fieldsettings',
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction_fieldsettings,
      {
      },
    ),
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
    targetparameter: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings_parametersettingElemID,
      'targetparameter',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuetext: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings_parametersettingElemID,
      'valuetext',
      BuiltinTypes.STRING,
      {
      },
    ),
    valuechecked: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings_parametersettingElemID,
      'valuechecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ),
    valuedate: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings_parametersettingElemID,
      'valuedate',
      enums.workflowaction_valuedate,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_valuedate. */
    valueselect: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings_parametersettingElemID,
      'valueselect',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuejoinfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings_parametersettingElemID,
      'valuejoinfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings_parametersettingElemID,
      'valuefield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings_parametersettingElemID,
      'valueformula',
      BuiltinTypes.STRING,
      {
      },
    ),
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
    parametersetting: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettingsElemID,
      'parametersetting',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings_parametersetting),
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    scripttype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customactionElemID,
      'scripttype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the workflowactionscript custom type. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    resultfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customactionElemID,
      'resultfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    parametersettings: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customactionElemID,
      'parametersettings',
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction_parametersettings,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotopageactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    targetpage: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotopageactionElemID,
      'targetpage',
      enums.generic_standard_task,
      {
      },
    ), /* Original description: This field is mandatory when the targetpageobject value is not defined.   For information about possible values, see generic_standard_task. */
    targetpageobject: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotopageactionElemID,
      'targetpageobject',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is mandatory when the targetpage value is not defined.   This field accepts references to the following custom types:   workflowactionscript   usereventscript   scriptdeployment   suitelet   scheduledscript   savedsearch   restlet   portlet   massupdatescript   mapreducescript   customrecordtype   clientscript   centertab   bundleinstallationscript */
    targetpagetasktype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotopageactionElemID,
      'targetpagetasktype',
      enums.centercategory_tasktype,
      {
      },
    ), /* Original description: This field is mandatory when the targetpageobject value is defined.   For information about possible values, see centercategory_tasktype. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotopageactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
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
    targetfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings_fieldsettingElemID,
      'targetfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuetext: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings_fieldsettingElemID,
      'valuetext',
      BuiltinTypes.STRING,
      {
      },
    ),
    valuechecked: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings_fieldsettingElemID,
      'valuechecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ),
    valuedate: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings_fieldsettingElemID,
      'valuedate',
      enums.workflowaction_valuedate,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_valuedate. */
    valueselect: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings_fieldsettingElemID,
      'valueselect',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuejoinfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings_fieldsettingElemID,
      'valuejoinfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings_fieldsettingElemID,
      'valuefield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings_fieldsettingElemID,
      'valueformula',
      BuiltinTypes.STRING,
      {
      },
    ),
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
    fieldsetting: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettingsElemID,
      'fieldsetting',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings_fieldsetting),
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    recordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordactionElemID,
      'recordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   customtransactiontype   customrecordtype   For information about other possible values, see generic_standard_recordtype. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    recordidfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordactionElemID,
      'recordidfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    recordidjoinfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordactionElemID,
      'recordidjoinfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    ineditmode: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordactionElemID,
      'ineditmode',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fieldsettings: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordactionElemID,
      'fieldsettings',
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction_fieldsettings,
      {
      },
    ),
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
    name: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parameters_parameterElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    value: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parameters_parameterElemID,
      'value',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parameters_parameterElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
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
    parameter: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parametersElemID,
      'parameter',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parameters_parameter),
      {
      },
    ),
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
    type: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initconditionElemID,
      'type',
      enums.workflow_condition_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_condition_type. */
    formula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initconditionElemID,
      'formula',
      fieldTypes.cdata,
      {
      },
    ),
    parameters: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initconditionElemID,
      'parameters',
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_parameters,
      {
      },
    ),
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
    targetworkflowfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings_workflowfieldsettingElemID,
      'targetworkflowfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuetext: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings_workflowfieldsettingElemID,
      'valuetext',
      BuiltinTypes.STRING,
      {
      },
    ),
    valuechecked: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings_workflowfieldsettingElemID,
      'valuechecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ),
    valuedate: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings_workflowfieldsettingElemID,
      'valuedate',
      enums.workflowaction_valuedate,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_valuedate. */
    valueselect: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings_workflowfieldsettingElemID,
      'valueselect',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuejoinfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings_workflowfieldsettingElemID,
      'valuejoinfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings_workflowfieldsettingElemID,
      'valuefield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings_workflowfieldsettingElemID,
      'valueformula',
      BuiltinTypes.STRING,
      {
      },
    ),
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
    workflowfieldsetting: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettingsElemID,
      'workflowfieldsetting',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings_workflowfieldsetting),
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    initiatedworkflow: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowactionElemID,
      'initiatedworkflow',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the workflow custom type. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    workflowfieldsettings: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowactionElemID,
      'workflowfieldsettings',
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction_workflowfieldsettings,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_lockrecordactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_lockrecordactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_removebuttonactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    buttonid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_removebuttonactionElemID,
      'buttonid',
      enums.workflowaction_buttonid,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflowaction_buttonid. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_removebuttonactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_returnusererroractionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    errortext: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_returnusererroractionElemID,
      'errortext',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the string custom type. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_returnusererroractionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendcampaignemailactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    recipientfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendcampaignemailactionElemID,
      'recipientfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendcampaignemailactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    resultfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendcampaignemailactionElemID,
      'resultfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    recipientiscurrentrecord: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendcampaignemailactionElemID,
      'recipientiscurrentrecord',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    recipientjoinfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendcampaignemailactionElemID,
      'recipientjoinfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    campaignevent: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendcampaignemailactionElemID,
      'campaignevent',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: Note Account-specific values are not supported by SDF. */
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    sendertype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailactionElemID,
      'sendertype',
      enums.workflowaction_sendertype,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflowaction_sendertype. */
    recipienttype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailactionElemID,
      'recipienttype',
      enums.workflowaction_recipienttype,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflowaction_recipienttype. */
    sender: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailactionElemID,
      'sender',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: This field is mandatory when the sendertype value is equal to SPECIFIC.   Note Account-specific values are not supported by SDF. */
    senderfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailactionElemID,
      'senderfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is mandatory when the sendertype value is equal to FIELD.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    recipient: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailactionElemID,
      'recipient',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: This field is mandatory when the recipienttype value is equal to SPECIFIC.   Note Account-specific values are not supported by SDF. */
    recipientemail: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailactionElemID,
      'recipientemail',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: This field is mandatory when the recipienttype value is equal to ADDRESS. */
    recipientfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailactionElemID,
      'recipientfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is mandatory when the recipienttype value is equal to FIELD.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    template: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailactionElemID,
      'template',
      enums.generic_standard_template,
      {
      },
    ), /* Original description: This field is mandatory when the usetemplate value is equal to T.   For information about possible values, see generic_standard_template. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    senderjoinfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailactionElemID,
      'senderjoinfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    recipientjoinfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailactionElemID,
      'recipientjoinfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    recipientccemail: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailactionElemID,
      'recipientccemail',
      BuiltinTypes.STRING,
      {
      },
    ),
    recipientbccemail: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailactionElemID,
      'recipientbccemail',
      BuiltinTypes.STRING,
      {
      },
    ),
    usetemplate: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailactionElemID,
      'usetemplate',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    subject: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailactionElemID,
      'subject',
      BuiltinTypes.STRING,
      {
      },
    ),
    body: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailactionElemID,
      'body',
      BuiltinTypes.STRING,
      {
      },
    ),
    includerecordlink: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailactionElemID,
      'includerecordlink',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    attachmenttype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailactionElemID,
      'attachmenttype',
      enums.workflowaction_attachmenttype,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_attachmenttype. */
    attachmentfile: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailactionElemID,
      'attachmentfile',
      BuiltinTypes.STRING /* Original type was filereference */,
      {
      },
    ),
    attachmentjoinfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailactionElemID,
      'attachmentjoinfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    attachmentfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailactionElemID,
      'attachmentfield',
      enums.generic_standard_field,
      {
      },
    ), /* Original description: For information about possible values, see generic_standard_field. */
    includetransaction: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailactionElemID,
      'includetransaction',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    includeformat: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailactionElemID,
      'includeformat',
      enums.workflowaction_transtatementtype,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_transtatementtype. */
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaylabelactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    sublist: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaylabelactionElemID,
      'sublist',
      enums.workflow_sublists,
      {
      },
    ), /* Original description: This field is available when the issublistfield value is equal to T.   This field is mandatory when the issublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    field: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaylabelactionElemID,
      'field',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaylabelactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    issublistfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaylabelactionElemID,
      'issublistfield',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    displaylabel: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaylabelactionElemID,
      'displaylabel',
      BuiltinTypes.STRING,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaytypeactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    displaytype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaytypeactionElemID,
      'displaytype',
      enums.workflowaction_displaytype,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflowaction_displaytype. */
    sublist: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaytypeactionElemID,
      'sublist',
      enums.workflow_sublists,
      {
      },
    ), /* Original description: This field is available when the issublistfield value is equal to T.   This field is mandatory when the issublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    field: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaytypeactionElemID,
      'field',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaytypeactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    issublistfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaytypeactionElemID,
      'issublistfield',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldmandatoryactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    sublist: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldmandatoryactionElemID,
      'sublist',
      enums.workflow_sublists,
      {
      },
    ), /* Original description: This field is available when the issublistfield value is equal to T.   This field is mandatory when the issublistfield value is equal to T.   For information about possible values, see workflow_sublists.   The default value is 'item'. */
    field: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldmandatoryactionElemID,
      'field',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldmandatoryactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    issublistfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldmandatoryactionElemID,
      'issublistfield',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    ismandatory: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldmandatoryactionElemID,
      'ismandatory',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldvalueactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    field: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldvalueactionElemID,
      'field',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldvalueactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    valuetype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldvalueactionElemID,
      'valuetype',
      enums.workflowaction_valuetype,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_valuetype. */
    valuetext: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldvalueactionElemID,
      'valuetext',
      BuiltinTypes.STRING,
      {
      },
    ),
    valuechecked: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldvalueactionElemID,
      'valuechecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    valueselect: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldvalueactionElemID,
      'valueselect',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuemultiselect: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldvalueactionElemID,
      'valuemultiselect',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuedate: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldvalueactionElemID,
      'valuedate',
      enums.workflowaction_valuedate,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_valuedate. */
    valuejoinfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldvalueactionElemID,
      'valuejoinfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldvalueactionElemID,
      'valuefield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldvalueactionElemID,
      'valueformula',
      BuiltinTypes.STRING,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_subscribetorecordactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_subscribetorecordactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    recordfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_subscribetorecordactionElemID,
      'recordfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
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
    targetfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings_fieldsettingElemID,
      'targetfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuetext: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings_fieldsettingElemID,
      'valuetext',
      BuiltinTypes.STRING,
      {
      },
    ),
    valuechecked: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings_fieldsettingElemID,
      'valuechecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ),
    valuedate: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings_fieldsettingElemID,
      'valuedate',
      enums.workflowaction_valuedate,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_valuedate. */
    valueselect: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings_fieldsettingElemID,
      'valueselect',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuejoinfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings_fieldsettingElemID,
      'valuejoinfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings_fieldsettingElemID,
      'valuefield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings_fieldsettingElemID,
      'valueformula',
      BuiltinTypes.STRING,
      {
      },
    ),
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
    fieldsetting: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettingsElemID,
      'fieldsetting',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings_fieldsetting),
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    recordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordactionElemID,
      'recordtype',
      enums.generic_standard_recordtype,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_standard_recordtype. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    resultfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordactionElemID,
      'resultfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    fieldsettings: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordactionElemID,
      'fieldsettings',
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction_fieldsettings,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    scheduletimeofday: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
      'scheduletimeofday',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: This field is mandatory when the schedulemode value is equal to TIMEOFDAY. */
    eventtypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
      'eventtypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
      'contexttypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
      'conditionsavedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    scheduledelay: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
      'scheduledelay',
      BuiltinTypes.NUMBER,
      {
      },
    ),
    schedulerecurrence: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
      'schedulerecurrence',
      BuiltinTypes.NUMBER,
      {
      },
    ),
    scheduletimeunit: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
      'scheduletimeunit',
      enums.workflow_timeunit,
      {
      },
    ), /* Original description: For information about possible values, see workflow_timeunit. */
    schedulemode: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
      'schedulemode',
      enums.workflowaction_radioschedulemode,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    addbuttonaction: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
      'addbuttonaction',
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_addbuttonaction,
      {
      },
    ),
    createlineaction: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
      'createlineaction',
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createlineaction,
      {
      },
    ),
    createrecordaction: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
      'createrecordaction',
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_createrecordaction,
      {
      },
    ),
    customaction: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
      'customaction',
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_customaction,
      {
      },
    ),
    gotopageaction: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
      'gotopageaction',
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotopageaction,
      {
      },
    ),
    gotorecordaction: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
      'gotorecordaction',
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_gotorecordaction,
      {
      },
    ),
    initcondition: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
      'initcondition',
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition,
      {
      },
    ),
    initiateworkflowaction: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
      'initiateworkflowaction',
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initiateworkflowaction,
      {
      },
    ),
    lockrecordaction: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
      'lockrecordaction',
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_lockrecordaction,
      {
      },
    ),
    removebuttonaction: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
      'removebuttonaction',
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_removebuttonaction,
      {
      },
    ),
    returnusererroraction: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
      'returnusererroraction',
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_returnusererroraction,
      {
      },
    ),
    sendcampaignemailaction: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
      'sendcampaignemailaction',
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendcampaignemailaction,
      {
      },
    ),
    sendemailaction: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
      'sendemailaction',
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_sendemailaction,
      {
      },
    ),
    setdisplaylabelaction: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
      'setdisplaylabelaction',
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaylabelaction,
      {
      },
    ),
    setdisplaytypeaction: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
      'setdisplaytypeaction',
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setdisplaytypeaction,
      {
      },
    ),
    setfieldmandatoryaction: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
      'setfieldmandatoryaction',
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldmandatoryaction,
      {
      },
    ),
    setfieldvalueaction: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
      'setfieldvalueaction',
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_setfieldvalueaction,
      {
      },
    ),
    subscribetorecordaction: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
      'subscribetorecordaction',
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_subscribetorecordaction,
      {
      },
    ),
    transformrecordaction: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroupElemID,
      'transformrecordaction',
      workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_transformrecordaction,
      {
      },
    ),
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
    targetfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings_fieldsettingElemID,
      'targetfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuetext: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings_fieldsettingElemID,
      'valuetext',
      BuiltinTypes.STRING,
      {
      },
    ),
    valuechecked: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings_fieldsettingElemID,
      'valuechecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ),
    valuedate: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings_fieldsettingElemID,
      'valuedate',
      enums.workflowaction_valuedate,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_valuedate. */
    valueselect: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings_fieldsettingElemID,
      'valueselect',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuejoinfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings_fieldsettingElemID,
      'valuejoinfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings_fieldsettingElemID,
      'valuefield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings_fieldsettingElemID,
      'valueformula',
      BuiltinTypes.STRING,
      {
      },
    ),
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
    fieldsetting: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettingsElemID,
      'fieldsetting',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings_fieldsetting),
      {
      },
    ),
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
    name: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parameters_parameterElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    value: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parameters_parameterElemID,
      'value',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parameters_parameterElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
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
    parameter: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parametersElemID,
      'parameter',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parameters_parameter),
      {
      },
    ),
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
    type: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initconditionElemID,
      'type',
      enums.workflow_condition_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_condition_type. */
    formula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initconditionElemID,
      'formula',
      fieldTypes.cdata,
      {
      },
    ),
    parameters: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initconditionElemID,
      'parameters',
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_parameters,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    recordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordactionElemID,
      'recordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   customtransactiontype   customrecordtype   For information about other possible values, see generic_standard_recordtype. */
    conditionsavedsearch: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordactionElemID,
      'conditionsavedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    resultfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordactionElemID,
      'resultfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    fieldsettings: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordactionElemID,
      'fieldsettings',
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_fieldsettings,
      {
      },
    ),
    initcondition: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordactionElemID,
      'initcondition',
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition,
      {
      },
    ),
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
    name: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parameters_parameterElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    value: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parameters_parameterElemID,
      'value',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parameters_parameterElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
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
    parameter: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parametersElemID,
      'parameter',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parameters_parameter),
      {
      },
    ),
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
    type: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initconditionElemID,
      'type',
      enums.workflow_condition_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_condition_type. */
    formula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initconditionElemID,
      'formula',
      fieldTypes.cdata,
      {
      },
    ),
    parameters: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initconditionElemID,
      'parameters',
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_parameters,
      {
      },
    ),
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
    name: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parameters_parameterElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    value: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parameters_parameterElemID,
      'value',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parameters_parameterElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
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
    parameter: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parametersElemID,
      'parameter',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parameters_parameter),
      {
      },
    ),
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
    type: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initconditionElemID,
      'type',
      enums.workflow_condition_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_condition_type. */
    formula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initconditionElemID,
      'formula',
      fieldTypes.cdata,
      {
      },
    ),
    parameters: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initconditionElemID,
      'parameters',
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_parameters,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroractionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    errortext: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroractionElemID,
      'errortext',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the string custom type. */
    conditionsavedsearch: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroractionElemID,
      'conditionsavedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroractionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    initcondition: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroractionElemID,
      'initcondition',
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition,
      {
      },
    ),
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
    name: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parameters_parameterElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    value: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parameters_parameterElemID,
      'value',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parameters_parameterElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
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
    parameter: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parametersElemID,
      'parameter',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parameters_parameter),
      {
      },
    ),
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
    type: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initconditionElemID,
      'type',
      enums.workflow_condition_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_condition_type. */
    formula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initconditionElemID,
      'formula',
      fieldTypes.cdata,
      {
      },
    ),
    parameters: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initconditionElemID,
      'parameters',
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_parameters,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    sendertype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID,
      'sendertype',
      enums.workflowaction_sendertype,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflowaction_sendertype. */
    recipienttype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID,
      'recipienttype',
      enums.workflowaction_recipienttype,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflowaction_recipienttype. */
    sender: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID,
      'sender',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: This field is mandatory when the sendertype value is equal to SPECIFIC.   Note Account-specific values are not supported by SDF. */
    senderfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID,
      'senderfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is mandatory when the sendertype value is equal to FIELD.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    recipient: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID,
      'recipient',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: This field is mandatory when the recipienttype value is equal to SPECIFIC.   Note Account-specific values are not supported by SDF. */
    recipientemail: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID,
      'recipientemail',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: This field is mandatory when the recipienttype value is equal to ADDRESS. */
    recipientfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID,
      'recipientfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is mandatory when the recipienttype value is equal to FIELD.   This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    template: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID,
      'template',
      enums.generic_standard_template,
      {
      },
    ), /* Original description: This field is mandatory when the usetemplate value is equal to T.   For information about possible values, see generic_standard_template. */
    conditionsavedsearch: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID,
      'conditionsavedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    senderjoinfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID,
      'senderjoinfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    recipientjoinfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID,
      'recipientjoinfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    recipientccemail: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID,
      'recipientccemail',
      BuiltinTypes.STRING,
      {
      },
    ),
    recipientbccemail: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID,
      'recipientbccemail',
      BuiltinTypes.STRING,
      {
      },
    ),
    usetemplate: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID,
      'usetemplate',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    subject: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID,
      'subject',
      BuiltinTypes.STRING,
      {
      },
    ),
    body: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID,
      'body',
      BuiltinTypes.STRING,
      {
      },
    ),
    includerecordlink: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID,
      'includerecordlink',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    attachmenttype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID,
      'attachmenttype',
      enums.workflowaction_attachmenttype,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_attachmenttype. */
    attachmentfile: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID,
      'attachmentfile',
      BuiltinTypes.STRING /* Original type was filereference */,
      {
      },
    ),
    attachmentjoinfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID,
      'attachmentjoinfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    attachmentfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID,
      'attachmentfield',
      enums.generic_standard_field,
      {
      },
    ), /* Original description: For information about possible values, see generic_standard_field. */
    includetransaction: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID,
      'includetransaction',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    includeformat: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID,
      'includeformat',
      enums.workflowaction_transtatementtype,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_transtatementtype. */
    initcondition: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailactionElemID,
      'initcondition',
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition,
      {
      },
    ),
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
    name: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parameters_parameterElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    value: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parameters_parameterElemID,
      'value',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parameters_parameterElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
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
    parameter: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parametersElemID,
      'parameter',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parameters_parameter),
      {
      },
    ),
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
    type: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initconditionElemID,
      'type',
      enums.workflow_condition_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_condition_type. */
    formula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initconditionElemID,
      'formula',
      fieldTypes.cdata,
      {
      },
    ),
    parameters: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initconditionElemID,
      'parameters',
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_parameters,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueactionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    field: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueactionElemID,
      'field',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    conditionsavedsearch: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueactionElemID,
      'conditionsavedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueactionElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    valuetype: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueactionElemID,
      'valuetype',
      enums.workflowaction_valuetype,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_valuetype. */
    valuetext: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueactionElemID,
      'valuetext',
      BuiltinTypes.STRING,
      {
      },
    ),
    valuechecked: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueactionElemID,
      'valuechecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    valueselect: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueactionElemID,
      'valueselect',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuemultiselect: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueactionElemID,
      'valuemultiselect',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    valuedate: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueactionElemID,
      'valuedate',
      enums.workflowaction_valuedate,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_valuedate. */
    valuejoinfield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueactionElemID,
      'valuejoinfield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valuefield: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueactionElemID,
      'valuefield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    valueformula: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueactionElemID,
      'valueformula',
      BuiltinTypes.STRING,
      {
      },
    ),
    initcondition: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueactionElemID,
      'initcondition',
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroupElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowaction’. */
    sublist: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroupElemID,
      'sublist',
      enums.workflow_sublists,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_sublists. */
    scheduletimeofday: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroupElemID,
      'scheduletimeofday',
      BuiltinTypes.STRING,
      {
      },
    ), /* Original description: This field is mandatory when the schedulemode value is equal to TIMEOFDAY. */
    eventtypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroupElemID,
      'eventtypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroupElemID,
      'contexttypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroupElemID,
      'conditionsavedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    scheduledelay: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroupElemID,
      'scheduledelay',
      BuiltinTypes.NUMBER,
      {
      },
    ),
    schedulerecurrence: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroupElemID,
      'schedulerecurrence',
      BuiltinTypes.NUMBER,
      {
      },
    ),
    scheduletimeunit: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroupElemID,
      'scheduletimeunit',
      enums.workflow_timeunit,
      {
      },
    ), /* Original description: For information about possible values, see workflow_timeunit. */
    schedulemode: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroupElemID,
      'schedulemode',
      enums.workflowaction_radioschedulemode,
      {
      },
    ), /* Original description: For information about possible values, see workflowaction_radioschedulemode. */
    isinactive: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroupElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    createrecordaction: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroupElemID,
      'createrecordaction',
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction,
      {
      },
    ),
    initcondition: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroupElemID,
      'initcondition',
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition,
      {
      },
    ),
    returnusererroraction: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroupElemID,
      'returnusererroraction',
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction,
      {
      },
    ),
    sendemailaction: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroupElemID,
      'sendemailaction',
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction,
      {
      },
    ),
    setfieldvalueaction: new Field(
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroupElemID,
      'setfieldvalueaction',
      workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction,
      {
      },
    ),
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
    triggertype: new Field(
      workflow_workflowstates_workflowstate_workflowactionsElemID,
      'triggertype',
      enums.workflowaction_triggertype,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: For information about possible values, see workflowaction_triggertype. */
    addbuttonaction: new Field(
      workflow_workflowstates_workflowstate_workflowactionsElemID,
      'addbuttonaction',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_addbuttonaction),
      {
      },
    ),
    confirmaction: new Field(
      workflow_workflowstates_workflowstate_workflowactionsElemID,
      'confirmaction',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_confirmaction),
      {
      },
    ),
    createlineaction: new Field(
      workflow_workflowstates_workflowstate_workflowactionsElemID,
      'createlineaction',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_createlineaction),
      {
      },
    ),
    createrecordaction: new Field(
      workflow_workflowstates_workflowstate_workflowactionsElemID,
      'createrecordaction',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_createrecordaction),
      {
      },
    ),
    customaction: new Field(
      workflow_workflowstates_workflowstate_workflowactionsElemID,
      'customaction',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_customaction),
      {
      },
    ),
    gotopageaction: new Field(
      workflow_workflowstates_workflowstate_workflowactionsElemID,
      'gotopageaction',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_gotopageaction),
      {
      },
    ),
    gotorecordaction: new Field(
      workflow_workflowstates_workflowstate_workflowactionsElemID,
      'gotorecordaction',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_gotorecordaction),
      {
      },
    ),
    initiateworkflowaction: new Field(
      workflow_workflowstates_workflowstate_workflowactionsElemID,
      'initiateworkflowaction',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction),
      {
      },
    ),
    lockrecordaction: new Field(
      workflow_workflowstates_workflowstate_workflowactionsElemID,
      'lockrecordaction',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_lockrecordaction),
      {
      },
    ),
    removebuttonaction: new Field(
      workflow_workflowstates_workflowstate_workflowactionsElemID,
      'removebuttonaction',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_removebuttonaction),
      {
      },
    ),
    returnusererroraction: new Field(
      workflow_workflowstates_workflowstate_workflowactionsElemID,
      'returnusererroraction',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_returnusererroraction),
      {
      },
    ),
    sendcampaignemailaction: new Field(
      workflow_workflowstates_workflowstate_workflowactionsElemID,
      'sendcampaignemailaction',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction),
      {
      },
    ),
    sendemailaction: new Field(
      workflow_workflowstates_workflowstate_workflowactionsElemID,
      'sendemailaction',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_sendemailaction),
      {
      },
    ),
    setdisplaylabelaction: new Field(
      workflow_workflowstates_workflowstate_workflowactionsElemID,
      'setdisplaylabelaction',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction),
      {
      },
    ),
    setdisplaytypeaction: new Field(
      workflow_workflowstates_workflowstate_workflowactionsElemID,
      'setdisplaytypeaction',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction),
      {
      },
    ),
    setfieldmandatoryaction: new Field(
      workflow_workflowstates_workflowstate_workflowactionsElemID,
      'setfieldmandatoryaction',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction),
      {
      },
    ),
    setfieldvalueaction: new Field(
      workflow_workflowstates_workflowstate_workflowactionsElemID,
      'setfieldvalueaction',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction),
      {
      },
    ),
    showmessageaction: new Field(
      workflow_workflowstates_workflowstate_workflowactionsElemID,
      'showmessageaction',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_showmessageaction),
      {
      },
    ),
    subscribetorecordaction: new Field(
      workflow_workflowstates_workflowstate_workflowactionsElemID,
      'subscribetorecordaction',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction),
      {
      },
    ),
    transformrecordaction: new Field(
      workflow_workflowstates_workflowstate_workflowactionsElemID,
      'transformrecordaction',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_transformrecordaction),
      {
      },
    ),
    workflowactiongroup: new Field(
      workflow_workflowstates_workflowstate_workflowactionsElemID,
      'workflowactiongroup',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup),
      {
      },
    ),
    workflowsublistactiongroup: new Field(
      workflow_workflowstates_workflowstate_workflowactionsElemID,
      'workflowsublistactiongroup',
      new ListType(workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup),
      {
      },
    ),
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
    fldfilter: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilter',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    fldfilterchecked: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilterchecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldfiltercomparetype: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfiltercomparetype',
      enums.generic_customfield_fldfiltercomparetype,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_fldfiltercomparetype.   The default value is 'EQ'. */
    fldfiltersel: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfiltersel',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    fldfilterval: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilterval',
      BuiltinTypes.STRING,
      {
      },
    ),
    fldfilternotnull: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilternotnull',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldfilternull: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters_customfieldfilterElemID,
      'fldfilternull',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    fldcomparefield: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters_customfieldfilterElemID,
      'fldcomparefield',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   workflowstatecustomfield   workflowcustomfield   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
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
    customfieldfilter: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfiltersElemID,
      'customfieldfilter',
      new ListType(workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters_customfieldfilter),
      {
      },
    ),
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
    role: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccesses_roleaccessElemID,
      'role',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */
    accesslevel: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccesses_roleaccessElemID,
      'accesslevel',
      enums.generic_accesslevel_searchlevel,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
    searchlevel: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccesses_roleaccessElemID,
      'searchlevel',
      enums.generic_accesslevel_searchlevel,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
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
    roleaccess: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccessesElemID,
      'roleaccess',
      new ListType(workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccesses_roleaccess),
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfieldElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 41 characters long.   The default value is ‘custwfstate’. */
    fieldtype: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfieldElemID,
      'fieldtype',
      enums.generic_customfield_fieldtype,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see generic_customfield_fieldtype.   The default value is 'TEXT'. */
    label: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfieldElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    ), /* Original description: This field value can be up to 200 characters long. */
    selectrecordtype: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfieldElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is mandatory when the fieldtype value is equal to any of the following lists or values: SELECT, MULTISELECT.   This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
    applyformatting: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfieldElemID,
      'applyformatting',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    defaultchecked: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfieldElemID,
      'defaultchecked',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    defaultselection: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfieldElemID,
      'defaultselection',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    defaultvalue: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfieldElemID,
      'defaultvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    description: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfieldElemID,
      'description',
      BuiltinTypes.STRING,
      {
      },
    ),
    displaytype: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfieldElemID,
      'displaytype',
      enums.generic_customfield_displaytype,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_displaytype.   The default value is 'NORMAL'. */
    dynamicdefault: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfieldElemID,
      'dynamicdefault',
      enums.generic_customfield_dynamicdefault,
      {
      },
    ), /* Original description: For information about possible values, see generic_customfield_dynamicdefault. */
    help: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfieldElemID,
      'help',
      BuiltinTypes.STRING,
      {
      },
    ),
    linktext: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfieldElemID,
      'linktext',
      BuiltinTypes.STRING,
      {
      },
    ),
    minvalue: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfieldElemID,
      'minvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    maxvalue: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfieldElemID,
      'maxvalue',
      BuiltinTypes.STRING,
      {
      },
    ),
    storevalue: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfieldElemID,
      'storevalue',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    customfieldfilters: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfieldElemID,
      'customfieldfilters',
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_customfieldfilters,
      {
      },
    ),
    roleaccesses: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfieldElemID,
      'roleaccesses',
      workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield_roleaccesses,
      {
      },
    ),
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
    workflowstatecustomfield: new Field(
      workflow_workflowstates_workflowstate_workflowstatecustomfieldsElemID,
      'workflowstatecustomfield',
      new ListType(workflow_workflowstates_workflowstate_workflowstatecustomfields_workflowstatecustomfield),
      {
      },
    ),
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
    name: new Field(
      workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parameters_parameterElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    value: new Field(
      workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parameters_parameterElemID,
      'value',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   customsegment   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    selectrecordtype: new Field(
      workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parameters_parameterElemID,
      'selectrecordtype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
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
    parameter: new Field(
      workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parametersElemID,
      'parameter',
      new ListType(workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parameters_parameter),
      {
      },
    ),
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
    type: new Field(
      workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initconditionElemID,
      'type',
      enums.workflow_condition_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see workflow_condition_type. */
    formula: new Field(
      workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initconditionElemID,
      'formula',
      fieldTypes.cdata,
      {
      },
    ),
    parameters: new Field(
      workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initconditionElemID,
      'parameters',
      workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_parameters,
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstate_workflowtransitions_workflowtransitionElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowtransition’. */
    tostate: new Field(
      workflow_workflowstates_workflowstate_workflowtransitions_workflowtransitionElemID,
      'tostate',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the workflowstate custom type. */
    eventtypes: new Field(
      workflow_workflowstates_workflowstate_workflowtransitions_workflowtransitionElemID,
      'eventtypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflowaction_eventtype. */
    contexttypes: new Field(
      workflow_workflowstates_workflowstate_workflowtransitions_workflowtransitionElemID,
      'contexttypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    conditionsavedsearch: new Field(
      workflow_workflowstates_workflowstate_workflowtransitions_workflowtransitionElemID,
      'conditionsavedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    triggertype: new Field(
      workflow_workflowstates_workflowstate_workflowtransitions_workflowtransitionElemID,
      'triggertype',
      enums.workflowtransition_triggertype,
      {
      },
    ), /* Original description: For information about possible values, see workflowtransition_triggertype. */
    waitforworkflow: new Field(
      workflow_workflowstates_workflowstate_workflowtransitions_workflowtransitionElemID,
      'waitforworkflow',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the workflow custom type. */
    waitforworkflowstate: new Field(
      workflow_workflowstates_workflowstate_workflowtransitions_workflowtransitionElemID,
      'waitforworkflowstate',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the workflowstate custom type. */
    buttonaction: new Field(
      workflow_workflowstates_workflowstate_workflowtransitions_workflowtransitionElemID,
      'buttonaction',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the following custom types:   addbuttonaction   addbuttonaction */
    scheduledelay: new Field(
      workflow_workflowstates_workflowstate_workflowtransitions_workflowtransitionElemID,
      'scheduledelay',
      BuiltinTypes.STRING,
      {
      },
    ),
    scheduletimeunit: new Field(
      workflow_workflowstates_workflowstate_workflowtransitions_workflowtransitionElemID,
      'scheduletimeunit',
      enums.workflow_timeunit,
      {
      },
    ), /* Original description: For information about possible values, see workflow_timeunit. */
    initcondition: new Field(
      workflow_workflowstates_workflowstate_workflowtransitions_workflowtransitionElemID,
      'initcondition',
      workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition,
      {
      },
    ),
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
    workflowtransition: new Field(
      workflow_workflowstates_workflowstate_workflowtransitionsElemID,
      'workflowtransition',
      new ListType(workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition),
      {
      },
    ),
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
    scriptid: new Field(
      workflow_workflowstates_workflowstateElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘workflowstate’. */
    name: new Field(
      workflow_workflowstates_workflowstateElemID,
      'name',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the string custom type. */
    description: new Field(
      workflow_workflowstates_workflowstateElemID,
      'description',
      BuiltinTypes.STRING,
      {
      },
    ),
    donotexitworkflow: new Field(
      workflow_workflowstates_workflowstateElemID,
      'donotexitworkflow',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    positionx: new Field(
      workflow_workflowstates_workflowstateElemID,
      'positionx',
      BuiltinTypes.NUMBER,
      {
      },
    ),
    positiony: new Field(
      workflow_workflowstates_workflowstateElemID,
      'positiony',
      BuiltinTypes.NUMBER,
      {
      },
    ),
    workflowactions: new Field(
      workflow_workflowstates_workflowstateElemID,
      'workflowactions',
      new ListType(workflow_workflowstates_workflowstate_workflowactions),
      {
      },
    ),
    workflowstatecustomfields: new Field(
      workflow_workflowstates_workflowstateElemID,
      'workflowstatecustomfields',
      workflow_workflowstates_workflowstate_workflowstatecustomfields,
      {
      },
    ),
    workflowtransitions: new Field(
      workflow_workflowstates_workflowstateElemID,
      'workflowtransitions',
      workflow_workflowstates_workflowstate_workflowtransitions,
      {
      },
    ),
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
    workflowstate: new Field(
      workflow_workflowstatesElemID,
      'workflowstate',
      new ListType(workflow_workflowstates_workflowstate),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})

workflowInnerTypes.push(workflow_workflowstates)


export const workflow = new ObjectType({
  elemID: workflowElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'customworkflow_',
  },
  fields: {
    scriptid: new Field(
      workflowElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customworkflow’. */
    name: new Field(
      workflowElemID,
      'name',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
      },
    ), /* Original description: This field accepts references to the string custom type. */
    recordtypes: new Field(
      workflowElemID,
      'recordtypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   customtransactiontype   customrecordtype   For information about other possible values, see generic_standard_recordtype. */
    description: new Field(
      workflowElemID,
      'description',
      BuiltinTypes.STRING,
      {
      },
    ),
    initcontexts: new Field(
      workflowElemID,
      'initcontexts',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    initeventtypes: new Field(
      workflowElemID,
      'initeventtypes',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see workflow_eventtype. */
    initsavedsearchcondition: new Field(
      workflowElemID,
      'initsavedsearchcondition',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    initsavedsearchfilter: new Field(
      workflowElemID,
      'initsavedsearchfilter',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    inittriggertype: new Field(
      workflowElemID,
      'inittriggertype',
      enums.workflow_triggertype,
      {
      },
    ), /* Original description: For information about possible values, see workflow_triggertype. */
    initoncreate: new Field(
      workflowElemID,
      'initoncreate',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    initonvieworupdate: new Field(
      workflowElemID,
      'initonvieworupdate',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    isinactive: new Field(
      workflowElemID,
      'isinactive',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    islogenabled: new Field(
      workflowElemID,
      'islogenabled',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    releasestatus: new Field(
      workflowElemID,
      'releasestatus',
      enums.workflow_releasestatus,
      {
      },
    ), /* Original description: For information about possible values, see workflow_releasestatus.   The default value is 'NOTINITIATING'. */
    runasadmin: new Field(
      workflowElemID,
      'runasadmin',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    keephistory: new Field(
      workflowElemID,
      'keephistory',
      enums.workflow_keephistory,
      {
      },
    ), /* Original description: For information about possible values, see workflow_keephistory.   The default value is 'ONLYWHENTESTING'. */
    initcondition: new Field(
      workflowElemID,
      'initcondition',
      workflow_initcondition,
      {
      },
    ),
    recurrence: new Field(
      workflowElemID,
      'recurrence',
      workflow_recurrence,
      {
      },
    ),
    workflowcustomfields: new Field(
      workflowElemID,
      'workflowcustomfields',
      workflow_workflowcustomfields,
      {
      },
    ),
    workflowstates: new Field(
      workflowElemID,
      'workflowstates',
      workflow_workflowstates,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workflowElemID.name],
})
