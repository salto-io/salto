/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import Ajv from 'ajv'
import { logger } from '@salto-io/logging'
import { strings, collections } from '@salto-io/lowerdash'
import {
  Element,
  ElemID,
  InstanceElement,
  Value,
  Values,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
  isReferenceExpression,
  ReferenceExpression,
  ChangeError,
} from '@salto-io/adapter-api'
import { WALK_NEXT_STEP, resolvePath, setPath, walkOnElement, walkOnValue } from '@salto-io/adapter-utils'
import NetsuiteClient from '../client/client'
import { RemoteFilterCreator } from '../filter'
import {
  ACCOUNT_SPECIFIC_VALUE,
  INIT_CONDITION,
  NAME_FIELD,
  SCRIPT_ID,
  SELECT_RECORD_TYPE,
  VALUE_FIELD,
  WORKFLOW,
} from '../constants'
import {
  QUERY_RECORD_TYPES,
  QueryRecordType,
  QueryRecordResponse,
  QueryRecordSchema,
} from '../client/suiteapp_client/types'
import {
  AdditionalQueryName,
  MissingInternalId,
  SUITEQL_TABLE,
  getSuiteQLTableInternalIdsMap,
  updateSuiteQLTableInstances,
} from '../data_elements/suiteql_table_elements'
import { SuiteQLTableName } from '../data_elements/types'
import { captureServiceIdInfo } from '../service_id_info'
import { LazyElementsSourceIndexes } from '../elements_source_index/types'
import { assignToCustomFieldsSelectRecordTypeIndex } from '../elements_source_index/elements_source_index'

const log = logger(module)
const { isNumberStr, matchAll } = strings
const { makeArray } = collections.array

const RECORDS_PER_QUERY = 10

const FORMULA = 'formula'
const FORMULA_PARAMS = 'formulaParams'

const MULTISELECT_FIELD = 'valuemultiselect'

const RESOLVED_ACCOUNT_SPECIFIC_VALUE_PREFIX = `${ACCOUNT_SPECIFIC_VALUE} (`
const RESOLVED_ACCOUNT_SPECIFIC_VALUE_SUFFIX = ')'

type QueryRecordField = {
  name: string
  type: string | string[]
}

type QueryRecord = {
  type: QueryRecordType
  serviceId: string
  fields: QueryRecordField[]
  elemID: ElemID
  path: string[]
}

type InstanceWithQueryRecords = {
  instance: InstanceElement
  records: QueryRecord[]
}

type WorkflowInternalID = {
  internalid: [
    {
      value: string
    },
  ]
}

type GetFieldTypeIDFunc = (params: {
  fieldValue: unknown
  instance: InstanceElement
  isFieldWithAccountSpecificValue: boolean
  selectRecordTypeMap: Record<string, unknown>
}) => string | string[] | undefined

type AccountSpecificValueToTransform = {
  field: QueryRecordField
  value: Values
  internalId: string
}

type ResolvedAccountSpecificValue = {
  path: ElemID
  value: string
}

type ResolvedAccountSpecificValuesResult = {
  resolvedAccountSpecificValues: ResolvedAccountSpecificValue[]
  resolveWarnings: ChangeError[]
  missingInternalIds: MissingInternalId[]
}

// the following formula params are represented with internal id in the formula queried by suiteapp
const FORMULA_PARAMS_WITH_INTERNAL_ID = [
  {
    [SELECT_RECORD_TYPE]: '-118',
    [VALUE_FIELD]: 'ADMINISTRATOR',
  },
]

const isFormulaValueWithInternalId = (param: Value): boolean => {
  if (!_.isPlainObject(param)) {
    return false
  }
  // not only params with ACCOUNT_SPECIFIC_VALUE are represented with internalid in the formula (e.g roles),
  // but only params that have selectrecordtype are represented with internalid in the formula.
  if (param[SELECT_RECORD_TYPE] === undefined) {
    return false
  }
  if (
    typeof param[VALUE_FIELD] === 'string' &&
    // params that have a constant string `value` (e.g "INVOICE") aren't represented with internalid in the formula.
    /^[A-Z]+$/.test(param[VALUE_FIELD]) &&
    // some constant string `value` are represented with internalid (e.g 'ADMINISTRATOR' role)
    !FORMULA_PARAMS_WITH_INTERNAL_ID.some(item => _.isEqual(item, _.pick(param, Object.keys(item))))
  ) {
    return false
  }
  return true
}

const STANDARD_FIELDS_TO_RECORD_TYPE: Record<string, SuiteQLTableName | AdditionalQueryName> = {
  // STDBODY fields
  STDBODYACCOUNT: 'account',
  STDBODYCLASS: 'classification',
  STDBODYDEPARTMENT: 'department',
  STDBODYTOSUBSIDIARY: 'subsidiary',
  STDBODYLOCATION: 'location',
  STDBODYDECISIONMAKER: 'contact',
  STDBODYEMPLOYEE: 'employee',
  STDBODYNEXTAPPROVER: 'employee',
  STDBODYINCOTERM: 'incoterm',
  STDBODYENTITYEMPLOYEE: 'employee',
  STDBODYENTITYSTATUS: 'entityStatus',
  STDBODYPAYMENTMETHOD: 'paymentMethod',

  // STDEVENT fields
  STDEVENTALLOCATIONTYPE: 'allocationType',
  STDEVENTCASESTATUS: 'supportCaseStatus',
  STDEVENTCASEPRIORITY: 'supportCasePriority',

  // STDENTITY fields
  STDENTITYPROJECTEXPENSETYPE: 'projectExpenseType',
  STDENTITYSTATUS: 'entityStatus',
  STDENTITYPURCHASEORDERAPPROVER: 'employee',
  STDENTITYTIMEAPPROVER: 'employee',
  STDENTITYDEPARTMENT: 'department',
  STDENTITYTERMS: 'term',
  STDENTITYSUBSIDIARY: 'subsidiary',
  STDENTITYRECEIVABLESACCOUNT: 'account',
  STDENTITYPAYABLESACCOUNT: 'account',

  // STDTIME fields
  STDTIMEDEPARTMENT: 'department',
  STDTIMECLASS: 'classification',
  STDTIMELOCATION: 'location',
  STDTIMEEMPLOYEE: 'employee',
  STDTIMEAPPROVALSTATUS: 'approvalStatus',
  STDTIMEITEM: 'item',
  STDTIMEVENDOR: 'vendor',
  STDTIMENEXTAPPROVER: 'employee',

  // STDITEM fields
  STDITEMTAXSCHEDULE: 'taxSchedule',
  STDITEMSUBSIDIARY: 'subsidiary',
  STDITEMCLASS: 'classification',
  STDITEMDEPARTMENT: 'department',
  STDITEMREVENUERECOGNITIONRULE: 'revenueRecognitionRule',
  STDITEMLOCATION: 'location',
}

const getSelectRecordTypeFromReference = (
  ref: ReferenceExpression,
  selectRecordTypeMap: Record<string, unknown>,
): unknown => {
  const baseId = ref.elemID.createBaseID().parent
  if (baseId.idType === 'type') {
    return `[${SCRIPT_ID}=${baseId.name}]`
  }
  if (selectRecordTypeMap[baseId.getFullName()] !== undefined) {
    return selectRecordTypeMap[baseId.getFullName()]
  }
  // on deploy the reference's top level parent is resolved
  if (ref.topLevelParent !== undefined) {
    return resolvePath(ref.topLevelParent, baseId.createNestedID(SELECT_RECORD_TYPE))
  }
  return undefined
}

const getSelectRecordType: GetFieldTypeIDFunc = params => {
  const { fieldValue, selectRecordTypeMap } = params
  if (typeof fieldValue === 'string') {
    if (isNumberStr(fieldValue)) {
      return fieldValue
    }
    const serviceIdInfos = captureServiceIdInfo(fieldValue)
    if (serviceIdInfos.length === 1 && serviceIdInfos[0].isFullMatch) {
      return serviceIdInfos[0].serviceId
    }
  }
  if (isReferenceExpression(fieldValue)) {
    return getSelectRecordType({
      ...params,
      fieldValue: getSelectRecordTypeFromReference(fieldValue, selectRecordTypeMap),
    })
  }
  log.warn('could not get field type from selectrecordtype: %o', fieldValue)
  return undefined
}

const GET_FIELD_TYPE_FUNCTIONS: Record<string, GetFieldTypeIDFunc> = {
  sender: ({ isFieldWithAccountSpecificValue }): SuiteQLTableName | undefined =>
    isFieldWithAccountSpecificValue ? 'employee' : undefined,
  recipient: ({ isFieldWithAccountSpecificValue }): SuiteQLTableName[] | undefined =>
    // there is no intersection between the internal ids of those types,
    // and no indication in the element which type should be used.
    isFieldWithAccountSpecificValue ? ['employee', 'contact', 'customer', 'partner', 'vendor'] : undefined,
  campaignevent: ({ isFieldWithAccountSpecificValue }): SuiteQLTableName | undefined =>
    isFieldWithAccountSpecificValue ? 'campaignEvent' : undefined,
  selectrecordtype: getSelectRecordType,
  resultfield: params => {
    const { fieldValue, instance } = params
    if (isReferenceExpression(fieldValue)) {
      const refField = resolvePath(instance, fieldValue.elemID.createParentID())
      if (_.isPlainObject(refField) && refField[SELECT_RECORD_TYPE] !== undefined) {
        return getSelectRecordType({ ...params, fieldValue: refField[SELECT_RECORD_TYPE] })
      }
    }
    log.warn('could not get field type from resultfield: %o', fieldValue)
    return undefined
  },
  field: params => {
    const { fieldValue, selectRecordTypeMap } = params
    if (typeof fieldValue === 'string') {
      const recordType = STANDARD_FIELDS_TO_RECORD_TYPE[fieldValue]
      if (recordType !== undefined) {
        return recordType
      }
    }
    if (isReferenceExpression(fieldValue)) {
      return getSelectRecordType({
        ...params,
        fieldValue: getSelectRecordTypeFromReference(fieldValue, selectRecordTypeMap),
      })
    }
    log.warn('could not get field type from field: %o', fieldValue)
    return undefined
  },
}

const WORKFLOW_INTERNAL_IDS_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    required: ['internalid'],
    properties: {
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

const getFieldsToQuery = (records: QueryRecord[]): string[] =>
  _.uniq([SCRIPT_ID, ...records.flatMap(row => row.fields).map(field => field.name)])

const getQueryFilter = (records: QueryRecord[]): QueryRecordSchema['filter'] => ({
  fieldId: SCRIPT_ID,
  in: _.uniq(records.map(row => row.serviceId)),
})

const createQuerySchema = (records: QueryRecord[]): QueryRecordSchema => {
  const {
    [QUERY_RECORD_TYPES.workflow]: workflows = [],
    [QUERY_RECORD_TYPES.workflowstate]: workflowstates = [],
    [QUERY_RECORD_TYPES.workflowtransition]: workflowtransitions = [],
    [QUERY_RECORD_TYPES.actiontype]: workflowactions = [],
    [QUERY_RECORD_TYPES.workflowstatecustomfield]: workflowstatecustomfields = [],
    [QUERY_RECORD_TYPES.workflowcustomfield]: workflowcustomfields = [],
  } = _.groupBy(records, record => record.type)

  const workflowTransitionSchema: QueryRecordSchema | undefined =
    workflowtransitions.length > 0
      ? {
          type: 'workflowtransition',
          sublistId: 'transitions',
          idAlias: 'transitionid',
          fields: getFieldsToQuery(workflowtransitions),
          filter: getQueryFilter(workflowtransitions),
        }
      : undefined

  const workflowActionSchema: QueryRecordSchema | undefined =
    workflowactions.length > 0
      ? {
          type: 'actiontype',
          sublistId: 'actions',
          idAlias: 'actionid',
          typeSuffix: 'action',
          fields: getFieldsToQuery(workflowactions),
          filter: getQueryFilter(workflowactions),
          customTypes: {
            customactionaction: 'customaction',
          },
        }
      : undefined

  const workflowStateCustomFieldSchema: QueryRecordSchema | undefined =
    workflowstatecustomfields.length > 0
      ? {
          type: 'workflowstatecustomfield',
          sublistId: 'fields',
          idAlias: 'id',
          fields: getFieldsToQuery(workflowstatecustomfields),
          filter: getQueryFilter(workflowstatecustomfields),
        }
      : undefined

  const workflowStateSchema: QueryRecordSchema | undefined =
    workflowstates.length > 0
      ? {
          type: 'workflowstate',
          sublistId: 'states',
          idAlias: 'stateid',
          fields: getFieldsToQuery(workflowstates),
          filter: getQueryFilter(workflowstates),
          sublists: [workflowTransitionSchema, workflowActionSchema, workflowStateCustomFieldSchema].flatMap(
            schema => schema ?? [],
          ),
        }
      : undefined

  const workflowCustomFieldSchema: QueryRecordSchema | undefined =
    workflowcustomfields.length > 0
      ? {
          type: 'workflowcustomfield',
          sublistId: 'fields',
          idAlias: 'id',
          fields: getFieldsToQuery(workflowcustomfields),
          filter: getQueryFilter(workflowcustomfields),
        }
      : undefined

  return {
    type: 'workflow',
    fields: getFieldsToQuery(workflows),
    filter: getQueryFilter(workflows),
    sublists: [workflowStateSchema, workflowCustomFieldSchema].flatMap(schema => schema ?? []),
  }
}

const getQueryRecordType = (path: ElemID): QueryRecordType | undefined => {
  if (path.isTopLevel()) {
    return 'workflow'
  }
  if (path.createParentID(3).name === 'workflowactions') {
    return 'actiontype'
  }
  return QUERY_RECORD_TYPES[path.createParentID().name as QueryRecordType]
}

const getQueryRecordFieldType = (
  instance: InstanceElement,
  value: Values,
  field: string,
  suiteQLTablesMap: Record<string, unknown>,
  selectRecordTypeMap: Record<string, unknown>,
  internalIdToTypes: Record<string, string[]>,
): string | string[] | undefined => {
  // a field type by the field itself should be the first option ([field, value[field]])
  const fieldType = [[field, value[field]]]
    .concat(Object.entries(value))
    .filter(([key]) => GET_FIELD_TYPE_FUNCTIONS[key] !== undefined)
    .map(([key, fieldValue]) =>
      GET_FIELD_TYPE_FUNCTIONS[key]({
        fieldValue,
        instance,
        selectRecordTypeMap,
        isFieldWithAccountSpecificValue: field === key,
      }),
    )
    .find(res => res !== undefined)

  if (fieldType === undefined) {
    log.warn('could not find field type id of %s from value: %o', field, value)
    return undefined
  }

  if (Array.isArray(fieldType)) {
    const [suiteQLTableNames, nonExistingNames] = _.partition(
      fieldType,
      typeName => suiteQLTablesMap[typeName] !== undefined,
    )
    if (nonExistingNames.length > 0) {
      log.warn('could not find SuiteQL table instances %s', nonExistingNames)
    }
    return suiteQLTableNames.length > 0 ? suiteQLTableNames : undefined
  }

  const suiteQLTableName =
    suiteQLTablesMap[fieldType] !== undefined
      ? fieldType
      : internalIdToTypes[fieldType]?.find(typeName => suiteQLTablesMap[typeName] !== undefined)

  if (suiteQLTableName === undefined) {
    log.warn('could not find SuiteQL table instance %s', fieldType)
    return undefined
  }
  return suiteQLTableName
}

const getConditionParameters = (value: Value): Values[] => Object.values(value?.parameters?.parameter ?? {})

const getFieldsWithAccountSpecificValue = (
  instance: InstanceElement,
  value: Values,
  path: ElemID,
  suiteQLTablesMap: Record<string, InstanceElement>,
  selectRecordTypeMap: Record<string, unknown>,
  internalIdToTypes: Record<string, string[]>,
): QueryRecordField[] =>
  Object.entries(value).flatMap(([field, fieldValue]) => {
    if (fieldValue === ACCOUNT_SPECIFIC_VALUE) {
      const fieldType = getQueryRecordFieldType(
        instance,
        value,
        field,
        suiteQLTablesMap,
        selectRecordTypeMap,
        internalIdToTypes,
      )
      if (fieldType !== undefined) {
        return { name: field, type: fieldType }
      }
    }
    if (field === INIT_CONDITION) {
      const parameters = getConditionParameters(fieldValue)
      if (
        parameters.some(
          param =>
            param?.[VALUE_FIELD] === ACCOUNT_SPECIFIC_VALUE &&
            getQueryRecordFieldType(
              instance,
              param,
              'value',
              suiteQLTablesMap,
              selectRecordTypeMap,
              internalIdToTypes,
            ) !== undefined,
        )
      ) {
        if (typeof fieldValue[FORMULA] !== 'string') {
          log.warn('formula of initcondition in %s is not string: %o', path.getFullName(), fieldValue[FORMULA])
          return []
        }
        return {
          type: FORMULA_PARAMS,
          name: path.isTopLevel() ? 'initconditionformula' : 'conditionformula',
        }
      }
    }
    return []
  })

const getQueryRecords = (
  instance: InstanceElement,
  suiteQLTablesMap: Record<string, InstanceElement>,
  selectRecordTypeMap: Record<string, unknown>,
  internalIdToTypes: Record<string, string[]>,
): InstanceWithQueryRecords => {
  const allQueryRecords: Record<string, Omit<QueryRecord, 'path'>> = {}

  walkOnValue({
    elemId: instance.elemID,
    value: instance.value,
    func: ({ path: elemID, value }) => {
      if (!_.isPlainObject(value) || value[SCRIPT_ID] === undefined) {
        return WALK_NEXT_STEP.RECURSE
      }
      const type = getQueryRecordType(elemID)
      if (type !== undefined) {
        const fields = getFieldsWithAccountSpecificValue(
          instance,
          value,
          elemID,
          suiteQLTablesMap,
          selectRecordTypeMap,
          internalIdToTypes,
        )
        allQueryRecords[elemID.getFullName()] = {
          type,
          serviceId: value[SCRIPT_ID],
          fields,
          elemID,
        }
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })

  const getPath = (elemId: ElemID): string[] => {
    const fullName = elemId.getFullName()
    if (elemId.isTopLevel()) {
      return [allQueryRecords[fullName].serviceId]
    }
    const serviceId = allQueryRecords[fullName]?.serviceId ?? []
    return getPath(elemId.createParentID()).concat(serviceId)
  }

  const queryRecordsToReturn = _.uniq(
    Object.values(allQueryRecords)
      .filter(record => record.fields.length > 0)
      .flatMap(record => record.elemID.createAllElemIdParents())
      .map(elemId => elemId.getFullName())
      .filter(fullName => allQueryRecords[fullName] !== undefined),
  )

  const records = queryRecordsToReturn.map(fullName => ({
    ...allQueryRecords[fullName],
    path: getPath(allQueryRecords[fullName].elemID),
  }))

  return { instance, records }
}

const getWorkflowIdsToQuery = async (
  client: NetsuiteClient,
  instances: InstanceElement[],
  queryRecords: QueryRecord[],
): Promise<string[]> => {
  const workflowScriptIds = new Set(
    queryRecords.filter(record => record.type === 'workflow').map(record => record.serviceId),
  )
  const workflowNames = _.uniq(
    instances
      .filter(instance => workflowScriptIds.has(instance.value[SCRIPT_ID]))
      .map(instance => instance.value[NAME_FIELD]),
  )
  const result = await client.runSavedSearchQuery({
    type: 'workflow',
    columns: ['internalid'],
    filters: workflowNames
      .map(name => ['name', 'is', name])
      .reduce((filter, curr, i) => (i < workflowNames.length - 1 ? [...filter, curr, 'OR'] : [...filter, curr]), []),
  })
  const ajv = new Ajv({ allErrors: true, strict: false })
  if (!ajv.validate<WorkflowInternalID[]>(WORKFLOW_INTERNAL_IDS_SCHEMA, result)) {
    log.error('Got invalid results from workflow internal ids search: %s', ajv.errorsText())
    return []
  }
  return _.uniq(result.map(row => row.internalid[0].value))
}

const runRecordsQuery = async (
  client: NetsuiteClient,
  instances: InstanceElement[],
  queryRecords: QueryRecord[],
): Promise<QueryRecordResponse[] | undefined> => {
  const schema = createQuerySchema(queryRecords)
  const ids = await getWorkflowIdsToQuery(client, instances, queryRecords)
  if (ids.length === 0) {
    log.warn('received an empty list workflow internal ids - skipping records query')
    return []
  }
  return client.runRecordsQuery(ids, schema)
}

const getInnerResult = (results: QueryRecordResponse[], path: string[]): QueryRecordResponse | undefined => {
  const [nextScriptId, ...restOfPath] = path
  const result = results.find(res => res.body[SCRIPT_ID] === nextScriptId)
  if (result === undefined || restOfPath.length === 0) {
    return result
  }
  return getInnerResult(result.sublists, restOfPath)
}

const toResolvedAccountSpecificValue = (name: string): string =>
  `${RESOLVED_ACCOUNT_SPECIFIC_VALUE_PREFIX}${name}${RESOLVED_ACCOUNT_SPECIFIC_VALUE_SUFFIX}`

const isResolvedAccountSpecificValue = (name: string): boolean =>
  name.startsWith(RESOLVED_ACCOUNT_SPECIFIC_VALUE_PREFIX) && name.endsWith(RESOLVED_ACCOUNT_SPECIFIC_VALUE_SUFFIX)

const getResolvedAccountSpecificValue = (name: string): string =>
  name.slice(RESOLVED_ACCOUNT_SPECIFIC_VALUE_PREFIX.length, name.length - RESOLVED_ACCOUNT_SPECIFIC_VALUE_SUFFIX.length)

const getNameByInternalId = (
  field: QueryRecordField,
  internalId: string,
  suiteQLTablesMap: Record<string, InstanceElement>,
): string | undefined =>
  makeArray(field.type)
    .map(typeName => getSuiteQLTableInternalIdsMap(suiteQLTablesMap[typeName])[internalId])
    .find(res => res !== undefined)?.name

const getParamLocations = ({
  conditionFormula,
  param,
  startAtIndex = 0,
  isFirstAppearance = true,
}: {
  conditionFormula: string
  param: Values
  startAtIndex?: number
  isFirstAppearance?: boolean
}): { param: Values; location: number; isFirstAppearance: boolean }[] => {
  const location = conditionFormula.indexOf(`"${param.name}"`, startAtIndex)
  if (location === -1) {
    return []
  }
  return [{ param, location, isFirstAppearance }].concat(
    getParamLocations({ conditionFormula, param, startAtIndex: location + 1, isFirstAppearance: false }),
  )
}

const getParametersAccountSpecificValueToTransform = (
  instance: InstanceElement,
  value: Values,
  formulaWithInternalIds: string,
  suiteQLTablesMap: Record<string, InstanceElement>,
  selectRecordTypeMap: Record<string, unknown>,
  internalIdToTypes: Record<string, string[]>,
): AccountSpecificValueToTransform[] => {
  const conditionFormula = value[INIT_CONDITION][FORMULA]
  const allParams = getConditionParameters(value[INIT_CONDITION])
  const params = allParams
    // not only params with ACCOUNT_SPECIFIC_VALUE are represented with internalid in the formula (e.g roles),
    // but only params that have selectrecordtype are represented with internalid in the formula.
    .filter(param => param?.[SELECT_RECORD_TYPE] !== undefined)
    .filter(isFormulaValueWithInternalId)
    // each param can appear more than once in the condition formula.
    // in that case we're expecting to see it multiple times in formulaWithInternalIds.
    .flatMap(param => getParamLocations({ conditionFormula, param }))
  const internalIds = Array.from(matchAll(formulaWithInternalIds, /['"]?[-\w]?\d+(\.\d+)?['"]?/g))
    .map(res => res[0])
    .filter(
      internalId =>
        // ignore string numbers (e.g '1', "2")
        isNumberStr(internalId) &&
        // ignore non integers (e.g 1.5, 2.0)
        !internalId.includes('.') &&
        // ignore zero and invalid numbers
        !internalId.startsWith('0') &&
        !internalId.startsWith('-0'),
    )

  if (params.length !== internalIds.length) {
    log.warn('params length %d do not match the internal ids extracted from the formula: %o', params.length, {
      formula: {
        fromSuiteApp: formulaWithInternalIds,
        fromSDF: conditionFormula,
      },
      params: allParams,
    })
    return []
  }
  const sortedParams = _.sortBy(params, param => param.location)
  return sortedParams.flatMap(({ param, isFirstAppearance }, index) => {
    if (param[VALUE_FIELD] !== ACCOUNT_SPECIFIC_VALUE || !isFirstAppearance) {
      return []
    }
    const internalId = internalIds[index]
    const paramType = getQueryRecordFieldType(
      instance,
      param,
      'value',
      suiteQLTablesMap,
      selectRecordTypeMap,
      internalIdToTypes,
    )
    if (paramType === undefined) {
      return []
    }
    return { field: { name: 'value', type: paramType }, value: param, internalId }
  })
}

const getAccountSpecificValueToTransform = (
  instance: InstanceElement,
  record: QueryRecord,
  results: QueryRecordResponse[],
  suiteQLTablesMap: Record<string, InstanceElement>,
  selectRecordTypeMap: Record<string, unknown>,
  internalIdToTypes: Record<string, string[]>,
): AccountSpecificValueToTransform[] => {
  const innerValue = record.elemID.isTopLevel() ? instance.value : resolvePath(instance, record.elemID)
  const innerResult = getInnerResult(results, record.path)
  if (innerResult === undefined) {
    log.warn('missing record %s in path %s: %o', record.serviceId, record.path.join('.'), results)
    return []
  }
  return record.fields.flatMap(field => {
    const internalId = innerResult.body[field.name]
    if (internalId === undefined || internalId === '') {
      log.warn('missing field %s in record %s: %o', field.name, record.serviceId, innerResult.body)
      return []
    }
    if (
      field.name === MULTISELECT_FIELD &&
      Array.isArray(internalId) &&
      internalId.length === 1 &&
      typeof internalId[0] === 'string'
    ) {
      return { field, value: innerValue, internalId: internalId[0] }
    }
    if (typeof internalId !== 'string') {
      log.warn('field %s in record %s is not a string: %o', field.name, record.serviceId, internalId)
      return []
    }
    if (field.type === FORMULA_PARAMS) {
      return getParametersAccountSpecificValueToTransform(
        instance,
        innerValue,
        internalId,
        suiteQLTablesMap,
        selectRecordTypeMap,
        internalIdToTypes,
      )
    }
    return { field, value: innerValue, internalId }
  })
}

const toMissingInternalIdWarning = (elemID: ElemID, name: string, field: string): ChangeError => ({
  elemID,
  severity: 'Warning',
  message: 'Could not identify value in workflow',
  detailedMessage: `Could not find object "${name}" for field "${field}". Setting it to ACCOUNT_SPECIFIC_VALUE instead. Learn more at https://help.salto.io/en/articles/8952685-identifying-account-specific-values-in-netsuite`,
})

const toMultipleInternalIdsWarning = (elemID: ElemID, name: string, internalId: string): ChangeError => ({
  elemID,
  severity: 'Warning',
  message: 'Multiple objects with the same name',
  detailedMessage: `There are multiple objects with the name "${name}". Using the first one (internal id: ${internalId}). Learn more at https://help.salto.io/en/articles/8952685-identifying-account-specific-values-in-netsuite`,
})

export const getResolvedAccountSpecificValues = (
  instance: InstanceElement,
  suiteQLNameToInternalIdsMap: Record<string, Record<string, string[]>>,
  internalIdToTypes: Record<string, string[]>,
): ResolvedAccountSpecificValuesResult => {
  const resolvedAccountSpecificValues: ResolvedAccountSpecificValue[] = []
  const resolveWarnings: ChangeError[] = []
  const missingInternalIds: MissingInternalId[] = []

  const resolveAccountSpecificValueForField = (
    path: ElemID,
    value: Values,
    field: string,
    fieldValue: unknown,
  ): void => {
    if (typeof fieldValue !== 'string' || !isResolvedAccountSpecificValue(fieldValue)) {
      return
    }
    const name = getResolvedAccountSpecificValue(fieldValue)
    const fieldType = getQueryRecordFieldType(
      instance,
      value,
      field,
      suiteQLNameToInternalIdsMap,
      {},
      internalIdToTypes,
    )
    const internalIds = _.uniq(makeArray(fieldType).flatMap(type => suiteQLNameToInternalIdsMap[type][name] ?? []))
    const internalId = internalIds[0]
    if (internalIds.length === 0) {
      log.warn(
        'could not find internal id of "%s" in field %s from value: %o',
        name,
        path.createNestedID(field).getFullName(),
        value,
      )
      resolveWarnings.push(toMissingInternalIdWarning(path, name, field))
      makeArray(fieldType).forEach(type => missingInternalIds.push({ tableName: type, name }))
      resolvedAccountSpecificValues.push({ path: path.createNestedID(field), value: ACCOUNT_SPECIFIC_VALUE })
    } else {
      if (internalIds.length > 1) {
        log.warn('there are several internal ids for name %s - using the first: %d', name, internalId)
        resolveWarnings.push(toMultipleInternalIdsWarning(path, name, internalId))
      }
      resolvedAccountSpecificValues.push({ path: path.createNestedID(field), value: internalId })
    }
  }

  walkOnElement({
    element: instance,
    func: ({ value, path }) => {
      if (!_.isPlainObject(value)) {
        return WALK_NEXT_STEP.RECURSE
      }
      Object.entries(value).forEach(([field, fieldValue]) => {
        resolveAccountSpecificValueForField(path, value, field, fieldValue)
      })
      return WALK_NEXT_STEP.RECURSE
    },
  })

  return { resolvedAccountSpecificValues, resolveWarnings, missingInternalIds }
}

const getSelectRecordTypeMap = async (
  elements: Element[],
  elementsSourceIndex: LazyElementsSourceIndexes,
  isPartial: boolean,
): Promise<Record<string, unknown>> => {
  const selectRecordTypeMap = {
    ...(isPartial ? (await elementsSourceIndex.getIndexes()).customFieldsSelectRecordTypeIndex : {}),
  }
  elements.forEach(element => {
    assignToCustomFieldsSelectRecordTypeIndex(element, selectRecordTypeMap)
  })
  return selectRecordTypeMap
}

const filterCreator: RemoteFilterCreator = ({
  client,
  elementsSourceIndex,
  isPartial,
  config,
  internalIdToTypes,
  suiteQLNameToInternalIdsMap = {},
}) => ({
  name: 'workflowAccountSpecificValues',
  remote: true,
  onFetch: async elements => {
    const instances = elements.filter(isInstanceElement)
    const suiteQLTablesMap = _.keyBy(
      instances.filter(instance => instance.elemID.typeName === SUITEQL_TABLE),
      instance => instance.elemID.name,
    )
    if (_.isEmpty(suiteQLTablesMap)) {
      log.debug('there are no suiteql tables instances - skipping setting workflow account specific values')
      return
    }
    const selectRecordTypeMap = await getSelectRecordTypeMap(elements, elementsSourceIndex, isPartial)
    const workflowInstances = instances.filter(instance => instance.elemID.typeName === WORKFLOW)
    const queryRecords = workflowInstances
      .map(instance => getQueryRecords(instance, suiteQLTablesMap, selectRecordTypeMap, internalIdToTypes))
      .filter(({ records }) => records.length > 0)

    if (queryRecords.length === 0) {
      return
    }

    const results = await Promise.all(
      _.chunk(queryRecords, RECORDS_PER_QUERY).map(chunk =>
        runRecordsQuery(
          client,
          workflowInstances,
          chunk.flatMap(item => item.records),
        ),
      ),
    ).then(result => result.flatMap(res => res ?? []))

    const accountSpecificValuesToTransform = queryRecords.flatMap(({ instance, records }) =>
      records.flatMap(record =>
        getAccountSpecificValueToTransform(
          instance,
          record,
          results,
          suiteQLTablesMap,
          selectRecordTypeMap,
          internalIdToTypes,
        ),
      ),
    )

    const internalIdsToQuery = accountSpecificValuesToTransform.flatMap(({ field, internalId }) =>
      getNameByInternalId(field, internalId, suiteQLTablesMap) === undefined
        ? makeArray(field.type).map(tableName => ({ tableName, item: internalId }))
        : [],
    )

    await updateSuiteQLTableInstances({
      client,
      config,
      queryBy: 'internalId',
      itemsToQuery: internalIdsToQuery,
      suiteQLTablesMap,
    })

    accountSpecificValuesToTransform.forEach(({ field, value, internalId }) => {
      const name = getNameByInternalId(field, internalId, suiteQLTablesMap)
      if (name === undefined) {
        log.warn('could not find internal id %s of type %s', internalId, field.type)
        return
      }
      value[field.name] = toResolvedAccountSpecificValue(name)
    })
  },
  preDeploy: async changes => {
    const workflowInstances = changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === WORKFLOW)
    if (workflowInstances.length === 0) {
      return
    }
    workflowInstances.forEach(instance =>
      getResolvedAccountSpecificValues(
        instance,
        suiteQLNameToInternalIdsMap,
        internalIdToTypes,
      ).resolvedAccountSpecificValues.forEach(({ path, value }) => setPath(instance, path, value)),
    )
  },
})

export default filterCreator
