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

export const publisheddashboardInnerTypes: ObjectType[] = []

const publisheddashboardElemID = new ElemID(constants.NETSUITE, 'publisheddashboard')
const publisheddashboard_dashboards_dashboard_centercolumn_calendarElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_calendar')

const publisheddashboard_dashboards_dashboard_centercolumn_calendar = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_calendarElemID,
  annotations: {
  },
  fields: [
    {
      name: 'numberofrecordsinagenda',
      type: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field value must be greater than or equal to 0.   The default value is '7'. */
    {
      name: 'isminimized',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'showevents',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'showblockingtasks',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'shownonblockingtasks',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'showblockingcalls',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'shownonblockingcalls',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'showcanceledevents',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'showweekendsinmonthlyview',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'recordstodisplayinagenda',
      type: enums.portlet_calendar_agenda,
      annotations: {
      },
    }, /* Original description: For information about possible values, see portlet_calendar_agenda.   The default value is 'TODAY_ONLY'. */
    {
      name: 'showcampaignevents',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'showresourceallocations',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the RESOURCEALLOCATIONS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. RESOURCEALLOCATIONS must be enabled for this field to appear in your account. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_calendar)

const publisheddashboard_dashboards_dashboard_centercolumn_customportletElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_customportlet')

const publisheddashboard_dashboards_dashboard_centercolumn_customportlet = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_customportletElemID,
  annotations: {
  },
  fields: [
    {
      name: 'source',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the scriptdeployment custom type. */
    {
      name: 'isminimized',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_customportlet)

const publisheddashboard_dashboards_dashboard_centercolumn_customsearchElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_customsearch')

const publisheddashboard_dashboards_dashboard_centercolumn_customsearch = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_customsearchElemID,
  annotations: {
  },
  fields: [
    {
      name: 'savedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see portlet_customsearch_savedsearch. */
    {
      name: 'resultssize',
      type: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is '10'. */
    {
      name: 'isminimized',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'drilldown',
      type: enums.portlet_customsearch_drilldown,
      annotations: {
      },
    }, /* Original description: For information about possible values, see portlet_customsearch_drilldown.   The default value is 'NEW_PAGE'. */
    {
      name: 'charttheme',
      type: enums.portlet_customsearch_charttheme,
      annotations: {
      },
    }, /* Original description: For information about possible values, see portlet_customsearch_charttheme.   The default value is 'GLOBAL_THEME'. */
    {
      name: 'backgroundtype',
      type: enums.portlet_customsearch_backgroundtype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see portlet_customsearch_backgroundtype.   The default value is 'GLOBAL_BACKGROUND'. */
    {
      name: 'allowinlineediting',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T.   If this field appears in the project, you must reference the EXTREMELIST feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. EXTREMELIST must be enabled for this field to appear in your account. */
    {
      name: 'title',
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    }, /* Original description: This field value can be up to 40 characters long. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_customsearch)

const publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis_kpiElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis_kpi')

const publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis_kpi = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis_kpiElemID,
  annotations: {
  },
  fields: [
    {
      name: 'kpi',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see the following lists:   snapshot_type_period_range_not_comparable   snapshot_type_period_range_comparable   snapshot_type_date_range_not_comparable   snapshot_type_date_range_comparable   snapshot_type_custom */
    {
      name: 'daterange',
      type: enums.report_date_range,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see report_date_range. */
    {
      name: 'comparedaterange',
      type: enums.report_date_range,
      annotations: {
      },
    }, /* Original description: This field is available when the kpi value is present in any of the following lists or values: snapshot_type_date_range_comparable, snapshot_type_period_range_comparable, snapshot_type_custom.   This field is mandatory when the kpi value is present in any of the following lists or values: snapshot_type_date_range_comparable, snapshot_type_period_range_comparable, snapshot_type_custom.   This field is mandatory when the compare value is equal to T.   For information about possible values, see report_date_range. */
    {
      name: 'compareperiodrange',
      type: enums.report_period_range,
      annotations: {
      },
    }, /* Original description: This field is available when the kpi value is present in any of the following lists or values: snapshot_type_period_range_comparable, snapshot_type_custom.   This field is mandatory when the kpi value is present in any of the following lists or values: snapshot_type_period_range_comparable, snapshot_type_custom.   This field is mandatory when the compare value is equal to T.   For information about possible values, see report_period_range. */
    {
      name: 'savedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field is available when the kpi value is present in snapshot_type_custom.   This field is mandatory when the kpi value is present in snapshot_type_custom.   This field accepts references to the savedsearch custom type. */
    {
      name: 'periodrange',
      type: enums.report_period_range,
      annotations: {
      },
    }, /* Original description: This field is available when the kpi value is present in any of the following lists or values: snapshot_type_period_range_comparable, snapshot_type_period_range_not_comparable, snapshot_type_custom.   This field is mandatory when the kpi value is present in any of the following lists or values: snapshot_type_period_range_comparable, snapshot_type_period_range_not_comparable, snapshot_type_custom.   For information about possible values, see report_period_range. */
    {
      name: 'compare',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the kpi value is present in any of the following lists or values: snapshot_type_date_range_comparable, snapshot_type_period_range_comparable, snapshot_type_custom.   This field is mandatory when the kpi value is present in any of the following lists or values: snapshot_type_date_range_comparable, snapshot_type_period_range_comparable, snapshot_type_custom.   The default value is T. */
    {
      name: 'employees',
      type: enums.portlet_kpi_employees,
      annotations: {
      },
    }, /* Original description: This field is available when the center value is equal to any of the following lists or values: SALESCENTER, SUPPORTCENTER.   For information about possible values, see portlet_kpi_employees.   The default value is 'ME_ONLY'. */
    {
      name: 'headline',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'highlightif',
      type: enums.portlet_kpi_highlightif,
      annotations: {
      },
    }, /* Original description: For information about possible values, see portlet_kpi_highlightif. */
    {
      name: 'threshold',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis_kpi)

const publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpisElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis')

const publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpisElemID,
  annotations: {
  },
  fields: [
    {
      name: 'kpi',
      type: new ListType(publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis_kpi),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis)

const publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicatorsElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators')

const publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicatorsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'isminimized',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'cacheddata',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'kpis',
      type: publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators)

const publisheddashboard_dashboards_dashboard_centercolumn_kpimeterElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_kpimeter')

const publisheddashboard_dashboards_dashboard_centercolumn_kpimeter = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_kpimeterElemID,
  annotations: {
  },
  fields: [
    {
      name: 'kpi',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see the following lists:   snapshot_type_period_range_not_comparable   snapshot_type_period_range_comparable   snapshot_type_date_range_not_comparable   snapshot_type_date_range_comparable   snapshot_type_custom   portlet_kpimeter_combined_snapshots */
    {
      name: 'isminimized',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_kpimeter)

const publisheddashboard_dashboards_dashboard_centercolumn_listElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_list')

const publisheddashboard_dashboards_dashboard_centercolumn_list = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_listElemID,
  annotations: {
  },
  fields: [
    {
      name: 'type',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the customrecordtype custom type.   For information about other possible values, see portlet_list_type. */
    {
      name: 'size',
      type: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field value must range from 1 through 50. (inclusive)   The default value is '10'. */
    {
      name: 'isminimized',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'allowinlineediting',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_list)

const publisheddashboard_dashboards_dashboard_centercolumn_quicksearchElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_quicksearch')

const publisheddashboard_dashboards_dashboard_centercolumn_quicksearch = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_quicksearchElemID,
  annotations: {
  },
  fields: [
    {
      name: 'searchtype',
      type: enums.portlet_quicksearch_type,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see portlet_quicksearch_type.   The default value is 'GENERIC'. */
    {
      name: 'isminimized',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'defaultgeneraltype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the customrecordtype custom type.   For information about other possible values, see portlet_quicksearch_generic. */
    {
      name: 'defaulttransactiontype',
      type: enums.portlet_quicksearch_transaction,
      annotations: {
      },
    }, /* Original description: For information about possible values, see portlet_quicksearch_transaction. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_quicksearch)

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrules_ruleElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrules_rule')

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrules_rule = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrules_ruleElemID,
  annotations: {
  },
  fields: [
    {
      name: 'greaterthanorequalto',
      type: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field value must range from -9999999 through 99999999. (inclusive) */
    {
      name: 'color',
      type: enums.reminders_highlighting_rules_colors,
      annotations: {
      },
    }, /* Original description: For information about possible values, see reminders_highlighting_rules_colors.   The default value is 'YELLOW'. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrules_rule)

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrulesElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrules')

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrules = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrulesElemID,
  annotations: {
  },
  fields: [
    {
      name: 'rule',
      type: new ListType(publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrules_rule),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrules)

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminderElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder')

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminderElemID,
  annotations: {
  },
  fields: [
    {
      name: 'id',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   reminders_standard_reminders_without_days   reminders_standard_reminders_with_days */
    {
      name: 'days',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    }, /* Original description: This field value must range from -9999999 through 99999999. (inclusive)   This field is available when the id value is present in reminders_standard_reminders_with_days.   The default value is '5'. */
    {
      name: 'highlightingrules',
      type: publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrules,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder)

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_headlineElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline')

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_reminders_headlineElemID,
  annotations: {
  },
  fields: [
    {
      name: 'reminder',
      type: new ListType(publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline)

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder_highlightingrules_ruleElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder_highlightingrules_rule')

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder_highlightingrules_rule = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder_highlightingrules_ruleElemID,
  annotations: {
  },
  fields: [
    {
      name: 'greaterthanorequalto',
      type: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field value must range from -9999999 through 99999999. (inclusive) */
    {
      name: 'color',
      type: enums.reminders_highlighting_rules_colors,
      annotations: {
      },
    }, /* Original description: For information about possible values, see reminders_highlighting_rules_colors.   The default value is 'YELLOW'. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder_highlightingrules_rule)

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder_highlightingrulesElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder_highlightingrules')

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder_highlightingrules = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder_highlightingrulesElemID,
  annotations: {
  },
  fields: [
    {
      name: 'rule',
      type: new ListType(publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder_highlightingrules_rule),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder_highlightingrules)

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminderElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder')

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminderElemID,
  annotations: {
  },
  fields: [
    {
      name: 'id',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   reminders_standard_reminders_without_days   reminders_standard_reminders_with_days */
    {
      name: 'days',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    }, /* Original description: This field value must range from -9999999 through 99999999. (inclusive)   This field is available when the id value is present in reminders_standard_reminders_with_days.   The default value is '5'. */
    {
      name: 'highlightingrules',
      type: publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder_highlightingrules,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder)

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_otherElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_reminders_other')

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_other = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_reminders_otherElemID,
  annotations: {
  },
  fields: [
    {
      name: 'reminder',
      type: new ListType(publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_reminders_other)

const publisheddashboard_dashboards_dashboard_centercolumn_remindersElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_reminders')

const publisheddashboard_dashboards_dashboard_centercolumn_reminders = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_remindersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'isminimized',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'showzeroresults',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'headline',
      type: publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline,
      annotations: {
      },
    },
    {
      name: 'other',
      type: publisheddashboard_dashboards_dashboard_centercolumn_reminders_other,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_reminders)

const publisheddashboard_dashboards_dashboard_centercolumn_searchformElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_searchform')

const publisheddashboard_dashboards_dashboard_centercolumn_searchform = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_searchformElemID,
  annotations: {
  },
  fields: [
    {
      name: 'savedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'isminimized',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_searchform)

const publisheddashboard_dashboards_dashboard_centercolumn_trendgraphElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_trendgraph')

const publisheddashboard_dashboards_dashboard_centercolumn_trendgraph = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_trendgraphElemID,
  annotations: {
  },
  fields: [
    {
      name: 'kpi',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see the following lists:   snapshot_type_trendgraph   snapshot_type_custom */
    {
      name: 'trendtype',
      type: enums.portlet_trendgraph_trendtype,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see portlet_trendgraph_trendtype. */
    {
      name: 'movingaverageperiod',
      type: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field value must range from 1 through 10. (inclusive)   The default value is '2'. */
    {
      name: 'savedsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field is available when the kpi value is present in snapshot_type_custom.   This field is mandatory when the kpi value is present in snapshot_type_custom.   This field accepts references to the savedsearch custom type. */
    {
      name: 'isminimized',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'backgroundtype',
      type: enums.portlet_trendgraph_backgroundtype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see portlet_trendgraph_backgroundtype.   The default value is 'GLOBAL_BACKGROUND'. */
    {
      name: 'charttheme',
      type: enums.portlet_trendgraph_charttheme,
      annotations: {
      },
    }, /* Original description: For information about possible values, see portlet_trendgraph_charttheme.   The default value is 'GLOBAL_THEME'. */
    {
      name: 'customseriescolor',
      type: BuiltinTypes.STRING /* Original type was rgb   RGB field types must be set to a valid 6–digit hexadecimal value between #000000 and #FFFFFF. The # prefix is optional. */,
      annotations: {
      },
    },
    {
      name: 'defaultcharttype',
      type: enums.portlet_trendgraph_charttype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see portlet_trendgraph_charttype.   The default value is 'AREA'. */
    {
      name: 'includezeroonyaxis',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'showmovingaverage',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'showlastdatapoint',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_trendgraph)

const publisheddashboard_dashboards_dashboard_centercolumnElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn')

const publisheddashboard_dashboards_dashboard_centercolumn = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumnElemID,
  annotations: {
  },
  fields: [
    {
      name: 'calendar',
      type: new ListType(publisheddashboard_dashboards_dashboard_centercolumn_calendar),
      annotations: {
      },
    },
    {
      name: 'customportlet',
      type: new ListType(publisheddashboard_dashboards_dashboard_centercolumn_customportlet),
      annotations: {
      },
    },
    {
      name: 'customsearch',
      type: new ListType(publisheddashboard_dashboards_dashboard_centercolumn_customsearch),
      annotations: {
      },
    },
    {
      name: 'keyperformanceindicators',
      type: new ListType(publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators),
      annotations: {
      },
    },
    {
      name: 'kpimeter',
      type: new ListType(publisheddashboard_dashboards_dashboard_centercolumn_kpimeter),
      annotations: {
      },
    },
    {
      name: 'list',
      type: new ListType(publisheddashboard_dashboards_dashboard_centercolumn_list),
      annotations: {
      },
    },
    {
      name: 'quicksearch',
      type: new ListType(publisheddashboard_dashboards_dashboard_centercolumn_quicksearch),
      annotations: {
      },
    },
    {
      name: 'reminders',
      type: new ListType(publisheddashboard_dashboards_dashboard_centercolumn_reminders),
      annotations: {
      },
    },
    {
      name: 'searchform',
      type: new ListType(publisheddashboard_dashboards_dashboard_centercolumn_searchform),
      annotations: {
      },
    },
    {
      name: 'trendgraph',
      type: new ListType(publisheddashboard_dashboards_dashboard_centercolumn_trendgraph),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn)

const publisheddashboard_dashboards_dashboard_leftcolumnElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_leftcolumn')

const publisheddashboard_dashboards_dashboard_leftcolumn = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_leftcolumnElemID,
  annotations: {
  },
  fields: [

  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_leftcolumn)

const publisheddashboard_dashboards_dashboard_rightcolumnElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_rightcolumn')

const publisheddashboard_dashboards_dashboard_rightcolumn = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_rightcolumnElemID,
  annotations: {
  },
  fields: [

  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_rightcolumn)

const publisheddashboard_dashboards_dashboardElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard')

const publisheddashboard_dashboards_dashboard = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboardElemID,
  annotations: {
  },
  fields: [
    {
      name: 'centertab',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the centertab custom type.   For information about other possible values, see generic_centertab. */
    {
      name: 'mode',
      type: enums.dashboard_mode,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see dashboard_mode.   The default value is 'UNLOCKED'. */
    {
      name: 'layout',
      type: enums.dashboard_layout,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see dashboard_layout.   The default value is 'TWO_COLUMN'. */
    {
      name: 'centercolumn',
      type: publisheddashboard_dashboards_dashboard_centercolumn,
      annotations: {
      },
    },
    {
      name: 'leftcolumn',
      type: publisheddashboard_dashboards_dashboard_leftcolumn,
      annotations: {
      },
    },
    {
      name: 'rightcolumn',
      type: publisheddashboard_dashboards_dashboard_rightcolumn,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard)

const publisheddashboard_dashboardsElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards')

const publisheddashboard_dashboards = new ObjectType({
  elemID: publisheddashboard_dashboardsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'dashboard',
      type: new ListType(publisheddashboard_dashboards_dashboard),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards)

const publisheddashboard_roles_roleElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_roles_role')

const publisheddashboard_roles_role = new ObjectType({
  elemID: publisheddashboard_roles_roleElemID,
  annotations: {
  },
  fields: [
    {
      name: 'role',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the role custom type.   For information about other possible values, see generic_role. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_roles_role)

const publisheddashboard_rolesElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_roles')

const publisheddashboard_roles = new ObjectType({
  elemID: publisheddashboard_rolesElemID,
  annotations: {
  },
  fields: [
    {
      name: 'role',
      type: new ListType(publisheddashboard_roles_role),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_roles)


export const publisheddashboard = new ObjectType({
  elemID: publisheddashboardElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'custpubdashboard_',
  },
  fields: [
    {
      name: 'scriptid',
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custpubdashboard’. */
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 30,
      },
    }, /* Original description: This field value can be up to 30 characters long. */
    {
      name: 'center',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the center custom type.   For information about other possible values, see role_centertype. */
    {
      name: 'lockshortcuts',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'locknewbar',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'notes',
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 4000,
      },
    }, /* Original description: This field value can be up to 4000 characters long. */
    {
      name: 'dashboards',
      type: publisheddashboard_dashboards,
      annotations: {
      },
    },
    {
      name: 'roles',
      type: publisheddashboard_roles,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})
