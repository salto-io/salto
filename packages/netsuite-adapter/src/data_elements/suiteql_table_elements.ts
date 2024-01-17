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
import { logger } from '@salto-io/logging'
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, ReadOnlyElementsSource, TopLevelElement, createRefToElmWithValue } from '@salto-io/adapter-api'
import NetsuiteClient from '../client/client'
import { NETSUITE } from '../constants'
import { getLastServerTime } from '../server_time'
import { toSuiteQLWhereDateString } from '../changes_detector/date_formats'
import { SuiteQLTableName } from './types'

const log = logger(module)

export const SUITEQL_TABLE = 'suiteql_table'
export const INTERNAL_IDS_MAP = 'internalIdsMap'

const VERSION_FIELD = 'version'
const LATEST_VERSION = 1

type QueryParams = {
  internalIdField: 'id'
  nameField: string
  lastModifiedDateField?: 'lastmodifieddate'
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
  contactCategory: {
    internalIdField: 'id',
    nameField: 'name',
  },
  contactRole: {
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
  otherNameCategory: {
    internalIdField: 'id',
    nameField: 'name',
  },
  payrollItem: {
    internalIdField: 'id',
    nameField: 'name',
  },

  // could not find table
  address: undefined,
  billingAccount: undefined,
  bin: undefined,
  bom: undefined,
  bomRevision: undefined,
  campaign: undefined,
  campaignAudience: undefined,
  campaignCategory: undefined,
  campaignChannel: undefined,
  campaignFamily: undefined,
  campaignOffer: undefined,
  campaignResponse: undefined,
  campaignSearchEngine: undefined,
  campaignSubscription: undefined,
  campaignVertical: undefined,
  charge: undefined,
  costCategory: undefined,
  customerStatus: undefined,
  fairValuePrice: undefined,
  globalAccountMapping: undefined,
  hcmJob: undefined,
  inboundShipment: undefined,
  inventoryDetail: undefined,
  issue: undefined,
  itemAccountMapping: undefined,
  itemDemandPlan: undefined,
  itemRevision: undefined,
  itemSupplyPlan: undefined,
  manufacturingCostTemplate: undefined,
  manufacturingOperationTask: undefined,
  manufacturingRouting: undefined,
  noteType: undefined,
  opportunity: undefined,
  partnerCategory: undefined,
  projectTask: undefined,
  promotionCode: undefined,
  resourceAllocation: undefined,
  salesRole: undefined,
  solution: undefined,
  supportCase: undefined,
  supportCaseIssue: undefined,
  supportCaseOrigin: undefined,
  supportCasePriority: undefined,
  supportCaseStatus: undefined,
  supportCaseType: undefined,
  timeEntry: undefined,
  timeSheet: undefined,
  winLossReason: undefined,

  // has table, but no relevant info
  consolidatedExchangeRate: undefined,
  note: undefined,
  salesTaxItem: undefined,

  // referenced by scriptid
  customList: undefined,
  customRecordType: undefined,
  customfield: undefined,
  script: undefined,
  role: undefined,
  workflow: undefined,
  customrecordtype: undefined,
}

const getInternalIdsMap = async (
  client: NetsuiteClient,
  tableName: string,
  { internalIdField, nameField, lastModifiedDateField }: QueryParams,
  lastFetchTime: Date | undefined,
): Promise<Record<string, { name: string }>> => {
  const whereLastModified = lastModifiedDateField !== undefined && lastFetchTime !== undefined
    ? `WHERE ${lastModifiedDateField} >= ${toSuiteQLWhereDateString(lastFetchTime)}` : ''
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
  return Object.fromEntries(
    validResults.map(({ internalId, name }) => [internalId, { name }])
  )
}

const getSuiteQLTableInstance = async (
  client: NetsuiteClient,
  suiteQLTableType: ObjectType,
  tableName: string,
  queryParams: QueryParams,
  existingInstance: InstanceElement | undefined,
  lastFetchTime: Date | undefined,
  isPartial: boolean,
): Promise<InstanceElement | undefined> => {
  if (existingInstance !== undefined) {
    existingInstance.refType = createRefToElmWithValue(suiteQLTableType)
  }
  if (isPartial) {
    return existingInstance
  }
  const instance = existingInstance ?? new InstanceElement(tableName, suiteQLTableType)
  instance.annotate({ [CORE_ANNOTATIONS.HIDDEN]: true })
  if (instance.value[INTERNAL_IDS_MAP] === undefined) {
    instance.value[INTERNAL_IDS_MAP] = {}
  }
  Object.assign(
    instance.value[INTERNAL_IDS_MAP],
    await getInternalIdsMap(
      client,
      tableName,
      queryParams,
      instance.value[VERSION_FIELD] === LATEST_VERSION ? lastFetchTime : undefined
    )
  )
  instance.value[VERSION_FIELD] = LATEST_VERSION
  return instance
}

export const getSuiteQLTableElements = async (
  client: NetsuiteClient,
  elementsSource: ReadOnlyElementsSource,
  isPartial: boolean
): Promise<TopLevelElement[]> => {
  const suiteQLTableType = new ObjectType({
    elemID: new ElemID(NETSUITE, SUITEQL_TABLE),
    annotations: { [CORE_ANNOTATIONS.HIDDEN]: true },
  })

  const lastFetchTime = await getLastServerTime(elementsSource)
  const instances = await Promise.all(
    Object.entries(QUERIES_BY_TABLE_NAME).map(async ([tableName, queryParams]) => {
      if (queryParams === undefined) {
        return undefined
      }
      return getSuiteQLTableInstance(
        client,
        suiteQLTableType,
        tableName,
        queryParams,
        await elementsSource.get(suiteQLTableType.elemID.createNestedID('instance', tableName)),
        lastFetchTime,
        isPartial
      )
    })
  ).then(res => res.flatMap(instance => instance ?? []))

  return [suiteQLTableType, ...instances]
}
