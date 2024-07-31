/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import Ajv, { Schema } from 'ajv'
import { logger } from '@salto-io/logging'
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
import { ALLOCATION_TYPE, NETSUITE, PROJECT_EXPENSE_TYPE, SUPPORT_CASE_PROFILE, TAX_SCHEDULE } from '../constants'
import { SuiteQLTableName } from './types'

const log = logger(module)

export const SUITEQL_TABLE = 'suiteql_table'
export const INTERNAL_IDS_MAP = 'internalIdsMap'

const COLUMN_QUERY_LIMIT = 50
const ITEMS_PER_QUERY_LIMIT = 200

export type MissingInternalId = {
  tableName: string
  name: string
}

export type AdditionalQueryName =
  | typeof TAX_SCHEDULE
  | typeof PROJECT_EXPENSE_TYPE
  | typeof ALLOCATION_TYPE
  | typeof SUPPORT_CASE_PROFILE

type InternalIdsMap = Record<string, { name: string }>

type QueryBy = 'internalId' | 'name'

type QueryParams = {
  internalIdField: 'id' | 'key'
  nameField: string
}

type SavedSearchInternalIdsResult = {
  internalid: [
    {
      value: string
    },
  ]
  name: string
}

type ColumnSearchResult = Record<
  string,
  [
    {
      value: string
      text: string
    },
  ]
>

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

const getColumnSearchResultSchema = (searchColumn: string): Schema => ({
  type: 'array',
  items: {
    type: 'object',
    required: [searchColumn],
    properties: {
      [searchColumn]: {
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
})

export const QUERIES_BY_TABLE_NAME: Record<SuiteQLTableName, QueryParams | undefined> = {
  item: {
    internalIdField: 'id',
    nameField: 'itemid',
  },
  transaction: {
    internalIdField: 'id',
    nameField: 'trandisplayname',
  },
  account: {
    internalIdField: 'id',
    nameField: 'accountsearchdisplayname',
  },
  bom: {
    internalIdField: 'id',
    nameField: 'name',
  },
  customer: {
    internalIdField: 'id',
    nameField: 'companyname',
  },
  accountingPeriod: {
    internalIdField: 'id',
    nameField: 'periodname',
  },
  calendarEvent: {
    internalIdField: 'id',
    nameField: 'title',
  },
  charge: {
    internalIdField: 'id',
    nameField: 'description',
  },
  classification: {
    internalIdField: 'id',
    nameField: 'name',
  },
  contact: {
    internalIdField: 'id',
    nameField: 'entitytitle',
  },
  currency: {
    internalIdField: 'id',
    nameField: 'name',
  },
  department: {
    internalIdField: 'id',
    nameField: 'name',
  },
  employee: {
    internalIdField: 'id',
    nameField: 'entityid',
  },
  expenseCategory: {
    internalIdField: 'id',
    nameField: 'name',
  },
  generalToken: {
    internalIdField: 'id',
    nameField: 'externalid',
  },
  inventoryNumber: {
    internalIdField: 'id',
    nameField: 'inventorynumber',
  },
  job: {
    internalIdField: 'id',
    nameField: 'companyname',
  },
  location: {
    internalIdField: 'id',
    nameField: 'name',
  },
  manufacturingCostTemplate: {
    internalIdField: 'id',
    nameField: 'name',
  },
  partner: {
    internalIdField: 'id',
    nameField: 'companyname',
  },
  paymentCard: {
    internalIdField: 'id',
    nameField: 'nameoncard',
  },
  paymentCardToken: {
    internalIdField: 'id',
    nameField: 'externalid',
  },
  paymentMethod: {
    internalIdField: 'id',
    nameField: 'name',
  },
  phoneCall: {
    internalIdField: 'id',
    nameField: 'title',
  },
  priceLevel: {
    internalIdField: 'id',
    nameField: 'name',
  },
  pricingGroup: {
    internalIdField: 'id',
    nameField: 'name',
  },
  subsidiary: {
    internalIdField: 'id',
    nameField: 'name',
  },
  task: {
    internalIdField: 'id',
    nameField: 'title',
  },
  term: {
    internalIdField: 'id',
    nameField: 'name',
  },
  timeBill: {
    internalIdField: 'id',
    nameField: 'displayfield',
  },
  unitsType: {
    internalIdField: 'id',
    nameField: 'name',
  },
  usage: {
    internalIdField: 'id',
    nameField: 'externalid',
  },
  vendor: {
    internalIdField: 'id',
    nameField: 'entitytitle',
  },
  vendorCategory: {
    internalIdField: 'id',
    nameField: 'name',
  },
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
  revenueRecognitionRule: {
    internalIdField: 'id',
    nameField: 'name',
  },
  incoterm: {
    internalIdField: 'id',
    nameField: 'name',
  },
  approvalStatus: {
    internalIdField: 'id',
    nameField: 'name',
  },
  accountingBook: {
    internalIdField: 'id',
    nameField: 'name',
  },
  shipItem: {
    internalIdField: 'id',
    nameField: 'itemid',
  },
  employeeStatus: {
    internalIdField: 'id',
    nameField: 'name',
  },
  jobResourceRole: {
    internalIdField: 'id',
    nameField: 'name',
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

const getSavedSearchInternalIdsMap =
  (searchType: string) =>
  async (client: NetsuiteClient, queryBy: QueryBy, items: string[]): Promise<InternalIdsMap> => {
    const result = await Promise.all(
      _.chunk(items, ITEMS_PER_QUERY_LIMIT).map(itemsChunk =>
        client.runSavedSearchQuery({
          type: searchType,
          columns: ['internalid', 'name'],
          filters:
            queryBy === 'internalId'
              ? [['internalid', 'anyof', ...itemsChunk]]
              : itemsChunk
                  .map(name => ['name', 'is', name])
                  .reduce(
                    (filter, curr, i) => (i < itemsChunk.length - 1 ? [...filter, curr, 'OR'] : [...filter, curr]),
                    [] as Array<string[] | string>,
                  ),
        }),
      ),
    ).then(results => results.flatMap(res => res ?? []))
    const ajv = new Ajv({ allErrors: true, strict: false })
    if (result.length === 0) {
      log.warn('failed to search %s using saved search query', searchType)
      return {}
    }
    if (!ajv.validate<SavedSearchInternalIdsResult[]>(SAVED_SEARCH_INTERNAL_IDS_RESULT_SCHEMA, result)) {
      log.error('Got invalid results from %s saved search query: %s', searchType, ajv.errorsText())
      return {}
    }
    return Object.fromEntries(result.map(res => [res.internalid[0].value, { name: res.name }]))
  }

const getSavedSearchInternalIdsMapFromColumn =
  (searchType: string, searchColumn: string) =>
  async (client: NetsuiteClient, queryBy: QueryBy, items: string[]): Promise<InternalIdsMap> => {
    const ajv = new Ajv({ allErrors: true, strict: false })
    const getColumnValues = async (exclude: string[] = []): Promise<Record<string, { name: string }>> => {
      const anyOfFilter = [[searchColumn, 'anyof', ..._.difference(items, exclude)]]
      const noneOfFilter = exclude.length > 0 ? [[searchColumn, 'noneof', ...exclude]] : []
      const result = await client.runSavedSearchQuery(
        {
          type: searchType,
          columns: [searchColumn],
          // we can't filter by name, so we query all column values when queryBy='name'
          filters: queryBy === 'internalId' ? anyOfFilter : noneOfFilter,
        },
        COLUMN_QUERY_LIMIT,
      )
      if (result === undefined) {
        log.warn('failed to search %s using saved search query', searchColumn)
        return {}
      }
      if (!ajv.validate<ColumnSearchResult[]>(getColumnSearchResultSchema(searchColumn), result)) {
        log.error(
          'Got invalid results from %s saved search query: %s',
          `${searchType}.${searchColumn}`,
          ajv.errorsText(),
        )
        return {}
      }
      const internalIdToName = Object.fromEntries(
        result.map(row => [row[searchColumn][0].value, { name: row[searchColumn][0].text }]),
      )
      if (result.length < COLUMN_QUERY_LIMIT) {
        return internalIdToName
      }
      return {
        ...internalIdToName,
        ...(await getColumnValues(Object.keys(internalIdToName).concat(exclude))),
      }
    }
    const internalIdsMap = await getColumnValues()
    if (queryBy === 'name') {
      return _.pickBy(internalIdsMap, row => items.includes(row.name))
    }
    return internalIdsMap
  }

const ADDITIONAL_QUERIES: Record<AdditionalQueryName, ReturnType<typeof getSavedSearchInternalIdsMap>> = {
  [TAX_SCHEDULE]: getSavedSearchInternalIdsMap(TAX_SCHEDULE),
  [PROJECT_EXPENSE_TYPE]: getSavedSearchInternalIdsMap(PROJECT_EXPENSE_TYPE),
  [ALLOCATION_TYPE]: getSavedSearchInternalIdsMapFromColumn('resourceAllocation', ALLOCATION_TYPE),
  [SUPPORT_CASE_PROFILE]: getSavedSearchInternalIdsMapFromColumn('supportCase', 'profile'),
}

const getInternalIdsMap = async (
  client: NetsuiteClient,
  queryBy: QueryBy,
  tableName: string,
  items: string[],
): Promise<InternalIdsMap> => {
  const additionalQuery = ADDITIONAL_QUERIES[tableName as AdditionalQueryName]
  if (additionalQuery !== undefined) {
    return additionalQuery(client, queryBy, items)
  }
  const queryParams = QUERIES_BY_TABLE_NAME[tableName as SuiteQLTableName]
  if (queryParams === undefined) {
    return {}
  }
  const { internalIdField, nameField } = queryParams
  const results = await Promise.all(
    _.chunk(items, ITEMS_PER_QUERY_LIMIT).map(itemsChunk =>
      client.runSuiteQL({
        select: `${internalIdField}, ${nameField}`,
        from: tableName,
        where: `${queryBy === 'internalId' ? internalIdField : nameField} in (${itemsChunk.map(id => `'${id}'`).join(', ')})`,
        orderBy: internalIdField,
      }),
    ),
  ).then(result => result.flatMap(res => res ?? []))
  if (results.length === 0) {
    log.warn('received no results from query table %s', tableName)
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

export const updateSuiteQLTableInstances = async ({
  client,
  queryBy,
  itemsToQuery,
  suiteQLTablesMap,
}: {
  client: NetsuiteClient
  queryBy: QueryBy
  itemsToQuery: { tableName: string; item: string }[]
  suiteQLTablesMap: Record<string, InstanceElement>
}): Promise<void> => {
  const itemsToQueryByTableName = _.mapValues(
    _.groupBy(itemsToQuery, row => row.tableName),
    rows => _.uniq(rows.map(row => row.item)),
  )

  await log.timeDebug(
    () =>
      Promise.all(
        Object.entries(itemsToQueryByTableName).map(async ([tableName, items]) =>
          Object.assign(
            getSuiteQLTableInternalIdsMap(suiteQLTablesMap[tableName]),
            await getInternalIdsMap(client, queryBy, tableName, items),
          ),
        ),
      ),
    'updating %d suiteql_table elements',
    Object.keys(itemsToQueryByTableName).length,
  )
}

const getSuiteQLTableInstance = async (
  suiteQLTableType: ObjectType,
  tableName: string,
  elementsSource: ReadOnlyElementsSource,
  isPartial: boolean,
): Promise<InstanceElement> => {
  if (isPartial) {
    const instanceElemId = suiteQLTableType.elemID.createNestedID('instance', tableName)
    const existingInstance = await elementsSource.get(instanceElemId)
    if (isInstanceElement(existingInstance)) {
      existingInstance.refType = createRefToElmWithValue(suiteQLTableType)
      return existingInstance
    }
  }
  const newInstance = new InstanceElement(tableName, suiteQLTableType)
  newInstance.annotate({ [CORE_ANNOTATIONS.HIDDEN]: true })
  return newInstance
}

export const getSuiteQLTableElements = async (
  config: NetsuiteConfig,
  elementsSource: ReadOnlyElementsSource,
  isPartial: boolean,
): Promise<{ elements: TopLevelElement[] }> => {
  if (config.fetch.resolveAccountSpecificValues !== true) {
    return { elements: [] }
  }
  const suiteQLTableType = new ObjectType({
    elemID: new ElemID(NETSUITE, SUITEQL_TABLE),
    annotations: { [CORE_ANNOTATIONS.HIDDEN]: true },
  })

  const instances = await Promise.all(
    Object.entries(QUERIES_BY_TABLE_NAME)
      .filter(([_tableName, queryParams]) => queryParams !== undefined)
      .map(([tableName, _queryParams]) => tableName)
      .concat(Object.keys(ADDITIONAL_QUERIES))
      .map(tableName => getSuiteQLTableInstance(suiteQLTableType, tableName, elementsSource, isPartial)),
  )

  return {
    elements: [suiteQLTableType, ...instances],
  }
}
