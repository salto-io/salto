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
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
import * as constants from '../../constants'

export const savedsearchInnerTypes: ObjectType[] = []

const savedsearchElemID = new ElemID(constants.NETSUITE, 'savedsearch')
const savedsearch_dependenciesElemID = new ElemID(constants.NETSUITE, 'savedsearch_dependencies')
const savedsearch_filterRecordElemID = new ElemID(constants.NETSUITE, 'savedsearch_filterRecord')
const savedsearch_availableFilterElemID = new ElemID(constants.NETSUITE, 'savedsearch_availableFilter')
const savedsearch_returnFieldElemID = new ElemID(constants.NETSUITE, 'savedsearch_returnField')
const savedsearch_sortColumnsElemID = new ElemID(constants.NETSUITE, 'savedsearch_sortColumns')
const savedsearch_alertRecipientsElemID = new ElemID(constants.NETSUITE, 'savedsearch_alertRecipients')
const savedsearch_filterElemID = new ElemID(constants.NETSUITE, 'savedsearch_filter')
const savedsearch_audienceElemID = new ElemID(constants.NETSUITE, 'savedsearch_audience')

const savedSearchFilterRecord = new ObjectType({
  elemID: savedsearch_filterRecordElemID,
  annotations: {
  },
  fields: {
    KEY_ID: { refType: BuiltinTypes.NUMBER },
    FIELD_VALUE: { refType: BuiltinTypes.STRING },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, savedsearchElemID.name],
})

const savedSearchFilter = new ObjectType({
  elemID: savedsearch_filterElemID,
  annotations: {
  },
  fields: {
    FLAG_DATE_TIME_SECOND: { refType: BuiltinTypes.BOOLEAN },
    FLAG_FROM_AVAILABLE_FILTER: { refType: BuiltinTypes.BOOLEAN },
    FLAG_NOT: { refType: BuiltinTypes.BOOLEAN },
    FLAG_OR: { refType: BuiltinTypes.BOOLEAN },
    FIELD_OR_CLAUSE_STATUS: { refType: BuiltinTypes.STRING },
    FIELD_NUM_LEFT_PARENS: { refType: BuiltinTypes.NUMBER },
    FIELD_NUM_RIGHT_PARENS: { refType: BuiltinTypes.NUMBER },
    FIELD_FILTER_NAME: { refType: BuiltinTypes.STRING },
    FIELD_FORMULA: { refType: BuiltinTypes.STRING },
    FIELD_MODIFIER: { refType: BuiltinTypes.STRING },
    FIELD_ATTRIBUTE: { refType: BuiltinTypes.STRING },
    FIELD_TYPE: { refType: BuiltinTypes.STRING },
    RECORDS: { refType: new ListType(savedSearchFilterRecord) },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, savedsearchElemID.name],
})

const savedSearchAvailableFilter = new ObjectType({
  elemID: savedsearch_availableFilterElemID,
  annotations: {
  },
  fields: {
    SEQ_NUMBER: { refType: BuiltinTypes.NUMBER },
    FIELD_NAME: { refType: BuiltinTypes.STRING },
    FIELD_CUSTOM_LABEL: { refType: BuiltinTypes.STRING },
    FLAG_FOOTER: { refType: BuiltinTypes.BOOLEAN },
    FLAG_FOOTER_MULTI_SELECT: { refType: BuiltinTypes.BOOLEAN },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, savedsearchElemID.name],
})

const savedSearchReturnField = new ObjectType({
  elemID: savedsearch_returnFieldElemID,
  annotations: {
  },
  fields: {
    FIELD_ALIAS: { refType: BuiltinTypes.STRING },
    FIELD_INDEX: { refType: BuiltinTypes.NUMBER },
    FIELD_LABEL: { refType: BuiltinTypes.STRING },
    FIELD_SUMMARY_LABEL: { refType: BuiltinTypes.STRING },
    FIELD_SUMMARY_TYPE: { refType: BuiltinTypes.STRING },
    FIELD_FUNCTION: { refType: BuiltinTypes.STRING },
    FIELD_FORMULA: { refType: BuiltinTypes.STRING },
    FIELD_FORMULA_ERROR: { refType: BuiltinTypes.BOOLEAN },
    FIELD_ORDERED_BY_ALIAS: { refType: BuiltinTypes.STRING },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, savedsearchElemID.name],
})

const savedSearchSortColumns = new ObjectType({
  elemID: savedsearch_sortColumnsElemID,
  annotations: {
  },
  fields: {
    KEY_FIELD: { refType: BuiltinTypes.STRING },
    FILELD_ORDER: { refType: BuiltinTypes.NUMBER },
    FLAG_DESCENDING: { refType: BuiltinTypes.BOOLEAN },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, savedsearchElemID.name],
})

const savedSearchAlertRecipients = new ObjectType({
  elemID: savedsearch_alertRecipientsElemID,
  annotations: {
  },
  fields: {
    FIELD_NAME: { refType: BuiltinTypes.STRING },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, savedsearchElemID.name],
})

const savedSearchAudience = new ObjectType({
  elemID: savedsearch_audienceElemID,
  annotations: {
  },
  fields: {
    FIELD_NAME: { refType: BuiltinTypes.STRING },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, savedsearchElemID.name],
})

const savedsearch_dependencies = new ObjectType({
  elemID: savedsearch_dependenciesElemID,
  annotations: {
  },
  fields: {
    dependency: {
      refType: createRefToElmWithValue(new ListType(BuiltinTypes.STRING)),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This definition field is set by defining a saved search in NetSuite. For more information, see Defining a Saved Search.   To redefine a saved search, you should customize it in NetSuite and then import the savedsearch object into the SDF project again. You must not manually edit saved searches in SDF. Modifications to the system-generated XML may result in validation and deployment failures. For more information, see Saved Searches as XML Definitions.   This field only accepts references to any custom type. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, savedsearchElemID.name],
})

savedsearchInnerTypes.push(savedsearch_dependencies)
savedsearchInnerTypes.push(savedSearchAlertRecipients)
savedsearchInnerTypes.push(savedSearchSortColumns)
savedsearchInnerTypes.push(savedSearchReturnField)
savedsearchInnerTypes.push(savedSearchAvailableFilter)
savedsearchInnerTypes.push(savedSearchFilterRecord)
savedsearchInnerTypes.push(savedSearchFilter)
savedsearchInnerTypes.push(savedSearchAudience)


export const savedsearch = new ObjectType({
  elemID: savedsearchElemID,
  annotations: {
  },
  fields: {
    KEY_PACKAGE: { refType: BuiltinTypes.STRING },
    KEY_SCRIPT_ID: { refType: BuiltinTypes.STRING },
    FIELD_DEFAULT_NAME: { refType: BuiltinTypes.STRING },
    FIELD_SEARCH_TYPE: { refType: BuiltinTypes.STRING },
    FLAG_PUBLIC: { refType: BuiltinTypes.BOOLEAN },
    FLAG_LIST: { refType: BuiltinTypes.BOOLEAN },
    FLAG_PORTLET: { refType: BuiltinTypes.BOOLEAN },
    FLAG_MACHINE: { refType: BuiltinTypes.BOOLEAN },
    FLAG_REMINDER: { refType: BuiltinTypes.BOOLEAN },
    FLAG_SHOW_LINK: { refType: BuiltinTypes.BOOLEAN },
    FLAG_PREFERRED_LIST: { refType: BuiltinTypes.BOOLEAN },
    FLAG_PREFERRED_PORTLET: { refType: BuiltinTypes.BOOLEAN },
    FLAG_PREFERRED_MACHINE: { refType: BuiltinTypes.BOOLEAN },
    FLAG_PREFERRED_FORM: { refType: BuiltinTypes.BOOLEAN },
    FLAG_PREFERRED_RESULTS: { refType: BuiltinTypes.BOOLEAN },
    KEY_MACHINE_TYPE: { refType: BuiltinTypes.STRING },
    KEY_MACHINE: { refType: BuiltinTypes.STRING },
    FLAG_VIEW_AS_REPORT: { refType: BuiltinTypes.BOOLEAN },
    FLAG_VIEW_AS_GRAPH: { refType: BuiltinTypes.BOOLEAN },
    FLAG_VIEW_AS_GRID: { refType: BuiltinTypes.BOOLEAN },
    FLAG_UNRESTRICTED: { refType: BuiltinTypes.BOOLEAN },
    MAX_ROWS: { refType: BuiltinTypes.NUMBER },
    FLAG_DISABLE_DRILL_DOWN: { refType: BuiltinTypes.BOOLEAN },
    FIELD_CURRENCY_RATE_TYPE: { refType: BuiltinTypes.STRING },
    FLAG_HIDE_FILTER_DROPDOWNS: { refType: BuiltinTypes.BOOLEAN },
    KEY_DEFAULT_TEXT_FIELD_FILTER: { refType: BuiltinTypes.STRING },
    FLAG_AVAILABLE_AS_FEED: { refType: BuiltinTypes.BOOLEAN },
    FLAG_GLOBAL_EDIT: { refType: BuiltinTypes.BOOLEAN },
    FLAG_CSV: { refType: BuiltinTypes.BOOLEAN },
    FLAG_EXCEL: { refType: BuiltinTypes.BOOLEAN },
    FLAG_PDF: { refType: BuiltinTypes.BOOLEAN },
    FIELD_EMAIL_FROM: { refType: BuiltinTypes.STRING },
    FIELD_EMAIL_SUBJECT: { refType: BuiltinTypes.STRING },
    FIELD_EMAIL_BODY: { refType: BuiltinTypes.STRING },
    FIELD_EMAIL_COMMENT: { refType: BuiltinTypes.STRING },
    FLAG_TRIGGERED_ALERT: { refType: BuiltinTypes.BOOLEAN },
    FLAG_SCHEDULED_ALERT: { refType: BuiltinTypes.BOOLEAN },
    FLAG_SCHEDULED_ALERT_SUMMARIES: { refType: BuiltinTypes.BOOLEAN },
    FLAG_SEND_EMPTY_RESULTS: { refType: BuiltinTypes.BOOLEAN },
    FLAG_ALERT_ALLOW_SUBSCRIBE: { refType: BuiltinTypes.BOOLEAN },
    FLAG_ALERT_INCLUDE_VIEW_LINK: { refType: BuiltinTypes.BOOLEAN },
    FLAG_HAS_TOTALS: { refType: BuiltinTypes.BOOLEAN },
    FLAG_INCLUDE_PERIOD_END_TRANSACTIONS: { refType: BuiltinTypes.BOOLEAN },
    FIELD_BULK_OP_CODE: { refType: BuiltinTypes.STRING },
    FIELD_BULK_ENTRY_FORM_PARAMS: { refType: BuiltinTypes.STRING },
    FLAG_BUILT_IN: { refType: BuiltinTypes.BOOLEAN },
    FIELD_OPTIMIZER_HINT: { refType: BuiltinTypes.STRING },
    FLAG_SEND_ON_UPDATE: { refType: BuiltinTypes.BOOLEAN },
    FLAG_SHOW_AUDIT_TRAIL: { refType: BuiltinTypes.BOOLEAN },
    KEY_AUDIENCE: { refType: BuiltinTypes.NUMBER },
    FLAG_AUDIENCE_ALL_CUSTOMERS: { refType: BuiltinTypes.BOOLEAN },
    FLAG_AUDIENCE_ALL_EMPLOYEES: { refType: BuiltinTypes.BOOLEAN },
    FLAG_AUDIENCE_ALL_PARTNERS: { refType: BuiltinTypes.BOOLEAN },
    FLAG_AUDIENCE_ALL_ROLES: { refType: BuiltinTypes.BOOLEAN },
    FLAG_AUDIENCE_ALL_VENDORS: { refType: BuiltinTypes.BOOLEAN },
    FIELD_AUDIENCE_ROLES: { refType: BuiltinTypes.STRING },
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^customsearch[0-9a-z_]+' }),
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customsearch’. */
    definition: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    dependencies: {
      refType: createRefToElmWithValue(savedsearch_dependencies),
      annotations: {
      },
    },
    search_filters: {
      refType: new ListType(savedSearchFilter),
    },
    search_summary_filters: {
      refType: new ListType(savedSearchFilter),
    },
    available_filters: {
      refType: new ListType(savedSearchAvailableFilter),
    },
    return_fields: {
      refType: new ListType(savedSearchReturnField),
    },
    detail_fields: {
      refType: new ListType(savedSearchReturnField),
    },
    sort_columns: {
      refType: savedSearchSortColumns,
    },
    audience: {
      refType: savedSearchAudience,
    },
    alert_recipients: {
      refType: new ListType(savedSearchAlertRecipients),
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, savedsearchElemID.name],
})
