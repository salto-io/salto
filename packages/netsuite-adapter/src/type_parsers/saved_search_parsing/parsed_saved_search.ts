/*
 *                      Copyright 2024 Salto Labs Ltd.
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
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  ObjectType,
  createRestriction,
  ListType,
  createRefToElmWithValue,
  Values,
} from '@salto-io/adapter-api'
import { TypeAndInnerTypes } from '../../types/object_types'
import * as constants from '../../constants'

export type ParsedSavedSearchType = {
  search_filter?: Values[]
  search_summary_filters?: Values[]
  available_filters?: Values[]
  return_fields?: Values[]
  detail_fields?: Values[]
  sort_columns?: Values[]
  audience?: Values
  alert_recipients?: Values[]
}

export const savedsearchType = (): TypeAndInnerTypes => {
  const innerTypes: Record<string, ObjectType> = {}

  const savedSearchElemID = new ElemID(constants.NETSUITE, 'savedsearch')
  const savedSearchDependenciesElemID = new ElemID(constants.NETSUITE, 'savedsearch_dependencies')
  const savedSearchFilterRecordElemID = new ElemID(constants.NETSUITE, 'savedsearch_filterRecord')
  const savedSearchAvailableFilterElemID = new ElemID(constants.NETSUITE, 'savedsearch_availableFilter')
  const savedSearchReturnFieldElemID = new ElemID(constants.NETSUITE, 'savedsearch_returnField')
  const savedSearchSortColumnsElemID = new ElemID(constants.NETSUITE, 'savedsearch_sortColumns')
  const savedSearchAlertRecipientsElemID = new ElemID(constants.NETSUITE, 'savedsearch_alertRecipients')
  const savedSearchFilterElemID = new ElemID(constants.NETSUITE, 'savedsearch_filter')
  const savedSearchAudienceElemID = new ElemID(constants.NETSUITE, 'savedsearch_audience')

  const savedSearchFilterRecord = new ObjectType({
    elemID: savedSearchFilterRecordElemID,
    annotations: {},
    fields: {
      KEY_ID: { refType: BuiltinTypes.NUMBER },
      FIELD_VALUE: { refType: BuiltinTypes.STRING },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, savedSearchElemID.name],
  })

  const savedSearchFilter = new ObjectType({
    elemID: savedSearchFilterElemID,
    annotations: {},
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
    path: [constants.NETSUITE, constants.TYPES_PATH, savedSearchElemID.name],
  })

  const savedSearchAvailableFilter = new ObjectType({
    elemID: savedSearchAvailableFilterElemID,
    annotations: {},
    fields: {
      SEQ_NUMBER: { refType: BuiltinTypes.NUMBER },
      FIELD_NAME: { refType: BuiltinTypes.STRING },
      FIELD_CUSTOM_LABEL: { refType: BuiltinTypes.STRING },
      FLAG_FOOTER: { refType: BuiltinTypes.BOOLEAN },
      FLAG_FOOTER_MULTI_SELECT: { refType: BuiltinTypes.BOOLEAN },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, savedSearchElemID.name],
  })

  const savedSearchReturnField = new ObjectType({
    elemID: savedSearchReturnFieldElemID,
    annotations: {},
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
    path: [constants.NETSUITE, constants.TYPES_PATH, savedSearchElemID.name],
  })

  const savedSearchSortColumns = new ObjectType({
    elemID: savedSearchSortColumnsElemID,
    annotations: {},
    fields: {
      KEY_FIELD: { refType: BuiltinTypes.STRING },
      FILELD_ORDER: { refType: BuiltinTypes.NUMBER },
      FLAG_DESCENDING: { refType: BuiltinTypes.BOOLEAN },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, savedSearchElemID.name],
  })

  const savedSearchAlertRecipients = new ObjectType({
    elemID: savedSearchAlertRecipientsElemID,
    annotations: {},
    fields: {
      FIELD_NAME: { refType: BuiltinTypes.STRING },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, savedSearchElemID.name],
  })

  const savedSearchAudience = new ObjectType({
    elemID: savedSearchAudienceElemID,
    annotations: {},
    fields: {
      FLAG_AUDIENCE_ALL_CUSTOMERS: { refType: BuiltinTypes.BOOLEAN },
      FLAG_AUDIENCE_ALL_EMPLOYEES: { refType: BuiltinTypes.BOOLEAN },
      FLAG_AUDIENCE_ALL_PARTNERS: { refType: BuiltinTypes.BOOLEAN },
      FLAG_AUDIENCE_ALL_ROLES: { refType: BuiltinTypes.BOOLEAN },
      FLAG_AUDIENCE_ALL_VENDORS: { refType: BuiltinTypes.BOOLEAN },
      FIELD_AUDIENCE_ROLES: { refType: BuiltinTypes.STRING },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, savedSearchElemID.name],
  })

  const savedSearchDependencies = new ObjectType({
    elemID: savedSearchDependenciesElemID,
    annotations: {},
    fields: {
      dependency: {
        refType: createRefToElmWithValue(new ListType(BuiltinTypes.STRING)),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      } /* Original description: This definition field is set by defining a saved search in NetSuite. For more information, see Defining a Saved Search.   To redefine a saved search, you should customize it in NetSuite and then import the savedsearch object into the SDF project again. You must not manually edit saved searches in SDF. Modifications to the system-generated XML may result in validation and deployment failures. For more information, see Saved Searches as XML Definitions.   This field only accepts references to any custom type. */,
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, savedSearchElemID.name],
  })

  innerTypes.savedSearchDependencies = savedSearchDependencies
  innerTypes.savedSearchAlertRecipients = savedSearchAlertRecipients
  innerTypes.savedSearchSortColumns = savedSearchSortColumns
  innerTypes.savedSearchReturnField = savedSearchReturnField
  innerTypes.savedSearchAvailableFilter = savedSearchAvailableFilter
  innerTypes.savedSearchFilterRecord = savedSearchFilterRecord
  innerTypes.savedSearchFilter = savedSearchFilter
  innerTypes.savedSearchAudience = savedSearchAudience

  const savedsearch = new ObjectType({
    elemID: savedSearchElemID,
    annotations: {},
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
      scriptid: {
        refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [constants.IS_ATTRIBUTE]: true,
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^customsearch[0-9a-z_]+' }),
        },
      } /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customsearch’. */,
      definition: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      dependencies: {
        refType: createRefToElmWithValue(savedSearchDependencies),
        annotations: {},
      },
      search_filters: {
        refType: createRefToElmWithValue(new ListType(savedSearchFilter)),
      },
      search_summary_filters: {
        refType: createRefToElmWithValue(new ListType(savedSearchFilter)),
      },
      available_filters: {
        refType: createRefToElmWithValue(new ListType(savedSearchAvailableFilter)),
      },
      return_fields: {
        refType: createRefToElmWithValue(new ListType(savedSearchReturnField)),
      },
      detail_fields: {
        refType: createRefToElmWithValue(new ListType(savedSearchReturnField)),
      },
      sort_columns: {
        refType: new ListType(savedSearchSortColumns),
      },
      audience: {
        refType: createRefToElmWithValue(savedSearchAudience),
      },
      alert_recipients: {
        refType: createRefToElmWithValue(new ListType(savedSearchAlertRecipients)),
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, savedSearchElemID.name],
  })

  return { type: savedsearch, innerTypes }
}
