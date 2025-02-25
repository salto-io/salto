/*
 * Copyright 2025 Salto Labs Ltd.
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
import { NetsuiteConfig, SuiteQLTableQueryParams } from '../config/types'
import {
  ALLOCATION_TYPE,
  FIELD_TYPE,
  FILE_TYPE,
  NETSUITE,
  PROJECT_EXPENSE_TYPE,
  SAVED_SEARCH,
  SUPPORT_CASE_PROFILE,
  TAX_SCHEDULE,
  WORKFLOW,
  WORKFLOW_RELEASE_STATUS,
  WORKFLOW_TRIGGER_TYPE,
} from '../constants'
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
  | typeof WORKFLOW
  | typeof SAVED_SEARCH
  | typeof ALLOCATION_TYPE
  | typeof SUPPORT_CASE_PROFILE
  | typeof FIELD_TYPE
  | typeof FILE_TYPE
  | typeof WORKFLOW_RELEASE_STATUS
  | typeof WORKFLOW_TRIGGER_TYPE

type InternalIdsMap = Record<string, { name: string }>

type QueryBy = 'internalId' | 'name'

type SavedSearchInternalIdsResult = {
  internalid: [
    {
      value: string
    },
  ]
} & Record<string, string>

type ColumnSearchResult = Record<
  string,
  [
    {
      value: string
      text: string
    },
  ]
>

const getSavedSearchInternalIdsResultSchema = (nameField: string): Schema => ({
  type: 'array',
  items: {
    type: 'object',
    required: [nameField, 'internalid'],
    properties: {
      [nameField]: {
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
})

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

const QUERIES_BY_TABLE_NAME: Record<
  Exclude<SuiteQLTableName, AdditionalQueryName>,
  SuiteQLTableQueryParams | undefined
> = {
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
  customfield: {
    internalIdField: 'id',
    nameField: 'name',
  },
  script: {
    internalIdField: 'id',
    nameField: 'name',
  },
  role: {
    internalIdField: 'id',
    nameField: 'name',
  },
  customrecordtype: {
    internalIdField: 'id',
    nameField: 'name',
  },
  emailtemplate: {
    internalIdField: 'id',
    nameField: 'name',
  },
  customtransactiontype: {
    internalIdField: 'id',
    nameField: 'name',
  },
  scriptdeployment: {
    internalIdField: 'primarykey',
    nameField: 'title',
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
}

export const getSuiteQLTableInternalIdsMap = (instance: InstanceElement): InternalIdsMap => {
  // value[INTERNAL_IDS_MAP] can be undefined because transformElement transform empty objects to undefined
  if (instance.value[INTERNAL_IDS_MAP] === undefined) {
    instance.value[INTERNAL_IDS_MAP] = {}
  }
  return instance.value[INTERNAL_IDS_MAP]
}

const getSavedSearchInternalIdsMap =
  (searchType: string, { nameField, searchField }: { nameField: string; searchField?: string }) =>
  async (client: NetsuiteClient, queryBy: QueryBy, items: string[]): Promise<InternalIdsMap> => {
    const result = await Promise.all(
      _.chunk(items, ITEMS_PER_QUERY_LIMIT).map(itemsChunk =>
        client.runSavedSearchQuery({
          type: searchType,
          columns: ['internalid', nameField],
          filters:
            queryBy === 'internalId'
              ? [['internalid', 'anyof', ...itemsChunk]]
              : itemsChunk
                  .map(name => [searchField ?? nameField, 'is', name])
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
    if (!ajv.validate<SavedSearchInternalIdsResult[]>(getSavedSearchInternalIdsResultSchema(nameField), result)) {
      log.error('Got invalid results from %s saved search query: %s', searchType, ajv.errorsText())
      return {}
    }
    return Object.fromEntries(result.map(res => [res.internalid[0].value, { name: res[nameField] }]))
  }

const getSavedSearchInternalIdsMapFromColumn =
  (searchType: string, searchColumn: string) =>
  async (client: NetsuiteClient, queryBy: QueryBy, items: string[]): Promise<InternalIdsMap> => {
    const ajv = new Ajv({ allErrors: true, strict: false })
    const getColumnValues = async (exclude: string[] = []): Promise<Record<string, { name: string }>> => {
      const include = _.difference(items, exclude)
      const anyOfFilter = include.length > 0 ? [[searchColumn, 'anyof', ...include]] : undefined
      const noneOfFilter = exclude.length > 0 ? [[searchColumn, 'noneof', ...exclude]] : []
      // we can't filter by name, so we query all column values when queryBy='name'
      const queryFilters = queryBy === 'internalId' ? anyOfFilter : noneOfFilter
      if (queryFilters === undefined) {
        return {}
      }
      const result = await client.runSavedSearchQuery(
        {
          type: searchType,
          columns: [searchColumn],
          filters: queryFilters,
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

const getFieldTypeStaticInternalIdsMap = async (): Promise<InternalIdsMap> => ({
  '1': { name: 'Free-Form Text' },
  '2': { name: 'Email Address' },
  '3': { name: 'Phone Number' },
  '4': { name: 'Date' },
  '6': { name: 'Currency' },
  '8': { name: 'Decimal Number' },
  '10': { name: 'Integer Number' },
  '11': { name: 'Check Box' },
  '12': { name: 'List/Record' },
  '13': { name: 'Hyperlink' },
  '14': { name: 'Time Of Day' },
  '15': { name: 'Text Area' },
  '16': { name: 'Multiple Select' },
  '17': { name: 'Image' },
  '18': { name: 'Document' },
  '20': { name: 'Password' },
  '23': { name: 'Help' },
  '24': { name: 'Rich Text' },
  '28': { name: 'Percent' },
  '35': { name: 'Long Text' },
  '40': { name: 'Inline HTML' },
  '46': { name: 'Date/Time' },
})

const getFileTypeStaticInternalIdsMap = async (): Promise<InternalIdsMap> => ({
  '1': { name: 'Flash Animation' },
  '2': { name: 'JPEG Image' },
  '3': { name: 'PJPEG Image' },
  '4': { name: 'GIF Image' },
  '5': { name: 'PNG Image' },
  '6': { name: 'BMP Image' },
  '7': { name: 'TIFF Image' },
  '8': { name: 'Icon Image' },
  '9': { name: 'HTML File' },
  '10': { name: 'Plain Text File' },
  '11': { name: 'CSS File' },
  '12': { name: 'XML File' },
  '13': { name: 'JavaScript File' },
  '14': { name: 'CSV File' },
  '15': { name: 'SuiteScript Page' },
  '16': { name: 'SuiteScript File' },
  '17': { name: 'PDF File' },
  '18': { name: 'SMS File' },
  '19': { name: 'Word File' },
  '20': { name: 'RTF File' },
  '21': { name: 'PostScript File' },
  '22': { name: 'Excel File' },
  '23': { name: 'PowerPoint File' },
  '24': { name: 'Visio File' },
  '25': { name: 'Project File' },
  '26': { name: 'Zip File' },
  '27': { name: 'GNU Zip File' },
  '28': { name: 'QuickTime Video' },
  '29': { name: 'MPEG Video' },
  '30': { name: 'MP3 Audio' },
  '31': { name: 'Image' },
  '32': { name: 'Other Binary File' },
  '33': { name: 'Text File' },
})

const getWorkflowReleaseStatusStaticInternalIdsMap = async (): Promise<InternalIdsMap> => ({
  '1': { name: 'Not Initiating' },
  '2': { name: 'Testing' },
  '3': { name: 'Released' },
})

const getWorkflowTriggerTypeStaticInternalIdsMap = async (): Promise<InternalIdsMap> => ({
  '1': { name: 'Entry' },
  '2': { name: 'Exit' },
  '3': { name: 'Before Record Load' },
  '4': { name: 'Before Record Submit' },
  '5': { name: 'After Record Submit' },
  '6': { name: 'Scheduled' },
  '7': { name: 'Before User Edit' },
  '8': { name: 'Before Field Edit' },
  '9': { name: 'After Field Edit' },
  '10': { name: 'After Field Sourcing' },
  '11': { name: 'Before User Submit' },
})

export const ADDITIONAL_QUERIES: Record<AdditionalQueryName, ReturnType<typeof getSavedSearchInternalIdsMap>> = {
  [TAX_SCHEDULE]: getSavedSearchInternalIdsMap(TAX_SCHEDULE, { nameField: 'name' }),
  [PROJECT_EXPENSE_TYPE]: getSavedSearchInternalIdsMap(PROJECT_EXPENSE_TYPE, { nameField: 'name' }),
  [WORKFLOW]: getSavedSearchInternalIdsMap(WORKFLOW, { nameField: 'name' }),
  [SAVED_SEARCH]: getSavedSearchInternalIdsMap(SAVED_SEARCH, { nameField: 'title', searchField: 'titletext' }),
  [ALLOCATION_TYPE]: getSavedSearchInternalIdsMapFromColumn('resourceAllocation', ALLOCATION_TYPE),
  [SUPPORT_CASE_PROFILE]: getSavedSearchInternalIdsMapFromColumn('supportCase', 'profile'),
  [FIELD_TYPE]: getFieldTypeStaticInternalIdsMap,
  [FILE_TYPE]: getFileTypeStaticInternalIdsMap,
  [WORKFLOW_RELEASE_STATUS]: getWorkflowReleaseStatusStaticInternalIdsMap,
  [WORKFLOW_TRIGGER_TYPE]: getWorkflowTriggerTypeStaticInternalIdsMap,
}

export const getQueriesByTableName = (config: NetsuiteConfig): Record<string, SuiteQLTableQueryParams | undefined> => {
  const userQueries = Object.fromEntries(
    config.suiteAppClient?.additionalSuiteQLTables?.map(table => [table.name, table.queryParams] as const) ?? [],
  )
  return { ...QUERIES_BY_TABLE_NAME, ...userQueries }
}

const getInternalIdsMap = async (
  client: NetsuiteClient,
  config: NetsuiteConfig,
  queryBy: QueryBy,
  tableName: string,
  items: string[],
): Promise<InternalIdsMap> => {
  const additionalQuery = ADDITIONAL_QUERIES[tableName as AdditionalQueryName]
  if (additionalQuery !== undefined) {
    return additionalQuery(client, queryBy, items)
  }
  const queryParams = getQueriesByTableName(config)[tableName]
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
  config,
  queryBy,
  itemsToQuery,
  suiteQLTablesMap,
}: {
  client: NetsuiteClient
  config: NetsuiteConfig
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
            await getInternalIdsMap(client, config, queryBy, tableName, items),
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
  const suiteQLTableType = new ObjectType({
    elemID: new ElemID(NETSUITE, SUITEQL_TABLE),
    annotations: { [CORE_ANNOTATIONS.HIDDEN]: true },
  })

  const instances = await Promise.all(
    Object.entries(getQueriesByTableName(config))
      .filter(([_tableName, queryParams]) => queryParams !== undefined)
      .map(([tableName, _queryParams]) => tableName)
      .concat(Object.keys(ADDITIONAL_QUERIES))
      .map(tableName => getSuiteQLTableInstance(suiteQLTableType, tableName, elementsSource, isPartial)),
  )

  return {
    elements: [suiteQLTableType, ...instances],
  }
}
