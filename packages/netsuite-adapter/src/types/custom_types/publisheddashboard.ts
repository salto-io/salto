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

export const publisheddashboardInnerTypes: ObjectType[] = []

const publisheddashboardElemID = new ElemID(constants.NETSUITE, 'publisheddashboard')
const publisheddashboard_dashboards_dashboard_centercolumn_analyticsElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_analytics')

const publisheddashboard_dashboards_dashboard_centercolumn_analytics = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_analyticsElemID,
  annotations: {
  },
  fields: {
    portlettype: {
      refType: createRefToElmWithValue(enums.portlet_analytics_portlettype),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see portlet_analytics_portlettype. */
    visualization: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   table   pivot   chart */
    isminimized: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 50,
      },
    }, /* Original description: This field value can be up to 50 characters long. */
    height: {
      refType: createRefToElmWithValue(enums.portlet_analytics_height),
      annotations: {
      },
    }, /* Original description: This field is available when the portlettype value is equal to CHART.   For information about possible values, see portlet_analytics_height. */
    visiblerows: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
      },
    }, /* Original description: This field value must be less than or equal to 200.   This field is available when the portlettype value is equal to any of the following lists or values: PIVOT, TABLE. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_analytics)

const publisheddashboard_dashboards_dashboard_centercolumn_calendarElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_calendar')

const publisheddashboard_dashboards_dashboard_centercolumn_calendar = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_calendarElemID,
  annotations: {
  },
  fields: {
    numberofrecordsinagenda: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field value must be greater than or equal to 0.   The default value is '7'. */
    isminimized: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    showevents: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    showblockingtasks: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    shownonblockingtasks: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    showblockingcalls: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    shownonblockingcalls: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    showcanceledevents: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    showweekendsinmonthlyview: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    recordstodisplayinagenda: {
      refType: createRefToElmWithValue(enums.portlet_calendar_agenda),
      annotations: {
      },
    }, /* Original description: For information about possible values, see portlet_calendar_agenda.   The default value is 'TODAY_ONLY'. */
    showcampaignevents: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    showresourceallocations: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the RESOURCEALLOCATIONS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. RESOURCEALLOCATIONS must be enabled for this field to appear in your account. */
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
    source: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the scriptdeployment custom type. */
    isminimized: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
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
    savedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see portlet_customsearch_savedsearch. */
    resultssize: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is '10'. */
    isminimized: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    drilldown: {
      refType: createRefToElmWithValue(enums.portlet_customsearch_drilldown),
      annotations: {
      },
    }, /* Original description: For information about possible values, see portlet_customsearch_drilldown.   The default value is 'NEW_PAGE'. */
    charttheme: {
      refType: createRefToElmWithValue(enums.portlet_customsearch_charttheme),
      annotations: {
      },
    }, /* Original description: For information about possible values, see portlet_customsearch_charttheme.   The default value is 'GLOBAL_THEME'. */
    backgroundtype: {
      refType: createRefToElmWithValue(enums.portlet_customsearch_backgroundtype),
      annotations: {
      },
    }, /* Original description: For information about possible values, see portlet_customsearch_backgroundtype.   The default value is 'GLOBAL_BACKGROUND'. */
    allowinlineediting: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T.   If this field appears in the project, you must reference the EXTREMELIST feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. EXTREMELIST must be enabled for this field to appear in your account. */
    title: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    }, /* Original description: This field value can be up to 40 characters long. */
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
    kpi: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see the following lists:   snapshot_type_period_range_not_comparable   snapshot_type_period_range_comparable   snapshot_type_date_range_not_comparable   snapshot_type_date_range_comparable   snapshot_type_custom */
    daterange: {
      refType: createRefToElmWithValue(enums.report_date_range),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see report_date_range. */
    comparedaterange: {
      refType: createRefToElmWithValue(enums.report_date_range),
      annotations: {
      },
    }, /* Original description: This field is available when the kpi value is present in any of the following lists or values: snapshot_type_date_range_comparable, snapshot_type_period_range_comparable, snapshot_type_custom.   This field is mandatory when the kpi value is present in any of the following lists or values: snapshot_type_date_range_comparable, snapshot_type_period_range_comparable, snapshot_type_custom.   This field is mandatory when the compare value is equal to T.   For information about possible values, see report_date_range. */
    compareperiodrange: {
      refType: createRefToElmWithValue(enums.report_period_range),
      annotations: {
      },
    }, /* Original description: This field is available when the kpi value is present in any of the following lists or values: snapshot_type_period_range_comparable, snapshot_type_custom.   This field is mandatory when the kpi value is present in any of the following lists or values: snapshot_type_period_range_comparable, snapshot_type_custom.   This field is mandatory when the compare value is equal to T.   For information about possible values, see report_period_range. */
    savedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field is available when the kpi value is present in snapshot_type_custom.   This field is mandatory when the kpi value is present in snapshot_type_custom.   This field accepts references to the savedsearch custom type. */
    periodrange: {
      refType: createRefToElmWithValue(enums.report_period_range),
      annotations: {
      },
    }, /* Original description: This field is available when the kpi value is present in any of the following lists or values: snapshot_type_period_range_comparable, snapshot_type_period_range_not_comparable, snapshot_type_custom.   This field is mandatory when the kpi value is present in any of the following lists or values: snapshot_type_period_range_comparable, snapshot_type_period_range_not_comparable, snapshot_type_custom.   For information about possible values, see report_period_range. */
    compare: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: This field is available when the kpi value is present in any of the following lists or values: snapshot_type_date_range_comparable, snapshot_type_period_range_comparable, snapshot_type_custom.   This field is mandatory when the kpi value is present in any of the following lists or values: snapshot_type_date_range_comparable, snapshot_type_period_range_comparable, snapshot_type_custom.   The default value is T. */
    employees: {
      refType: createRefToElmWithValue(enums.portlet_kpi_employees),
      annotations: {
      },
    }, /* Original description: This field is available when the center value is equal to any of the following lists or values: SALESCENTER, SUPPORTCENTER.   For information about possible values, see portlet_kpi_employees.   The default value is 'ME_ONLY'. */
    headline: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    highlightif: {
      refType: createRefToElmWithValue(enums.portlet_kpi_highlightif),
      annotations: {
      },
    }, /* Original description: For information about possible values, see portlet_kpi_highlightif. */
    threshold: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
      },
    },
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
    kpi: {
      refType: createRefToElmWithValue(new ListType(publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis_kpi)),
      annotations: {
      },
    },
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
    isminimized: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    cacheddata: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    kpis: {
      refType: createRefToElmWithValue(publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators_kpis),
      annotations: {
      },
    },
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
    kpi: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see the following lists:   snapshot_type_period_range_not_comparable   snapshot_type_period_range_comparable   snapshot_type_date_range_not_comparable   snapshot_type_date_range_comparable   snapshot_type_custom   portlet_kpimeter_combined_snapshots */
    isminimized: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_kpimeter)

const publisheddashboard_dashboards_dashboard_centercolumn_kpireportElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_kpireport')

const publisheddashboard_dashboards_dashboard_centercolumn_kpireport = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_kpireportElemID,
  annotations: {
  },
  fields: {
    isminimized: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    reportid: {
      refType: createRefToElmWithValue(enums.portlet_kpireport_reportid),
      annotations: {
      },
    }, /* Original description: For information about possible values, see portlet_kpireport_reportid. */
    restrict: {
      refType: createRefToElmWithValue(enums.portlet_kpireport_restrict),
      annotations: {
      },
    }, /* Original description: For information about possible values, see portlet_kpireport_restrict. */
    orientation: {
      refType: createRefToElmWithValue(enums.portlet_kpireport_orientation),
      annotations: {
      },
    }, /* Original description: For information about possible values, see portlet_kpireport_orientation. */
    trend: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    showdates: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_kpireport)

const publisheddashboard_dashboards_dashboard_centercolumn_listElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_list')

const publisheddashboard_dashboards_dashboard_centercolumn_list = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_listElemID,
  annotations: {
  },
  fields: {
    type: {
      refType: createRefToElmWithValue(enums.portlet_list_type),
      annotations: {
      },
    }, /* Original description: For information about possible values, see portlet_list_type. */
    size: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field value must range from 1 through 50. (inclusive)   The default value is '5'. */
    isminimized: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    allowinlineediting: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
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
    searchtype: {
      refType: createRefToElmWithValue(enums.portlet_quicksearch_type),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see portlet_quicksearch_type.   The default value is 'GENERIC'. */
    isminimized: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    defaultgeneraltype: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the customrecordtype custom type.   For information about other possible values, see portlet_quicksearch_generic. */
    defaulttransactiontype: {
      refType: createRefToElmWithValue(enums.portlet_quicksearch_transaction),
      annotations: {
      },
    }, /* Original description: For information about possible values, see portlet_quicksearch_transaction. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_quicksearch)

const publisheddashboard_dashboards_dashboard_centercolumn_recentrecordsElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_recentrecords')

const publisheddashboard_dashboards_dashboard_centercolumn_recentrecords = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_recentrecordsElemID,
  annotations: {
  },
  fields: {
    isminimized: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_recentrecords)

const publisheddashboard_dashboards_dashboard_centercolumn_recentreportsElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_recentreports')

const publisheddashboard_dashboards_dashboard_centercolumn_recentreports = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_recentreportsElemID,
  annotations: {
  },
  fields: {
    isminimized: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_recentreports)

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrules_ruleElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrules_rule')

const publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrules_rule = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrules_ruleElemID,
  annotations: {
  },
  fields: {
    greaterthanorequalto: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field value must range from -9999999 through 99999999. (inclusive) */
    color: {
      refType: createRefToElmWithValue(enums.reminders_highlighting_rules_colors),
      annotations: {
      },
    }, /* Original description: For information about possible values, see reminders_highlighting_rules_colors.   The default value is 'YELLOW'. */
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
    rule: {
      refType: createRefToElmWithValue(new ListType(publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrules_rule)),
      annotations: {
      },
    },
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
    id: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   reminders_standard_reminders_without_days   reminders_standard_reminders_with_days */
    days: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
      },
    }, /* Original description: This field value must range from -9999999 through 99999999. (inclusive)   This field is available when the id value is present in reminders_standard_reminders_with_days.   The default value is '5'. */
    highlightingrules: {
      refType: createRefToElmWithValue(publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder_highlightingrules),
      annotations: {
      },
    },
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
    reminder: {
      refType: createRefToElmWithValue(new ListType(publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline_reminder)),
      annotations: {
      },
    },
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
    greaterthanorequalto: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field value must range from -9999999 through 99999999. (inclusive) */
    color: {
      refType: createRefToElmWithValue(enums.reminders_highlighting_rules_colors),
      annotations: {
      },
    }, /* Original description: For information about possible values, see reminders_highlighting_rules_colors.   The default value is 'YELLOW'. */
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
    rule: {
      refType: createRefToElmWithValue(new ListType(publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder_highlightingrules_rule)),
      annotations: {
      },
    },
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
    id: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   reminders_standard_reminders_without_days   reminders_standard_reminders_with_days */
    days: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
      },
    }, /* Original description: This field value must range from -9999999 through 99999999. (inclusive)   This field is available when the id value is present in reminders_standard_reminders_with_days.   The default value is '5'. */
    highlightingrules: {
      refType: createRefToElmWithValue(publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder_highlightingrules),
      annotations: {
      },
    },
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
    reminder: {
      refType: createRefToElmWithValue(new ListType(publisheddashboard_dashboards_dashboard_centercolumn_reminders_other_reminder)),
      annotations: {
      },
    },
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
    isminimized: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    showzeroresults: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    headline: {
      refType: createRefToElmWithValue(publisheddashboard_dashboards_dashboard_centercolumn_reminders_headline),
      annotations: {
      },
    },
    other: {
      refType: createRefToElmWithValue(publisheddashboard_dashboards_dashboard_centercolumn_reminders_other),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_reminders)

const publisheddashboard_dashboards_dashboard_centercolumn_schedulerElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_scheduler')

const publisheddashboard_dashboards_dashboard_centercolumn_scheduler = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_schedulerElemID,
  annotations: {
  },
  fields: {
    isminimized: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_scheduler)

const publisheddashboard_dashboards_dashboard_centercolumn_searchformElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_searchform')

const publisheddashboard_dashboards_dashboard_centercolumn_searchform = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_searchformElemID,
  annotations: {
  },
  fields: {
    savedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    isminimized: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_searchform)

const publisheddashboard_dashboards_dashboard_centercolumn_settingsElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_settings')

const publisheddashboard_dashboards_dashboard_centercolumn_settings = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_settingsElemID,
  annotations: {
  },
  fields: {
    isminimized: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_settings)

const publisheddashboard_dashboards_dashboard_centercolumn_shortcutsElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_shortcuts')

const publisheddashboard_dashboards_dashboard_centercolumn_shortcuts = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_shortcutsElemID,
  annotations: {
  },
  fields: {
    isminimized: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_shortcuts)

const publisheddashboard_dashboards_dashboard_centercolumn_tasklinksElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_tasklinks')

const publisheddashboard_dashboards_dashboard_centercolumn_tasklinks = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_tasklinksElemID,
  annotations: {
  },
  fields: {
    isminimized: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_dashboards_dashboard_centercolumn_tasklinks)

const publisheddashboard_dashboards_dashboard_centercolumn_trendgraphElemID = new ElemID(constants.NETSUITE, 'publisheddashboard_dashboards_dashboard_centercolumn_trendgraph')

const publisheddashboard_dashboards_dashboard_centercolumn_trendgraph = new ObjectType({
  elemID: publisheddashboard_dashboards_dashboard_centercolumn_trendgraphElemID,
  annotations: {
  },
  fields: {
    kpi: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see the following lists:   snapshot_type_trendgraph   snapshot_type_custom */
    trendtype: {
      refType: createRefToElmWithValue(enums.portlet_trendgraph_trendtype),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see portlet_trendgraph_trendtype. */
    movingaverageperiod: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field value must range from 1 through 10. (inclusive)   The default value is '2'. */
    savedsearch: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field is available when the kpi value is present in snapshot_type_custom.   This field is mandatory when the kpi value is present in snapshot_type_custom.   This field accepts references to the savedsearch custom type. */
    isminimized: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    backgroundtype: {
      refType: createRefToElmWithValue(enums.portlet_trendgraph_backgroundtype),
      annotations: {
      },
    }, /* Original description: For information about possible values, see portlet_trendgraph_backgroundtype.   The default value is 'GLOBAL_BACKGROUND'. */
    charttheme: {
      refType: createRefToElmWithValue(enums.portlet_trendgraph_charttheme),
      annotations: {
      },
    }, /* Original description: For information about possible values, see portlet_trendgraph_charttheme.   The default value is 'GLOBAL_THEME'. */
    customseriescolor: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was rgb   RGB field types must be set to a valid 6–digit hexadecimal value between #000000 and #FFFFFF. The # prefix is optional. */),
      annotations: {
      },
    },
    defaultcharttype: {
      refType: createRefToElmWithValue(enums.portlet_trendgraph_charttype),
      annotations: {
      },
    }, /* Original description: For information about possible values, see portlet_trendgraph_charttype.   The default value is 'AREA'. */
    includezeroonyaxis: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    showmovingaverage: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
    showlastdatapoint: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is T. */
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
    analytics: {
      refType: createRefToElmWithValue(new ListType(publisheddashboard_dashboards_dashboard_centercolumn_analytics)),
      annotations: {
      },
    },
    calendar: {
      refType: createRefToElmWithValue(new ListType(publisheddashboard_dashboards_dashboard_centercolumn_calendar)),
      annotations: {
      },
    },
    customportlet: {
      refType: createRefToElmWithValue(new ListType(publisheddashboard_dashboards_dashboard_centercolumn_customportlet)),
      annotations: {
      },
    },
    customsearch: {
      refType: createRefToElmWithValue(new ListType(publisheddashboard_dashboards_dashboard_centercolumn_customsearch)),
      annotations: {
      },
    },
    keyperformanceindicators: {
      refType: createRefToElmWithValue(new ListType(publisheddashboard_dashboards_dashboard_centercolumn_keyperformanceindicators)),
      annotations: {
      },
    },
    kpimeter: {
      refType: createRefToElmWithValue(new ListType(publisheddashboard_dashboards_dashboard_centercolumn_kpimeter)),
      annotations: {
      },
    },
    kpireport: {
      refType: createRefToElmWithValue(new ListType(publisheddashboard_dashboards_dashboard_centercolumn_kpireport)),
      annotations: {
      },
    },
    list: {
      refType: createRefToElmWithValue(new ListType(publisheddashboard_dashboards_dashboard_centercolumn_list)),
      annotations: {
      },
    },
    quicksearch: {
      refType: createRefToElmWithValue(new ListType(publisheddashboard_dashboards_dashboard_centercolumn_quicksearch)),
      annotations: {
      },
    },
    recentrecords: {
      refType: createRefToElmWithValue(new ListType(publisheddashboard_dashboards_dashboard_centercolumn_recentrecords)),
      annotations: {
      },
    },
    recentreports: {
      refType: createRefToElmWithValue(new ListType(publisheddashboard_dashboards_dashboard_centercolumn_recentreports)),
      annotations: {
      },
    },
    reminders: {
      refType: createRefToElmWithValue(new ListType(publisheddashboard_dashboards_dashboard_centercolumn_reminders)),
      annotations: {
      },
    },
    scheduler: {
      refType: createRefToElmWithValue(new ListType(publisheddashboard_dashboards_dashboard_centercolumn_scheduler)),
      annotations: {
      },
    },
    searchform: {
      refType: createRefToElmWithValue(new ListType(publisheddashboard_dashboards_dashboard_centercolumn_searchform)),
      annotations: {
      },
    },
    settings: {
      refType: createRefToElmWithValue(new ListType(publisheddashboard_dashboards_dashboard_centercolumn_settings)),
      annotations: {
      },
    },
    shortcuts: {
      refType: createRefToElmWithValue(new ListType(publisheddashboard_dashboards_dashboard_centercolumn_shortcuts)),
      annotations: {
      },
    },
    tasklinks: {
      refType: createRefToElmWithValue(new ListType(publisheddashboard_dashboards_dashboard_centercolumn_tasklinks)),
      annotations: {
      },
    },
    trendgraph: {
      refType: createRefToElmWithValue(new ListType(publisheddashboard_dashboards_dashboard_centercolumn_trendgraph)),
      annotations: {
      },
    },
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
    centertab: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the centertab custom type.   For information about other possible values, see generic_centertab. */
    mode: {
      refType: createRefToElmWithValue(enums.dashboard_mode),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see dashboard_mode.   The default value is 'UNLOCKED'. */
    layout: {
      refType: createRefToElmWithValue(enums.dashboard_layout),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see dashboard_layout.   The default value is 'TWO_COLUMN'. */
    centercolumn: {
      refType: createRefToElmWithValue(publisheddashboard_dashboards_dashboard_centercolumn),
      annotations: {
      },
    },
    leftcolumn: {
      refType: createRefToElmWithValue(publisheddashboard_dashboards_dashboard_leftcolumn),
      annotations: {
      },
    },
    rightcolumn: {
      refType: createRefToElmWithValue(publisheddashboard_dashboards_dashboard_rightcolumn),
      annotations: {
      },
    },
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
    dashboard: {
      refType: createRefToElmWithValue(new ListType(publisheddashboard_dashboards_dashboard)),
      annotations: {
      },
    },
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
    role: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the role custom type.   For information about other possible values, see generic_role. */
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
    role: {
      refType: createRefToElmWithValue(new ListType(publisheddashboard_roles_role)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})

publisheddashboardInnerTypes.push(publisheddashboard_roles)


export const publisheddashboard = new ObjectType({
  elemID: publisheddashboardElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^custpubdashboard[0-9a-z_]+' }),
      },
    }, /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custpubdashboard’. */
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 30,
      },
    }, /* Original description: This field value can be up to 30 characters long. */
    center: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the center custom type.   For information about other possible values, see role_centertype. */
    lockshortcuts: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    locknewbar: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    notes: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 4000,
      },
    }, /* Original description: This field value can be up to 4000 characters long. */
    dashboards: {
      refType: createRefToElmWithValue(publisheddashboard_dashboards),
      annotations: {
      },
    },
    roles: {
      refType: createRefToElmWithValue(publisheddashboard_roles),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, publisheddashboardElemID.name],
})
