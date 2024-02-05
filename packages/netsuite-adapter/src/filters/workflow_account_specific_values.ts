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
import { strings, collections } from '@salto-io/lowerdash'
import { Element, ElemID, InstanceElement, ReadOnlyElementsSource, Value, Values, getChangeData, isAdditionOrModificationChange, isInstanceChange, isInstanceElement, isReferenceExpression, ReferenceExpression, ChangeError } from '@salto-io/adapter-api'
import { WALK_NEXT_STEP, resolvePath, walkOnElement, walkOnValue } from '@salto-io/adapter-utils'
import NetsuiteClient from '../client/client'
import { RemoteFilterCreator } from '../filter'
import { ACCOUNT_SPECIFIC_VALUE, ALLOCATION_TYPE, EMPLOYEE, INIT_CONDITION, NAME_FIELD, PROJECT_EXPENSE_TYPE, SCRIPT_ID, SELECT_RECORD_TYPE, TAX_SCHEDULE, WORKFLOW } from '../constants'
import { QUERY_RECORD_TYPES, QueryRecordType, QueryRecordResponse, QueryRecordSchema } from '../client/suiteapp_client/types'
import { SUITEQL_TABLE, getSuiteQLNameToInternalIdsMap, getSuiteQLTableInternalIdsMap } from '../data_elements/suiteql_table_elements'
import { INTERNAL_ID_TO_TYPES } from '../data_elements/types'
import { captureServiceIdInfo } from '../service_id_info'
import { LazyElementsSourceIndexes } from '../elements_source_index/types'
import { assignToCustomFieldsSelectRecordTypeIndex } from '../elements_source_index/elements_source_index'

const log = logger(module)
const { isNumberStr, matchAll } = strings
const { makeArray } = collections.array

const RECORDS_PER_QUERY = 10

const FORMULA = 'formula'
const FORMULA_PARAMS = 'formulaParams'

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
  internalid: [{
    value: string
  }]
}

type GetFieldTypeIDFunc = (
  params: {
    fieldValue: unknown
    instance: InstanceElement
    isFieldWithAccountSpecificValue: boolean
    selectRecordTypeMap: Record<string, unknown>
  }
) => string | string[] | undefined

const STANDARD_FIELDS_TO_RECORD_TYPE: Record<string, string> = {
  STDITEMTAXSCHEDULE: TAX_SCHEDULE,
  STDBODYACCOUNT: 'account',
  STDEVENTALLOCATIONTYPE: ALLOCATION_TYPE,
  STDENTITYPROJECTEXPENSETYPE: PROJECT_EXPENSE_TYPE,
  STDENTITYSTATUS: 'entityStatus',
}

const getSelectRecordTypeFromReference = (
  ref: ReferenceExpression,
  selectRecordTypeMap: Record<string, unknown>
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
  sender: ({ isFieldWithAccountSpecificValue }) => (
    isFieldWithAccountSpecificValue ? EMPLOYEE : undefined
  ),
  recipient: ({ isFieldWithAccountSpecificValue }) => (
    // there is no intersection between the internal ids of those types,
    // and no indication in the element which type should be used.
    isFieldWithAccountSpecificValue ? [EMPLOYEE, 'contact', 'customer', 'partner', 'vendor'] : undefined
  ),
  campaignevent: ({ isFieldWithAccountSpecificValue }) => (
    isFieldWithAccountSpecificValue ? 'campaignEvent' : undefined
  ),
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

  const workflowTransitionSchema: QueryRecordSchema | undefined = workflowtransitions.length > 0
    ? {
      type: 'workflowtransition',
      sublistId: 'transitions',
      idAlias: 'transitionid',
      fields: getFieldsToQuery(workflowtransitions),
      filter: getQueryFilter(workflowtransitions),
    }
    : undefined

  const workflowActionSchema: QueryRecordSchema | undefined = workflowactions.length > 0
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

  const workflowStateCustomFieldSchema: QueryRecordSchema | undefined = workflowstatecustomfields.length > 0
    ? {
      type: 'workflowstatecustomfield',
      sublistId: 'fields',
      idAlias: 'id',
      fields: getFieldsToQuery(workflowstatecustomfields),
      filter: getQueryFilter(workflowstatecustomfields),
    }
    : undefined

  const workflowStateSchema: QueryRecordSchema | undefined = workflowstates.length > 0
    ? {
      type: 'workflowstate',
      sublistId: 'states',
      idAlias: 'stateid',
      fields: getFieldsToQuery(workflowstates),
      filter: getQueryFilter(workflowstates),
      sublists: [
        workflowTransitionSchema,
        workflowActionSchema,
        workflowStateCustomFieldSchema,
      ].flatMap(schema => schema ?? []),
    }
    : undefined

  const workflowCustomFieldSchema: QueryRecordSchema | undefined = workflowcustomfields.length > 0
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
    sublists: [
      workflowStateSchema,
      workflowCustomFieldSchema,
    ].flatMap(schema => schema ?? []),
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
  selectRecordTypeMap: Record<string, unknown>
): string | string[] | undefined => {
  // a field type by the field itself should be the first option ([field, value[field]])
  const fieldType = [[field, value[field]]].concat(Object.entries(value))
    .filter(([key]) => GET_FIELD_TYPE_FUNCTIONS[key] !== undefined)
    .map(([key, fieldValue]) => GET_FIELD_TYPE_FUNCTIONS[key]({
      fieldValue,
      instance,
      selectRecordTypeMap,
      isFieldWithAccountSpecificValue: field === key,
    }))
    .find(res => res !== undefined)

  if (fieldType === undefined) {
    log.warn('could not find field type id of %s from value: %o', field, value)
    return undefined
  }

  if (Array.isArray(fieldType)) {
    const [suiteQLTableNames, nonExistingNames] = _.partition(
      fieldType,
      typeName => suiteQLTablesMap[typeName] !== undefined
    )
    if (nonExistingNames.length > 0) {
      log.warn('could not find SuiteQL table instances %s', nonExistingNames)
    }
    return suiteQLTableNames.length > 0 ? suiteQLTableNames : undefined
  }

  const suiteQLTableName = suiteQLTablesMap[fieldType] !== undefined
    ? fieldType
    : (INTERNAL_ID_TO_TYPES[fieldType] ?? [])
      .find(typeName => suiteQLTablesMap[typeName] !== undefined)

  if (suiteQLTableName === undefined) {
    log.warn('could not find SuiteQL table instance %s', fieldType)
    return undefined
  }
  return suiteQLTableName
}

const getConditionParameters = (value: Value): Values[] =>
  Object.values(value?.parameters?.parameter ?? {})

const getFieldsWithAccountSpecificValue = (
  instance: InstanceElement,
  value: Values,
  path: ElemID,
  suiteQLTablesMap: Record<string, InstanceElement>,
  selectRecordTypeMap: Record<string, unknown>
): QueryRecordField[] =>
  Object.entries(value)
    .flatMap(([field, fieldValue]) => {
      if (fieldValue === ACCOUNT_SPECIFIC_VALUE) {
        const fieldType = getQueryRecordFieldType(
          instance,
          value,
          field,
          suiteQLTablesMap,
          selectRecordTypeMap,
        )
        if (fieldType !== undefined) {
          return { name: field, type: fieldType }
        }
      }
      if (field === INIT_CONDITION) {
        const parameters = getConditionParameters(fieldValue)
        if (parameters.some(param => param?.value === ACCOUNT_SPECIFIC_VALUE && getQueryRecordFieldType(
          instance, param, 'value', suiteQLTablesMap, selectRecordTypeMap
        ) !== undefined)) {
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
  selectRecordTypeMap: Record<string, unknown>
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
      .filter(fullName => allQueryRecords[fullName] !== undefined)
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
  queryRecords: QueryRecord[]
): Promise<string[]> => {
  const workflowScriptIds = new Set(
    queryRecords
      .filter(record => record.type === 'workflow')
      .map(record => record.serviceId)
  )
  const workflowNames = _.uniq(
    instances
      .filter(instance => workflowScriptIds.has(instance.value[SCRIPT_ID]))
      .map(instance => instance.value[NAME_FIELD])
  )
  const result = await client.runSavedSearchQuery({
    type: 'workflow',
    columns: ['internalid'],
    filters: workflowNames
      .map(name => ['name', 'is', name])
      .reduce((filter, curr, i) => (
        i < workflowNames.length - 1
          ? [...filter, curr, 'OR']
          : [...filter, curr]
      ), []),
  })
  const ajv = new Ajv({ allErrors: true, strict: false })
  if (!ajv.validate<WorkflowInternalID[]>(WORKFLOW_INTERNAL_IDS_SCHEMA, result)) {
    log.error('Got invalid results from workflow internal ids search: %s', ajv.errorsText())
    return []
  }
  return _.uniq(result.map(row => row.internalid[0].value))
}

const query = async (
  client: NetsuiteClient,
  instances: InstanceElement[],
  queryRecords: QueryRecord[]
): Promise<QueryRecordResponse[] | undefined> => {
  const schema = createQuerySchema(queryRecords)
  const ids = await getWorkflowIdsToQuery(client, instances, queryRecords)
  if (ids.length === 0) {
    log.warn('received an empty list workflow internal ids - skipping records query')
    return []
  }
  return client.runRecordsQuery(ids, schema)
}

const getInnerResult = (
  results: QueryRecordResponse[],
  path: string[]
): QueryRecordResponse | undefined => {
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
  name.startsWith(RESOLVED_ACCOUNT_SPECIFIC_VALUE_PREFIX)
  && name.endsWith(RESOLVED_ACCOUNT_SPECIFIC_VALUE_SUFFIX)

const getResolvedAccountSpecificValue = (name: string): string =>
  name.slice(
    RESOLVED_ACCOUNT_SPECIFIC_VALUE_PREFIX.length,
    name.length - RESOLVED_ACCOUNT_SPECIFIC_VALUE_SUFFIX.length
  )

const setFieldValue = (
  field: QueryRecordField,
  value: Values,
  internalId: string,
  suiteQLTablesMap: Record<string, InstanceElement>
): void => {
  const { name } = makeArray(field.type)
    .map(typeName => getSuiteQLTableInternalIdsMap(suiteQLTablesMap[typeName])[internalId])
    .find(res => res !== undefined) ?? {}
  if (name === undefined) {
    log.warn('could not find internal id %s of type %s', internalId, field.type)
    return
  }
  value[field.name] = toResolvedAccountSpecificValue(name)
}

const setParametersValues = (
  instance: InstanceElement,
  value: Values,
  formulaWithInternalIds: string,
  suiteQLTablesMap: Record<string, InstanceElement>,
  selectRecordTypeMap: Record<string, unknown>
): void => {
  const params = getConditionParameters(value[INIT_CONDITION])
    // not only params with ACCOUNT_SPECIFIC_VALUE are represented with internalid in the formula (e.g roles)
    // but only params that have selectrecordtype are represented with internalid in the formula
    .filter(param => param?.[SELECT_RECORD_TYPE] !== undefined)
  const internalIds = Array.from(matchAll(formulaWithInternalIds, /-?\d+/g))
    .map(res => res[0])
    // 0 (zero) can be used in a formula (e.g 'arrayIndexOf(...) < 0'), but it's not an internalid
    .filter(internalId => internalId !== '0')
  if (params.length !== internalIds.length) {
    log.warn(
      'params length %d do not match the internal ids extracted from the formula: %s',
      params.length,
      formulaWithInternalIds
    )
    return
  }
  _.sortBy(params, param => value[INIT_CONDITION][FORMULA].indexOf(`"${param.name}"`))
    .forEach((param, index) => {
      if (param.value === ACCOUNT_SPECIFIC_VALUE) {
        const internalId = internalIds[index]
        const paramType = getQueryRecordFieldType(
          instance,
          param,
          'value',
          suiteQLTablesMap,
          selectRecordTypeMap,
        )
        if (paramType !== undefined) {
          setFieldValue({ name: 'value', type: paramType }, param, internalId, suiteQLTablesMap)
        }
      }
    })
}

const setValuesInInstance = (
  instance: InstanceElement,
  record: QueryRecord,
  results: QueryRecordResponse[],
  suiteQLTablesMap: Record<string, InstanceElement>,
  selectRecordTypeMap: Record<string, unknown>
): void => {
  const innerValue = record.elemID.isTopLevel()
    ? instance.value
    : resolvePath(instance, record.elemID)
  const innerResult = getInnerResult(results, record.path)
  if (innerResult === undefined) {
    log.warn('missing record %s in path %s: %o', record.serviceId, record.path.join('.'), results)
    return
  }
  record.fields.forEach(field => {
    const internalId = innerResult.body[field.name]
    if (internalId === undefined || internalId === '') {
      log.warn('missing field %s in record %s: %o', field.name, record.serviceId, innerResult.body)
      return
    }
    if (typeof internalId !== 'string') {
      log.warn('field %s in record %s is not a string: %o', field.name, record.serviceId, internalId)
      return
    }
    if (field.type === FORMULA_PARAMS) {
      setParametersValues(instance, innerValue, internalId, suiteQLTablesMap, selectRecordTypeMap)
    } else {
      setFieldValue(field, innerValue, internalId, suiteQLTablesMap)
    }
  })
}

const toMissingInternalIdWarning = (
  elemID: ElemID,
  name: string,
  field: string
): ChangeError => ({
  elemID,
  severity: 'Warning',
  message: 'Could not identify value in workflow',
  // TODO: add help article link
  detailedMessage: `Could not find object "${name}" for field "${field}". Setting it to ACCOUNT_SPECIFIC_VALUE instead.`,
})

const toMultipleInternalIdsWarning = (
  elemID: ElemID,
  name: string,
  internalId: string
): ChangeError => ({
  elemID,
  severity: 'Warning',
  message: 'Multiple objects with the same name',
  detailedMessage: `There are multiple objects with the name "${name}". Using the first one (internal id: ${internalId}).`,
})

const resolveAccountSpecificValues = (
  instance: InstanceElement,
  suiteQLTablesMap: Record<string, Record<string, string[]>>,
): ChangeError[] => {
  const resolveWarnings: ChangeError[] = []
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
    const fieldType = getQueryRecordFieldType(instance, value, field, suiteQLTablesMap, {})
    const internalIds = _.uniq(makeArray(fieldType).flatMap(type => suiteQLTablesMap[type][name] ?? []))
    const internalId = internalIds[0]
    if (internalIds.length === 0) {
      log.warn(
        'could not find internal id of "%s" in field %s from value: %o',
        name, path.createNestedID(field).getFullName(), value,
      )
      resolveWarnings.push(toMissingInternalIdWarning(path, name, field))
      value[field] = ACCOUNT_SPECIFIC_VALUE
    } else {
      if (internalIds.length > 1) {
        log.warn('there are several internal ids for name %s - using the first: %d', name, internalId)
        resolveWarnings.push(toMultipleInternalIdsWarning(path, name, internalId))
      }
      value[field] = internalId
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

  return resolveWarnings
}

export const resolveWorkflowsAccountSpecificValues = async (
  workflowInstances: InstanceElement[],
  elementsSource: ReadOnlyElementsSource,
): Promise<ChangeError[]> => {
  const suiteQLNameToInternalIdsMap = await getSuiteQLNameToInternalIdsMap(elementsSource)
  return workflowInstances.flatMap(instance => resolveAccountSpecificValues(
    instance,
    suiteQLNameToInternalIdsMap,
  ))
}

const getSelectRecordTypeMap = async (
  elements: Element[],
  elementsSourceIndex: LazyElementsSourceIndexes,
  isPartial: boolean,
): Promise<Record<string, unknown>> => {
  const selectRecordTypeMap = {
    ...isPartial
      ? (await elementsSourceIndex.getIndexes()).customFieldsSelectRecordTypeIndex
      : {},
  }
  elements.forEach(element => {
    assignToCustomFieldsSelectRecordTypeIndex(element, selectRecordTypeMap)
  })
  return selectRecordTypeMap
}

const filterCreator: RemoteFilterCreator = ({ client, elementsSource, elementsSourceIndex, isPartial }) => ({
  name: 'workflowAccountSpecificValues',
  remote: true,
  onFetch: async elements => {
    const instances = elements.filter(isInstanceElement)
    const suiteQLTablesMap = _.keyBy(
      instances.filter(instance => instance.elemID.typeName === SUITEQL_TABLE),
      instance => instance.elemID.name
    )
    if (_.isEmpty(suiteQLTablesMap)) {
      log.debug('there are no suiteql tables instances - skipping setting workflow account specific values')
      return
    }
    const selectRecordTypeMap = await getSelectRecordTypeMap(elements, elementsSourceIndex, isPartial)
    const workflowInstances = instances.filter(instance => instance.elemID.typeName === WORKFLOW)
    const queryRecords = workflowInstances
      .map(instance => getQueryRecords(instance, suiteQLTablesMap, selectRecordTypeMap))
      .filter(({ records }) => records.length > 0)

    if (queryRecords.length === 0) {
      return
    }

    await Promise.all(
      _.chunk(queryRecords, RECORDS_PER_QUERY).map(
        async (chunk: InstanceWithQueryRecords[]): Promise<void> => {
          const chunkRecords = chunk.flatMap(item => item.records)
          const results = await query(client, workflowInstances, chunkRecords) ?? []
          if (results.length === 0) {
            log.warn('skipping setting values due to empty result of query records: %o', chunkRecords)
            return
          }
          chunk.forEach(({ instance, records }) => {
            records.forEach(record => {
              setValuesInInstance(instance, record, results, suiteQLTablesMap, selectRecordTypeMap)
            })
          })
        }
      )
    )
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
    await resolveWorkflowsAccountSpecificValues(
      workflowInstances,
      elementsSource,
    )
  },
})

export default filterCreator
