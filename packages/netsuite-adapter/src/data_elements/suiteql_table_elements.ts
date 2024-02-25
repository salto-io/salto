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
import _ from 'lodash'
import Ajv from 'ajv'
import { logger } from '@salto-io/logging'
import { collections, regex, strings } from '@salto-io/lowerdash'
import {
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReadOnlyElementsSource,
  TopLevelElement,
  createRefToElmWithValue,
  isInstanceElement,
} from '@salto-io/adapter-api'
import NetsuiteClient from '../client/client'
import { NetsuiteConfig } from '../config/types'
import { ALLOCATION_TYPE, EMPLOYEE, NETSUITE, PROJECT_EXPENSE_TYPE, TAX_SCHEDULE } from '../constants'
import { getLastServerTime } from '../server_time'
import { toSuiteQLWhereDateString } from '../changes_detector/date_formats'
import { SuiteQLTableName } from './types'

const log = logger(module)
const { awu } = collections.asynciterable

export const SUITEQL_TABLE = 'suiteql_table'
export const INTERNAL_IDS_MAP = 'internalIdsMap'

const VERSION_FIELD = 'version'
const LATEST_VERSION = 1

const ALLOCATION_TYPE_QUERY_LIMIT = 50

const MAX_ALLOWED_RECORDS = 100_000

type InternalIdsMap = Record<string, { name: string }>

type QueryParams = {
  internalIdField: 'id' | 'key'
  nameField: string
  lastModifiedDateField?: 'lastmodifieddate'
}

type SavedSearchInternalIdsResult = {
  internalid: [
    {
      value: string
    },
  ]
  name: string
}

type AllocationTypeSearchResult = {
  [ALLOCATION_TYPE]: [
    {
      value: string
      text: string
    },
  ]
}

const SAVED_SEARCH_INTERNAL_IDS_RESULT_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    required: ['name', 'internalid'],
    properties: {
      name: {
        type: 'string',
      },
      internalid: {
        type: 'array',
        maxItems: 1,
        minItems: 1,
        items: {
          type: 'object',
          required: ['value'],
          properties: {
            value: {
              type: 'string',
            },
          },
        },
      },
    },
  },
}

const ALLOCATION_TYPE_SEARCH_RESULT_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    required: [ALLOCATION_TYPE],
    properties: {
      [ALLOCATION_TYPE]: {
        type: 'array',
        maxItems: 1,
        minItems: 1,
        items: {
          type: 'object',
          required: ['value', 'text'],
          properties: {
            value: {
              type: 'string',
            },
            text: {
              type: 'string',
            },
          },
        },
      },
    },
  },
}

export const QUERIES_BY_TABLE_NAME: Record<SuiteQLTableName, QueryParams | undefined> = {
  item: {
    internalIdField: 'id',
    nameField: 'itemid',
    lastModifiedDateField: 'lastmodifieddate',
  },
  transaction: {
    internalIdField: 'id',
    nameField: 'trandisplayname',
    lastModifiedDateField: 'lastmodifieddate',
  },
  account: {
    internalIdField: 'id',
    nameField: 'accountsearchdisplayname',
    lastModifiedDateField: 'lastmodifieddate',
  },
  bom: {
    internalIdField: 'id',
    nameField: 'name',
    lastModifiedDateField: 'lastmodifieddate',
  },
  customer: {
    internalIdField: 'id',
    nameField: 'companyname',
    lastModifiedDateField: 'lastmodifieddate',
  },
  accountingPeriod: {
    internalIdField: 'id',
    nameField: 'periodname',
    lastModifiedDateField: 'lastmodifieddate',
  },
  calendarEvent: {
    internalIdField: 'id',
    nameField: 'title',
    lastModifiedDateField: 'lastmodifieddate',
  },
  charge: {
    internalIdField: 'id',
    nameField: 'description',
    lastModifiedDateField: 'lastmodifieddate',
  },
  classification: {
    internalIdField: 'id',
    nameField: 'name',
    lastModifiedDateField: 'lastmodifieddate',
  },
  contact: {
    internalIdField: 'id',
    nameField: 'entitytitle',
    lastModifiedDateField: 'lastmodifieddate',
  },
  currency: {
    internalIdField: 'id',
    nameField: 'name',
    lastModifiedDateField: 'lastmodifieddate',
  },
  department: {
    internalIdField: 'id',
    nameField: 'name',
    lastModifiedDateField: 'lastmodifieddate',
  },
  employee: {
    internalIdField: 'id',
    nameField: 'entityid',
    lastModifiedDateField: 'lastmodifieddate',
  },
  expenseCategory: {
    internalIdField: 'id',
    nameField: 'name',
    lastModifiedDateField: 'lastmodifieddate',
  },
  generalToken: {
    internalIdField: 'id',
    nameField: 'externalid',
    lastModifiedDateField: 'lastmodifieddate',
  },
  inventoryNumber: {
    internalIdField: 'id',
    nameField: 'inventorynumber',
    lastModifiedDateField: 'lastmodifieddate',
  },
  job: {
    internalIdField: 'id',
    nameField: 'companyname',
    lastModifiedDateField: 'lastmodifieddate',
  },
  location: {
    internalIdField: 'id',
    nameField: 'name',
    lastModifiedDateField: 'lastmodifieddate',
  },
  manufacturingCostTemplate: {
    internalIdField: 'id',
    nameField: 'name',
    lastModifiedDateField: 'lastmodifieddate',
  },
  partner: {
    internalIdField: 'id',
    nameField: 'companyname',
    lastModifiedDateField: 'lastmodifieddate',
  },
  paymentCard: {
    internalIdField: 'id',
    nameField: 'nameoncard',
    lastModifiedDateField: 'lastmodifieddate',
  },
  paymentCardToken: {
    internalIdField: 'id',
    nameField: 'externalid',
    lastModifiedDateField: 'lastmodifieddate',
  },
  paymentMethod: {
    internalIdField: 'id',
    nameField: 'name',
    lastModifiedDateField: 'lastmodifieddate',
  },
  phoneCall: {
    internalIdField: 'id',
    nameField: 'title',
    lastModifiedDateField: 'lastmodifieddate',
  },
  priceLevel: {
    internalIdField: 'id',
    nameField: 'name',
    lastModifiedDateField: 'lastmodifieddate',
  },
  pricingGroup: {
    internalIdField: 'id',
    nameField: 'name',
    lastModifiedDateField: 'lastmodifieddate',
  },
  subsidiary: {
    internalIdField: 'id',
    nameField: 'name',
    lastModifiedDateField: 'lastmodifieddate',
  },
  task: {
    internalIdField: 'id',
    nameField: 'title',
    lastModifiedDateField: 'lastmodifieddate',
  },
  term: {
    internalIdField: 'id',
    nameField: 'name',
    lastModifiedDateField: 'lastmodifieddate',
  },
  timeBill: {
    internalIdField: 'id',
    nameField: 'displayfield',
    lastModifiedDateField: 'lastmodifieddate',
  },
  unitsType: {
    internalIdField: 'id',
    nameField: 'name',
    lastModifiedDateField: 'lastmodifieddate',
  },
  usage: {
    internalIdField: 'id',
    nameField: 'externalid',
    lastModifiedDateField: 'lastmodifieddate',
  },
  vendor: {
    internalIdField: 'id',
    nameField: 'entitytitle',
    lastModifiedDateField: 'lastmodifieddate',
  },
  vendorCategory: {
    internalIdField: 'id',
    nameField: 'name',
    lastModifiedDateField: 'lastmodifieddate',
  },

  // tables with no 'lastmodifieddate' field
  billingSchedule: {
    internalIdField: 'id',
    nameField: 'name',
  },
  budgetCategory: {
    internalIdField: 'id',
    nameField: 'name',
  },
  campaignAudience: {
    internalIdField: 'id',
    nameField: 'name',
  },
  campaignCategory: {
    internalIdField: 'id',
    nameField: 'name',
  },
  campaignChannel: {
    internalIdField: 'id',
    nameField: 'name',
  },
  campaignFamily: {
    internalIdField: 'id',
    nameField: 'name',
  },
  campaignOffer: {
    internalIdField: 'id',
    nameField: 'name',
  },
  campaignSearchEngine: {
    internalIdField: 'id',
    nameField: 'name',
  },
  campaignSubscription: {
    internalIdField: 'id',
    nameField: 'name',
  },
  campaignVertical: {
    internalIdField: 'id',
    nameField: 'name',
  },
  contactCategory: {
    internalIdField: 'id',
    nameField: 'name',
  },
  contactRole: {
    internalIdField: 'id',
    nameField: 'name',
  },
  costCategory: {
    internalIdField: 'id',
    nameField: 'name',
  },
  customerCategory: {
    internalIdField: 'id',
    nameField: 'name',
  },
  customerMessage: {
    internalIdField: 'id',
    nameField: 'name',
  },
  jobType: {
    internalIdField: 'id',
    nameField: 'name',
  },
  nexus: {
    internalIdField: 'id',
    nameField: 'description',
  },
  manufacturingRouting: {
    internalIdField: 'id',
    nameField: 'name',
  },
  otherNameCategory: {
    internalIdField: 'id',
    nameField: 'name',
  },
  payrollItem: {
    internalIdField: 'id',
    nameField: 'name',
  },
  promotionCode: {
    internalIdField: 'id',
    nameField: 'name',
  },
  salesRole: {
    internalIdField: 'id',
    nameField: 'name',
  },
  solution: {
    internalIdField: 'id',
    nameField: 'title',
  },
  supportCase: {
    internalIdField: 'id',
    nameField: 'title',
  },
  supportCasePriority: {
    internalIdField: 'id',
    nameField: 'name',
  },
  supportCaseStatus: {
    internalIdField: 'id',
    nameField: 'name',
  },
  entityStatus: {
    internalIdField: 'key',
    nameField: 'name',
  },
  campaignEvent: {
    internalIdField: 'id',
    nameField: 'description',
  },

  // could not find table
  address: undefined,
  billingAccount: undefined,
  campaign: undefined,
  customerStatus: undefined,
  globalAccountMapping: undefined,
  hcmJob: undefined,
  inventoryDetail: undefined,
  issue: undefined,
  itemAccountMapping: undefined,
  itemRevision: undefined,
  noteType: undefined,
  opportunity: undefined,
  partnerCategory: undefined,
  supportCaseIssue: undefined,
  supportCaseOrigin: undefined,
  supportCaseType: undefined,
  timeEntry: undefined,
  timeSheet: undefined,
  winLossReason: undefined,

  // has table, but no relevant info
  bin: undefined,
  consolidatedExchangeRate: undefined,
  inboundShipment: undefined,
  note: undefined,
  salesTaxItem: undefined,

  // needs multiple fields for uniqueness
  bomRevision: undefined,
  manufacturingOperationTask: undefined,
  projectTask: undefined,

  // have fields that reference other tables
  campaignResponse: undefined,
  fairValuePrice: undefined,
  itemDemandPlan: undefined,
  itemSupplyPlan: undefined,
  resourceAllocation: undefined,

  // referenced by scriptid
  customList: undefined,
  customRecordType: undefined,
  customfield: undefined,
  script: undefined,
  role: undefined,
  workflow: undefined,
  customrecordtype: undefined,
}

export const getSuiteQLTableInternalIdsMap = (instance: InstanceElement): InternalIdsMap => {
  // value[INTERNAL_IDS_MAP] can be undefined because transformElement transform empty objects to undefined
  if (instance.value[INTERNAL_IDS_MAP] === undefined) {
    instance.value[INTERNAL_IDS_MAP] = {}
  }
  return instance.value[INTERNAL_IDS_MAP]
}

export const getSuiteQLNameToInternalIdsMap = async (
  elementsSource: ReadOnlyElementsSource,
): Promise<Record<string, Record<string, string[]>>> => {
  const suiteQLTableInstances = await awu(await elementsSource.list())
    .filter(elemId => elemId.idType === 'instance' && elemId.typeName === SUITEQL_TABLE)
    .map(elemId => elementsSource.get(elemId))
    .filter(isInstanceElement)
    .toArray()

  return _(suiteQLTableInstances)
    .keyBy(instance => instance.elemID.name)
    .mapValues(getSuiteQLTableInternalIdsMap)
    .mapValues(internalIdsMap =>
      _(internalIdsMap)
        .entries()
        .groupBy(([_key, value]) => value.name)
        .mapValues(rows => rows.map(([key, _value]) => key))
        .value(),
    )
    .value()
}

const getWhereParam = (
  { lastModifiedDateField }: Pick<QueryParams, 'lastModifiedDateField'>,
  lastFetchTime: Date | undefined,
): string =>
  lastModifiedDateField !== undefined && lastFetchTime !== undefined
    ? `WHERE ${lastModifiedDateField} >= ${toSuiteQLWhereDateString(lastFetchTime)}`
    : ''

const shouldSkipQuery = async (
  client: NetsuiteClient,
  tableName: string,
  queryParams: QueryParams,
  lastFetchTime: Date | undefined,
  maxAllowedRecords: number,
): Promise<{ skip: boolean; exclude?: boolean }> => {
  const whereParam = getWhereParam(queryParams, lastFetchTime)
  const queryString = `SELECT count(*) as count FROM ${tableName} ${whereParam}`
  const results = await client.runSuiteQL(queryString)
  if (results?.length !== 1) {
    log.warn('query received unexpected number of results: %o', { queryString, numOfResults: results?.length })
    return { skip: true }
  }
  const [result] = results
  if (!_.isString(result.count) || !strings.isNumberStr(result.count)) {
    log.warn('query received unexpected result (expected "count" to be a number string): %o', { queryString, result })
    return { skip: true }
  }
  const count = Number(result.count)
  if (count > maxAllowedRecords) {
    log.warn(
      `skipping query of ${tableName}${whereParam !== '' ? ` (${whereParam})` : ''} because it has ${count} results (max allowed: ${maxAllowedRecords})`,
    )
    return { skip: true, exclude: true }
  }
  return { skip: false }
}

const getInternalIdsMap = async (
  client: NetsuiteClient,
  tableName: string,
  { internalIdField, nameField, lastModifiedDateField }: QueryParams,
  lastFetchTime: Date | undefined,
): Promise<InternalIdsMap> => {
  const whereLastModified = getWhereParam({ lastModifiedDateField }, lastFetchTime)
  const queryString = `SELECT ${internalIdField}, ${nameField} FROM ${tableName} ${whereLastModified} ORDER BY ${internalIdField} ASC`
  const results = await client.runSuiteQL(queryString)
  if (results === undefined) {
    log.warn('failed to query table %s', tableName)
    return {}
  }
  const validResults = results.flatMap(res => {
    const internalId = res[internalIdField]
    const name = res[nameField]
    if (typeof internalId === 'string' && internalId !== '' && typeof name === 'string' && name !== '') {
      return { internalId, name }
    }
    log.warn('ignoring invalid result from table %s: %o', tableName, res)
    return []
  })
  return Object.fromEntries(validResults.map(({ internalId, name }) => [internalId, { name }]))
}

const isUpdatedExistingInstance = (
  existingInstance: InstanceElement | undefined,
): existingInstance is InstanceElement => existingInstance?.value[VERSION_FIELD] === LATEST_VERSION

const createOrGetExistingInstance = (
  suiteQLTableType: ObjectType,
  tableName: string,
  existingInstance: InstanceElement | undefined,
): InstanceElement =>
  isUpdatedExistingInstance(existingInstance)
    ? existingInstance
    : new InstanceElement(tableName, suiteQLTableType, { [INTERNAL_IDS_MAP]: {} }, undefined, {
        [CORE_ANNOTATIONS.HIDDEN]: true,
      })

const fixExistingInstance = (suiteQLTableType: ObjectType, existingInstance: InstanceElement | undefined): void => {
  if (existingInstance !== undefined) {
    existingInstance.refType = createRefToElmWithValue(suiteQLTableType)
    if (existingInstance.value[INTERNAL_IDS_MAP] === undefined) {
      existingInstance.value[INTERNAL_IDS_MAP] = {}
    }
  }
}

const getSuiteQLTableInstance = async (
  client: NetsuiteClient,
  suiteQLTableType: ObjectType,
  tableName: string,
  queryParams: QueryParams,
  elementsSource: ReadOnlyElementsSource,
  lastFetchTime: Date | undefined,
  isPartial: boolean,
  maxAllowedRecords: number,
  largeSuiteQLTables: string[],
): Promise<InstanceElement | undefined> => {
  const instanceElemId = suiteQLTableType.elemID.createNestedID('instance', tableName)
  const existingInstance = await elementsSource.get(instanceElemId)
  fixExistingInstance(suiteQLTableType, existingInstance)

  const lastFetchTimeForQuery = isUpdatedExistingInstance(existingInstance) ? lastFetchTime : undefined

  // we always want to query employees, for _changed_by
  if (tableName !== EMPLOYEE) {
    if (isPartial) {
      return existingInstance
    }
    const shouldSkip = await shouldSkipQuery(client, tableName, queryParams, lastFetchTimeForQuery, maxAllowedRecords)
    if (shouldSkip.skip) {
      if (shouldSkip.exclude) {
        largeSuiteQLTables.push(tableName)
      }
      return undefined
    }
  }

  const instance = createOrGetExistingInstance(suiteQLTableType, tableName, existingInstance)
  Object.assign(
    instance.value[INTERNAL_IDS_MAP],
    await getInternalIdsMap(client, tableName, queryParams, lastFetchTimeForQuery),
  )
  instance.value[VERSION_FIELD] = LATEST_VERSION
  return instance
}

const getSavedSearchQueryInstance = async (
  client: NetsuiteClient,
  suiteQLTableType: ObjectType,
  searchType: string,
  elementsSource: ReadOnlyElementsSource,
  isPartial: boolean,
): Promise<InstanceElement | undefined> => {
  const instanceElemId = suiteQLTableType.elemID.createNestedID('instance', searchType)
  const existingInstance = await elementsSource.get(instanceElemId)
  fixExistingInstance(suiteQLTableType, existingInstance)
  if (isPartial) {
    return existingInstance
  }
  const instance = createOrGetExistingInstance(suiteQLTableType, searchType, existingInstance)
  const result = await client.runSavedSearchQuery({
    type: searchType,
    columns: ['internalid', 'name'],
    filters: [],
  })
  const ajv = new Ajv({ allErrors: true, strict: false })
  if (result === undefined) {
    log.warn('failed to search %s using saved search query', searchType)
  } else if (!ajv.validate<SavedSearchInternalIdsResult[]>(SAVED_SEARCH_INTERNAL_IDS_RESULT_SCHEMA, result)) {
    log.error('Got invalid results from %s saved search query: %s', searchType, ajv.errorsText())
  } else {
    instance.value[INTERNAL_IDS_MAP] = Object.fromEntries(
      result.map(res => [res.internalid[0].value, { name: res.name }]),
    )
  }
  instance.value[VERSION_FIELD] = LATEST_VERSION
  return instance
}

const getAllocationTypeInstance = async (
  client: NetsuiteClient,
  suiteQLTableType: ObjectType,
  elementsSource: ReadOnlyElementsSource,
  isPartial: boolean,
): Promise<InstanceElement | undefined> => {
  const instanceElemId = suiteQLTableType.elemID.createNestedID('instance', ALLOCATION_TYPE)
  const existingInstance = await elementsSource.get(instanceElemId)
  fixExistingInstance(suiteQLTableType, existingInstance)
  if (isPartial) {
    return existingInstance
  }
  const instance = createOrGetExistingInstance(suiteQLTableType, ALLOCATION_TYPE, existingInstance)
  const ajv = new Ajv({ allErrors: true, strict: false })
  const getAllocationTypes = async (exclude: string[] = []): Promise<Record<string, { name: string }>> => {
    const result = await client.runSavedSearchQuery(
      {
        type: 'resourceAllocation',
        columns: [ALLOCATION_TYPE],
        filters: exclude.length > 0 ? [[ALLOCATION_TYPE, 'noneof', ...exclude]] : [],
      },
      ALLOCATION_TYPE_QUERY_LIMIT,
    )
    if (result === undefined) {
      log.warn('failed to search %s using saved search query', ALLOCATION_TYPE)
      return {}
    }
    if (!ajv.validate<AllocationTypeSearchResult[]>(ALLOCATION_TYPE_SEARCH_RESULT_SCHEMA, result)) {
      log.error('Got invalid results from %s saved search query: %s', ALLOCATION_TYPE, ajv.errorsText())
      return {}
    }
    const internalIdToName = Object.fromEntries(
      result.map(row => [row[ALLOCATION_TYPE][0].value, { name: row[ALLOCATION_TYPE][0].text }]),
    )
    if (result.length < ALLOCATION_TYPE_QUERY_LIMIT) {
      return internalIdToName
    }
    return {
      ...internalIdToName,
      ...(await getAllocationTypes(Object.keys(internalIdToName).concat(exclude))),
    }
  }
  instance.value[INTERNAL_IDS_MAP] = await getAllocationTypes()
  instance.value[VERSION_FIELD] = LATEST_VERSION
  return instance
}

const getAdditionalInstances = (
  client: NetsuiteClient,
  suiteQLTableType: ObjectType,
  elementsSource: ReadOnlyElementsSource,
  isPartial: boolean,
  shouldSkipSuiteQLTable: (tableName: string) => boolean,
): Promise<InstanceElement | undefined>[] => [
  shouldSkipSuiteQLTable(TAX_SCHEDULE)
    ? Promise.resolve(undefined)
    : getSavedSearchQueryInstance(client, suiteQLTableType, TAX_SCHEDULE, elementsSource, isPartial),
  shouldSkipSuiteQLTable(PROJECT_EXPENSE_TYPE)
    ? Promise.resolve(undefined)
    : getSavedSearchQueryInstance(client, suiteQLTableType, PROJECT_EXPENSE_TYPE, elementsSource, isPartial),
  shouldSkipSuiteQLTable(ALLOCATION_TYPE)
    ? Promise.resolve(undefined)
    : getAllocationTypeInstance(client, suiteQLTableType, elementsSource, isPartial),
]

const getMaxAllowedRecordsForTable = (config: NetsuiteConfig, tableName: string): number => {
  const maxAllowedRecords = (config.suiteAppClient?.maxRecordsPerSuiteQLTable ?? [])
    .filter(maxType => regex.isFullRegexMatch(tableName, maxType.name))
    .map(maxType => maxType.limit)
  if (maxAllowedRecords.length === 0) {
    return MAX_ALLOWED_RECORDS
  }
  return Math.max(...maxAllowedRecords)
}

export const getSuiteQLTableElements = async (
  config: NetsuiteConfig,
  client: NetsuiteClient,
  elementsSource: ReadOnlyElementsSource,
  isPartial: boolean,
): Promise<{ elements: TopLevelElement[]; largeSuiteQLTables: string[] }> => {
  if (config.fetch.resolveAccountSpecificValues !== true || !client.isSuiteAppConfigured()) {
    return { elements: [], largeSuiteQLTables: [] }
  }
  const suiteQLTableType = new ObjectType({
    elemID: new ElemID(NETSUITE, SUITEQL_TABLE),
    annotations: { [CORE_ANNOTATIONS.HIDDEN]: true },
  })

  const shouldSkipSuiteQLTable = (tableName: string): boolean => {
    const shouldSkip = (config.fetch.skipResolvingAccountSpecificValuesToTypes ?? []).some(name =>
      regex.isFullRegexMatch(tableName, name),
    )
    if (shouldSkip) {
      log.debug('skipping query of SuiteQL table %s', tableName)
    }
    return shouldSkip
  }

  const largeSuiteQLTables: string[] = []
  const lastFetchTime = await getLastServerTime(elementsSource)
  const instances = await Promise.all(
    Object.entries(QUERIES_BY_TABLE_NAME)
      .map(([tableName, queryParams]) => {
        if (queryParams === undefined || shouldSkipSuiteQLTable(tableName)) {
          return undefined
        }
        return getSuiteQLTableInstance(
          client,
          suiteQLTableType,
          tableName,
          queryParams,
          elementsSource,
          lastFetchTime,
          isPartial,
          getMaxAllowedRecordsForTable(config, tableName),
          largeSuiteQLTables,
        )
      })
      .concat(getAdditionalInstances(client, suiteQLTableType, elementsSource, isPartial, shouldSkipSuiteQLTable)),
  ).then(res => res.flatMap(instance => instance ?? []))

  return {
    elements: [suiteQLTableType, ...instances],
    largeSuiteQLTables,
  }
}
