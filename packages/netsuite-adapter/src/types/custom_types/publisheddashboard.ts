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

export const publisheddashboardInnerTypes: ObjectType[] = []

const publisheddashboardElemID = new ElemID(constants.NETSUITE, 'publisheddashboard')
const publisheddashboard_dashboards_dashboard_centercolumn_calendarElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_calendar')

const publisheddashboard_dashboards_dashboard_centercolumn_calendar = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_calendarElemID,
  annotations: {
  },
  fields: {
    numberofrecordsinagenda: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_calendarElemID,
      'numberofrecordsinagenda',
      BuiltinTypes.NUMBER,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field value must be greater than or equal to 0.   The default value is '7'. */
    isminimized: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_calendarElemID,
      'isminimized',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    showevents: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_calendarElemID,
      'showevents',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    showblockingtasks: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_calendarElemID,
      'showblockingtasks',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    shownonblockingtasks: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_calendarElemID,
      'shownonblockingtasks',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    showblockingcalls: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_calendarElemID,
      'showblockingcalls',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    shownonblockingcalls: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_calendarElemID,
      'shownonblockingcalls',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    showcanceledevents: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_calendarElemID,
      'showcanceledevents',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    showweekendsinmonthlyview: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_calendarElemID,
      'showweekendsinmonthlyview',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    recordstodisplayinagenda: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_calendarElemID,
      'recordstodisplayinagenda',
      enums.portlet_calendar_agenda,
      {
      },
    ), /* Original description: For information about possible values, see portlet_calendar_agenda.   The default value is 'TODAY_ONLY'. */
    showcampaignevents: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_calendarElemID,
      'showcampaignevents',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    showresourceallocations: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_calendarElemID,
      'showresourceallocations',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the RESOURCEALLOCATIONS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. RESOURCEALLOCATIONS must be enabled for this field to appear in your account. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_calendar)

const publisheddashboard_dashboards_dashboard_centercolumn_customportletElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_customportlet')

const publisheddashboard_dashboards_dashboard_centercolumn_customportlet = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_customportletElemID,
  annotations: {
  },
  fields: {
    source: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_customportletElemID,
      'source',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the scriptdeployment custom type. */
    isminimized: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_customportletElemID,
      'isminimized',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_customportlet)

const publisheddashboard_dashboards_dashboard_centercolumn_customsearchElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_customsearch')

const publisheddashboard_dashboards_dashboard_centercolumn_customsearch = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_customsearchElemID,
  annotations: {
  },
  fields: {
    savedsearch: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_customsearchElemID,
      'savedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see portlet_customsearch_savedsearch. */
    resultssize: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_customsearchElemID,
      'resultssize',
      BuiltinTypes.NUMBER,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: The default value is '10'. */
    isminimized: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_customsearchElemID,
      'isminimized',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    drilldown: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_customsearchElemID,
      'drilldown',
      enums.portlet_customsearch_drilldown,
      {
      },
    ), /* Original description: For information about possible values, see portlet_customsearch_drilldown.   The default value is 'NEW_PAGE'. */
    charttheme: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_customsearchElemID,
      'charttheme',
      enums.portlet_customsearch_charttheme,
      {
      },
    ), /* Original description: For information about possible values, see portlet_customsearch_charttheme.   The default value is 'GLOBAL_THEME'. */
    backgroundtype: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_customsearchElemID,
      'backgroundtype',
      enums.portlet_customsearch_backgroundtype,
      {
      },
    ), /* Original description: For information about possible values, see portlet_customsearch_backgroundtype.   The default value is 'GLOBAL_BACKGROUND'. */
    allowinlineediting: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_customsearchElemID,
      'allowinlineediting',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T.   If this field appears in the project, you must reference the EXTREMELIST feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. EXTREMELIST must be enabled for this field to appear in your account. */
    title: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_customsearchElemID,
      'title',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    ), /* Original description: This field value can be up to 40 characters long. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_customsearch)

const publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis_kpiElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis_kpi')

const publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis_kpi = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis_kpiElemID,
  annotations: {
  },
  fields: {
    kpi: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis_kpiElemID,
      'kpi',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see the following lists:   snapshot_type_period_range_not_comparable   snapshot_type_period_range_comparable   snapshot_type_date_range_not_comparable   snapshot_type_date_range_comparable   snapshot_type_custom */
    daterange: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis_kpiElemID,
      'daterange',
      enums.report_date_range,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see report_date_range. */
    comparedaterange: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis_kpiElemID,
      'comparedaterange',
      enums.report_date_range,
      {
      },
    ), /* Original description: This field is available when the kpi value is present in any of the following lists or values: snapshot_type_date_range_comparable, snapshot_type_period_range_comparable, snapshot_type_custom.   This field is mandatory when the kpi value is present in any of the following lists or values: snapshot_type_date_range_comparable, snapshot_type_period_range_comparable, snapshot_type_custom.   This field is mandatory when the compare value is equal to T.   For information about possible values, see report_date_range. */
    compareperiodrange: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis_kpiElemID,
      'compareperiodrange',
      enums.report_period_range,
      {
      },
    ), /* Original description: This field is available when the kpi value is present in any of the following lists or values: snapshot_type_period_range_comparable, snapshot_type_custom.   This field is mandatory when the kpi value is present in any of the following lists or values: snapshot_type_period_range_comparable, snapshot_type_custom.   This field is mandatory when the compare value is equal to T.   For information about possible values, see report_period_range. */
    savedsearch: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis_kpiElemID,
      'savedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is available when the kpi value is present in snapshot_type_custom.   This field is mandatory when the kpi value is present in snapshot_type_custom.   This field accepts references to the savedsearch custom type. */
    periodrange: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis_kpiElemID,
      'periodrange',
      enums.report_period_range,
      {
      },
    ), /* Original description: This field is available when the kpi value is present in any of the following lists or values: snapshot_type_period_range_comparable, snapshot_type_period_range_not_comparable, snapshot_type_custom.   This field is mandatory when the kpi value is present in any of the following lists or values: snapshot_type_period_range_comparable, snapshot_type_period_range_not_comparable, snapshot_type_custom.   For information about possible values, see report_period_range. */
    compare: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis_kpiElemID,
      'compare',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: This field is available when the kpi value is present in any of the following lists or values: snapshot_type_date_range_comparable, snapshot_type_period_range_comparable, snapshot_type_custom.   This field is mandatory when the kpi value is present in any of the following lists or values: snapshot_type_date_range_comparable, snapshot_type_period_range_comparable, snapshot_type_custom.   The default value is T. */
    employees: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis_kpiElemID,
      'employees',
      enums.portlet_kpi_employees,
      {
      },
    ), /* Original description: This field is available when the center value is equal to any of the following lists or values: SALESCENTER, SUPPORTCENTER.   For information about possible values, see portlet_kpi_employees.   The default value is 'ME_ONLY'. */
    headline: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis_kpiElemID,
      'headline',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    highlightif: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis_kpiElemID,
      'highlightif',
      enums.portlet_kpi_highlightif,
      {
      },
    ), /* Original description: For information about possible values, see portlet_kpi_highlightif. */
    threshold: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis_kpiElemID,
      'threshold',
      BuiltinTypes.NUMBER,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis_kpi)

const publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpisElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis')

const publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpisElemID,
  annotations: {
  },
  fields: {
    kpi: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpisElemID,
      'kpi',
      new ListType(publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis_kpi),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis)

const publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicatorsElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators')

const publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicatorsElemID,
  annotations: {
  },
  fields: {
    isminimized: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicatorsElemID,
      'isminimized',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    cacheddata: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicatorsElemID,
      'cacheddata',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    kpis: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicatorsElemID,
      'kpis',
      publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators)

const publisheddashboard_dashboards_dashboard_centercolumn_kpimeterElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_kpimeter')

const publisheddashboard_dashboards_dashboard_centercolumn_kpimeter = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_kpimeterElemID,
  annotations: {
  },
  fields: {
    kpi: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_kpimeterElemID,
      'kpi',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see the following lists:   snapshot_type_period_range_not_comparable   snapshot_type_period_range_comparable   snapshot_type_date_range_not_comparable   snapshot_type_date_range_comparable   snapshot_type_custom   portlet_kpimeter_combined_snapshots */
    isminimized: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_kpimeterElemID,
      'isminimized',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_kpimeter)

const publisheddashboard_dashboards_dashboard_centercolumn_listElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_list')

const publisheddashboard_dashboards_dashboard_centercolumn_list = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_listElemID,
  annotations: {
  },
  fields: {
    type: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_listElemID,
      'type',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the customrecordtype custom type.   For information about other possible values, see portlet_list_type. */
    size: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_listElemID,
      'size',
      BuiltinTypes.NUMBER,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field value must range from 1 through 50. (inclusive)   The default value is '10'. */
    isminimized: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_listElemID,
      'isminimized',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    allowinlineediting: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_listElemID,
      'allowinlineediting',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_list)

const publisheddashboard_dashboards_dashboard_centercolumn_quicksearchElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_quicksearch')

const publisheddashboard_dashboards_dashboard_centercolumn_quicksearch = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_quicksearchElemID,
  annotations: {
  },
  fields: {
    searchtype: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_quicksearchElemID,
      'searchtype',
      enums.portlet_quicksearch_type,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see portlet_quicksearch_type.   The default value is 'GENERIC'. */
    isminimized: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_quicksearchElemID,
      'isminimized',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    defaultgeneraltype: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_quicksearchElemID,
      'defaultgeneraltype',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field accepts references to the customrecordtype custom type.   For information about other possible values, see portlet_quicksearch_generic. */
    defaulttransactiontype: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_quicksearchElemID,
      'defaulttransactiontype',
      enums.portlet_quicksearch_transaction,
      {
      },
    ), /* Original description: For information about possible values, see portlet_quicksearch_transaction. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_quicksearch)

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrules_ruleElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrules_rule')

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrules_rule = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrules_ruleElemID,
  annotations: {
  },
  fields: {
    greaterthanorequalto: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrules_ruleElemID,
      'greaterthanorequalto',
      BuiltinTypes.NUMBER,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field value must range from -9999999 through 99999999. (inclusive) */
    color: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrules_ruleElemID,
      'color',
      enums.reminders_highlighting_rules_colors,
      {
      },
    ), /* Original description: For information about possible values, see reminders_highlighting_rules_colors.   The default value is 'YELLOW'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrules_rule)

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrulesElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrules')

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrules = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrulesElemID,
  annotations: {
  },
  fields: {
    rule: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrulesElemID,
      'rule',
      new ListType(publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrules_rule),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrules)

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminderElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder')

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminderElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminderElemID,
      'id',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   reminders_standard_reminders_without_days   reminders_standard_reminders_with_days */
    days: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminderElemID,
      'days',
      BuiltinTypes.NUMBER,
      {
      },
    ), /* Original description: This field value must range from -9999999 through 99999999. (inclusive)   This field is available when the id value is present in reminders_standard_reminders_with_days.   The default value is '5'. */
    highlightingrules: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminderElemID,
      'highlightingrules',
      publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrules,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder)

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_headlineElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline')

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_reminders_headlineElemID,
  annotations: {
  },
  fields: {
    reminder: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_reminders_headlineElemID,
      'reminder',
      new ListType(publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline)

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder_highlightingrules_ruleElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder_highlightingrules_rule')

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder_highlightingrules_rule = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder_highlightingrules_ruleElemID,
  annotations: {
  },
  fields: {
    greaterthanorequalto: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder_highlightingrules_ruleElemID,
      'greaterthanorequalto',
      BuiltinTypes.NUMBER,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field value must range from -9999999 through 99999999. (inclusive) */
    color: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder_highlightingrules_ruleElemID,
      'color',
      enums.reminders_highlighting_rules_colors,
      {
      },
    ), /* Original description: For information about possible values, see reminders_highlighting_rules_colors.   The default value is 'YELLOW'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder_highlightingrules_rule)

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder_highlightingrulesElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder_highlightingrules')

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder_highlightingrules = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder_highlightingrulesElemID,
  annotations: {
  },
  fields: {
    rule: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder_highlightingrulesElemID,
      'rule',
      new ListType(publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder_highlightingrules_rule),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder_highlightingrules)

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminderElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder')

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminderElemID,
  annotations: {
  },
  fields: {
    id: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminderElemID,
      'id',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   reminders_standard_reminders_without_days   reminders_standard_reminders_with_days */
    days: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminderElemID,
      'days',
      BuiltinTypes.NUMBER,
      {
      },
    ), /* Original description: This field value must range from -9999999 through 99999999. (inclusive)   This field is available when the id value is present in reminders_standard_reminders_with_days.   The default value is '5'. */
    highlightingrules: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminderElemID,
      'highlightingrules',
      publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder_highlightingrules,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder)

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_otherElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_reminders_other')

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_other = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_reminders_otherElemID,
  annotations: {
  },
  fields: {
    reminder: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_reminders_otherElemID,
      'reminder',
      new ListType(publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_reminders_other)

const publisheddashboard_dashboards_dashboard_centercolumn_remindersElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_reminders')

const publisheddashboard_dashboards_dashboard_centercolumn_reminders = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_remindersElemID,
  annotations: {
  },
  fields: {
    isminimized: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_remindersElemID,
      'isminimized',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    showzeroresults: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_remindersElemID,
      'showzeroresults',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    headline: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_remindersElemID,
      'headline',
      publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline,
      {
      },
    ),
    other: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_remindersElemID,
      'other',
      publisheddashboard_dashboards_dashboard_centercolumn_reminders_other,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_reminders)

const publisheddashboard_dashboards_dashboard_centercolumn_searchformElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_searchform')

const publisheddashboard_dashboards_dashboard_centercolumn_searchform = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_searchformElemID,
  annotations: {
  },
  fields: {
    savedsearch: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_searchformElemID,
      'savedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the savedsearch custom type. */
    isminimized: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_searchformElemID,
      'isminimized',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_searchform)

const publisheddashboard_dashboards_dashboard_centercolumn_trendgraphElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_trendgraph')

const publisheddashboard_dashboards_dashboard_centercolumn_trendgraph = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_trendgraphElemID,
  annotations: {
  },
  fields: {
    kpi: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_trendgraphElemID,
      'kpi',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see the following lists:   snapshot_type_trendgraph   snapshot_type_custom */
    trendtype: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_trendgraphElemID,
      'trendtype',
      enums.portlet_trendgraph_trendtype,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see portlet_trendgraph_trendtype. */
    movingaverageperiod: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_trendgraphElemID,
      'movingaverageperiod',
      BuiltinTypes.NUMBER,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field value must range from 1 through 10. (inclusive)   The default value is '2'. */
    savedsearch: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_trendgraphElemID,
      'savedsearch',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is available when the kpi value is present in snapshot_type_custom.   This field is mandatory when the kpi value is present in snapshot_type_custom.   This field accepts references to the savedsearch custom type. */
    isminimized: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_trendgraphElemID,
      'isminimized',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    backgroundtype: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_trendgraphElemID,
      'backgroundtype',
      enums.portlet_trendgraph_backgroundtype,
      {
      },
    ), /* Original description: For information about possible values, see portlet_trendgraph_backgroundtype.   The default value is 'GLOBAL_BACKGROUND'. */
    charttheme: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_trendgraphElemID,
      'charttheme',
      enums.portlet_trendgraph_charttheme,
      {
      },
    ), /* Original description: For information about possible values, see portlet_trendgraph_charttheme.   The default value is 'GLOBAL_THEME'. */
    customseriescolor: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_trendgraphElemID,
      'customseriescolor',
      BuiltinTypes.STRING /* Original type was rgb   RGB field types must be set to a valid 6–digit hexadecimal value between #000000 and #FFFFFF. The # prefix is optional. */,
      {
      },
    ),
    defaultcharttype: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_trendgraphElemID,
      'defaultcharttype',
      enums.portlet_trendgraph_charttype,
      {
      },
    ), /* Original description: For information about possible values, see portlet_trendgraph_charttype.   The default value is 'AREA'. */
    includezeroonyaxis: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_trendgraphElemID,
      'includezeroonyaxis',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    showmovingaverage: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_trendgraphElemID,
      'showmovingaverage',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    showlastdatapoint: new Field(
      publisheddashboard_dashboards_dashboard_centercolumn_trendgraphElemID,
      'showlastdatapoint',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_trendgraph)

const publisheddashboard_dashboards_dashboard_centercolumnElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn')

const publisheddashboard_dashboards_dashboard_centercolumn = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumnElemID,
  annotations: {
  },
  fields: {
    calendar: new Field(
      publisheddashboard_dashboards_dashboard_centercolumnElemID,
      'calendar',
      new ListType(publisheddashboard_dashboards_dashboard_centercolumn_calendar),
      {
      },
    ),
    customportlet: new Field(
      publisheddashboard_dashboards_dashboard_centercolumnElemID,
      'customportlet',
      new ListType(publisheddashboard_dashboards_dashboard_centercolumn_customportlet),
      {
      },
    ),
    customsearch: new Field(
      publisheddashboard_dashboards_dashboard_centercolumnElemID,
      'customsearch',
      new ListType(publisheddashboard_dashboards_dashboard_centercolumn_customsearch),
      {
      },
    ),
    keyperformanceindicators: new Field(
      publisheddashboard_dashboards_dashboard_centercolumnElemID,
      'keyperformanceindicators',
      new ListType(publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators),
      {
      },
    ),
    kpimeter: new Field(
      publisheddashboard_dashboards_dashboard_centercolumnElemID,
      'kpimeter',
      new ListType(publisheddashboard_dashboards_dashboard_centercolumn_kpimeter),
      {
      },
    ),
    list: new Field(
      publisheddashboard_dashboards_dashboard_centercolumnElemID,
      'list',
      new ListType(publisheddashboard_dashboards_dashboard_centercolumn_list),
      {
      },
    ),
    quicksearch: new Field(
      publisheddashboard_dashboards_dashboard_centercolumnElemID,
      'quicksearch',
      new ListType(publisheddashboard_dashboards_dashboard_centercolumn_quicksearch),
      {
      },
    ),
    reminders: new Field(
      publisheddashboard_dashboards_dashboard_centercolumnElemID,
      'reminders',
      new ListType(publisheddashboard_dashboards_dashboard_centercolumn_reminders),
      {
      },
    ),
    searchform: new Field(
      publisheddashboard_dashboards_dashboard_centercolumnElemID,
      'searchform',
      new ListType(publisheddashboard_dashboards_dashboard_centercolumn_searchform),
      {
      },
    ),
    trendgraph: new Field(
      publisheddashboard_dashboards_dashboard_centercolumnElemID,
      'trendgraph',
      new ListType(publisheddashboard_dashboards_dashboard_centercolumn_trendgraph),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn)

const publisheddashboard_dashboards_dashboard_leftcolumnElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_leftcolumn')

const publisheddashboard_dashboards_dashboard_leftcolumn = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_leftcolumnElemID,
  annotations: {
  },
  fields: {

  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_leftcolumn)

const publisheddashboard_dashboards_dashboard_rightcolumnElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_rightcolumn')

const publisheddashboard_dashboards_dashboard_rightcolumn = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_rightcolumnElemID,
  annotations: {
  },
  fields: {

  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_rightcolumn)

const publisheddashboard_dashboards_dashboardElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard')

const publisheddashboard_dashboards_dashboard = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboardElemID,
  annotations: {
  },
  fields: {
    centertab: new Field(
      publisheddashboard_dashboards_dashboardElemID,
      'centertab',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the centertab custom type.   For information about other possible values, see generic_centertab. */
    mode: new Field(
      publisheddashboard_dashboards_dashboardElemID,
      'mode',
      enums.dashboard_mode,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see dashboard_mode.   The default value is 'UNLOCKED'. */
    layout: new Field(
      publisheddashboard_dashboards_dashboardElemID,
      'layout',
      enums.dashboard_layout,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see dashboard_layout.   The default value is 'TWO_COLUMN'. */
    centercolumn: new Field(
      publisheddashboard_dashboards_dashboardElemID,
      'centercolumn',
      publisheddashboard_dashboards_dashboard_centercolumn,
      {
      },
    ),
    leftcolumn: new Field(
      publisheddashboard_dashboards_dashboardElemID,
      'leftcolumn',
      publisheddashboard_dashboards_dashboard_leftcolumn,
      {
      },
    ),
    rightcolumn: new Field(
      publisheddashboard_dashboards_dashboardElemID,
      'rightcolumn',
      publisheddashboard_dashboards_dashboard_rightcolumn,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard)

const publisheddashboard_dashboardsElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards')

const publisheddashboard_dashboards = new ObjectType({
  elemID: publisheddashboard_dashboardsElemID,
  annotations: {
  },
  fields: {
    dashboard: new Field(
      publisheddashboard_dashboardsElemID,
      'dashboard',
      new ListType(publisheddashboard_dashboards_dashboard),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards)

const publisheddashboard_roles_roleElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_roles_role')

const publisheddashboard_roles_role = new ObjectType({
  elemID: publisheddashboard_roles_roleElemID,
  annotations: {
  },
  fields: {
    role: new Field(
      publisheddashboard_roles_roleElemID,
      'role',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the role custom type.   For information about other possible values, see generic_role. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_roles_role)

const publisheddashboard_rolesElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_roles')

const publisheddashboard_roles = new ObjectType({
  elemID: publisheddashboard_rolesElemID,
  annotations: {
  },
  fields: {
    role: new Field(
      publisheddashboard_rolesElemID,
      'role',
      new ListType(publisheddashboard_roles_role),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_roles)


export const publisheddashboard = new ObjectType({
  elemID: publisheddashboardElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'custpubdashboard_',
  },
  fields: {
    scriptid: new Field(
      publisheddashboardElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custpubdashboard’. */
    name: new Field(
      publisheddashboardElemID,
      'name',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 30,
      },
    ), /* Original description: This field value can be up to 30 characters long. */
    center: new Field(
      publisheddashboardElemID,
      'center',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the center custom type.   For information about other possible values, see role_centertype. */
    lockshortcuts: new Field(
      publisheddashboardElemID,
      'lockshortcuts',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    locknewbar: new Field(
      publisheddashboardElemID,
      'locknewbar',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    notes: new Field(
      publisheddashboardElemID,
      'notes',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 4000,
      },
    ), /* Original description: This field value can be up to 4000 characters long. */
    dashboards: new Field(
      publisheddashboardElemID,
      'dashboards',
      publisheddashboard_dashboards,
      {
      },
    ),
    roles: new Field(
      publisheddashboardElemID,
      'roles',
      publisheddashboard_roles,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})
