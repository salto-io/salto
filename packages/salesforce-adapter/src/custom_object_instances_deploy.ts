/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { logger } from '@salto-io/logging'
import { collections, hash, strings, promises, values } from '@salto-io/lowerdash'
import {
  getChangeData, DeployResult, Change, isPrimitiveType, InstanceElement, Value, PrimitiveTypes,
  ModificationChange, Field, ObjectType, isObjectType, Values, isAdditionChange, isRemovalChange,
  isModificationChange,
  TypeElement,
  SaltoElementError,
  SaltoError,
  SeverityLevel,
  isInstanceElement, isInstanceChange, toChange,
} from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { BatchResultInfo } from 'jsforce-types'
import { EOL } from 'os'
import {
  isInstanceOfCustomObject, instancesToCreateRecords, apiName,
  instancesToDeleteRecords, instancesToUpdateRecords, Types,
} from './transformers/transformer'
import SalesforceClient from './client/client'
import {
  ADD_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP,
  CUSTOM_OBJECT_ID_FIELD, SBAA_APPROVAL_CONDITION,
  SBAA_APPROVAL_RULE,
  SBAA_CONDITIONS_MET,
} from './constants'
import { getIdFields, transformRecordToValues } from './filters/custom_objects_instances'
import { buildSelectQueries, getFieldNamesForQuery, isInstanceOfTypeChange } from './filters/utils'
import { isListCustomSettingsObject } from './filters/custom_settings_filter'
import { SalesforceRecord } from './client/types'
import { buildDataManagement, DataManagement } from './fetch_profile/data_management'

const { toArrayAsync } = collections.asynciterable
const { partition } = promises.array
const { sleep } = promises.timeout
const { awu, keyByAsync } = collections.asynciterable
const { toMD5 } = hash
const log = logger(module)

type ActionResult = {
  successInstances: InstanceElement[]
  errorInstances: (SaltoElementError | SaltoError)[]
}

type InstanceAndResult = {
  instance: InstanceElement
  result: BatchResultInfo
}

const logErroredInstances = (instancesAndResults: InstanceAndResult[]): void => (
  instancesAndResults.forEach(({ instance, result }) => {
    if (result.errors !== undefined) {
      log.error(`Instance ${instance.elemID.getFullName()} had deploy errors - ${['', ...result.errors].join('\n\t')}

and values -
${safeJsonStringify(instance.value, undefined, 2,)}
`)
    }
  })
)

const getErrorInstancesFromInstAndResults = (instancesAndResults: InstanceAndResult[]): SaltoElementError[] =>
  instancesAndResults.flatMap(({ instance, result }) =>
    (values.isDefined(result.errors)
      ? result.errors
        .filter(Boolean)
        .map((error: string) => ({
          elemID: instance.elemID,
          message: error,
          severity: 'Error',
        } as SaltoElementError))
      : []))

const getAndLogErrors = (instancesAndResults: InstanceAndResult[]): SaltoElementError[] => {
  const errored = instancesAndResults
    .filter(({ result }) => !result.success && result.errors !== undefined)
  logErroredInstances(errored)
  return getErrorInstancesFromInstAndResults(errored)
}

const groupInstancesAndResultsByIndex = (
  results: BatchResultInfo[], instances: InstanceElement[],
): InstanceAndResult[] =>
  (instances.map((instance, index) =>
    ({ instance, result: results[index] })))

const escapeWhereStr = (str: string): string =>
  str.replace(/(\\)|(')/g, escaped => `\\${escaped}`)

const formatValueForWhere = async (field: Field, value: Value): Promise<string> => {
  if (value === undefined) {
    return 'null'
  }
  const fieldType = await field.getType()
  if (isPrimitiveType(fieldType)) {
    if (fieldType.primitive === PrimitiveTypes.STRING) {
      return `'${escapeWhereStr(value)}'`
    }
    return value.toString()
  }
  throw new Error(`Can not create WHERE clause for non-primitive field ${field.name}`)
}

const isCompoundFieldType = (type: TypeElement): type is ObjectType => (
  isObjectType(type)
  && Object.values(Types.compoundDataTypes).some(compoundType => compoundType.isEqual(type))
)

const getRecordsBySaltoIds = async (
  type: ObjectType,
  instances: InstanceElement[],
  saltoIdFields: Field[],
  client: SalesforceClient,
): Promise<SalesforceRecord[]> => {
  // The use of IN can lead to querying unneeded records (cross values between instances)
  // and can be optimized
  const getFieldNamesToValues = async (
    instance: InstanceElement,
    field: Field
  ): Promise<[string, string][]> => {
    const fieldType = await field.getType()
    if (isCompoundFieldType(fieldType)) {
      return Promise.all(Object.values(fieldType.fields)
        .map(async innerField => [
          strings.capitalizeFirstLetter(innerField.name),
          await formatValueForWhere(innerField, instance.value[field.name]?.[innerField.name]),
        ])) as Promise<[string, string][]>
    }
    return [
      [await apiName(field, true), await formatValueForWhere(field, instance.value[field.name])],
    ]
  }

  const instanceIdValues = await Promise.all(instances.map(async inst => {
    const idFieldsNameToValue = (await Promise.all(
      saltoIdFields.map(field => getFieldNamesToValues(inst, field))
    )).flat()
    const r = Object.fromEntries(idFieldsNameToValue)
    return r
  }))

  // Should always query Id together with the SaltoIdFields to match it to instances
  const saltoIdFieldsWithIdField = (saltoIdFields
    .find(field => field.name === CUSTOM_OBJECT_ID_FIELD) === undefined)
    ? [type.fields[CUSTOM_OBJECT_ID_FIELD], ...saltoIdFields] : saltoIdFields

  const fieldNames = await awu(saltoIdFieldsWithIdField).flatMap(getFieldNamesForQuery).toArray()
  const queries = await buildSelectQueries(
    await apiName(type),
    fieldNames,
    instanceIdValues,
  )
  const recordsIterable = awu(queries).flatMap(query => client.queryAll(query))
  // Possible REBASE issue
  // const selectStr = await buildSelectStr(saltoIdFieldsWithIdField)
  // const fieldsWheres = await awu(saltoIdFields)
  //   .flatMap(async e => makeArray(await computeWhereConditions(e)))
  //   .toArray()
  // const whereStr = fieldsWheres.join(' AND ')
  // const query = `SELECT ${selectStr} FROM ${await apiName(type)} WHERE ${whereStr}`
  // const recordsIterable = await client.queryAll(query)
  return (await toArrayAsync(recordsIterable)).flat()
}

const getDataManagementFromCustomSettings = async (instances: InstanceElement[]):
  Promise<DataManagement> => buildDataManagement({
  includeObjects: [`^${await apiName(await instances[0].getType())}`],
  saltoIDSettings: {
    defaultIdFields: ['Name'],
  },
})

type CrudFnArgs = {
  typeName: string
  instances: InstanceElement[]
  client: SalesforceClient
  groupId: string
}

export type CrudFn = (fnArgs: CrudFnArgs) => Promise<InstanceAndResult[]>

const isRetryableErr = (retryableFailures: string[]) =>
  (instAndRes: InstanceAndResult): boolean =>
    _.every(instAndRes.result.errors, salesforceErr =>
      _.some(retryableFailures, retryableFailure =>
        salesforceErr.includes(retryableFailure)))

export const retryFlow = async (
  crudFn: CrudFn,
  crudFnArgs: CrudFnArgs,
  retriesLeft: number,
): Promise<ActionResult> => {
  const { client } = crudFnArgs
  const { retryDelay, retryableFailures } = client.dataRetry

  let successes: InstanceElement[] = []
  let errors: (SaltoElementError | SaltoError)[] = []

  const instanceResults = await crudFn(crudFnArgs)

  const [succeeded, failed] = _.partition(instanceResults, instanceResult =>
    instanceResult.result.success)
  const [recoverable, notRecoverable] = _.partition(failed, isRetryableErr(retryableFailures))

  successes = successes.concat(succeeded.map(instAndRes => instAndRes.instance))
  errors = errors.concat(getAndLogErrors(notRecoverable))

  if (_.isEmpty(recoverable)) {
    return { successInstances: successes, errorInstances: errors }
  }
  if (retriesLeft === 0) {
    return {
      successInstances: successes,
      errorInstances: errors.concat(getAndLogErrors(recoverable)),
    }
  }

  await sleep(retryDelay)

  log.debug(`in custom object deploy retry-flow. retries left: ${retriesLeft},
                  remaining retryable failures are: ${recoverable}`)

  const { successInstances, errorInstances } = await retryFlow(
    crudFn,
    { ...crudFnArgs, instances: recoverable.map(instAndRes => instAndRes.instance) },
    retriesLeft - 1
  )
  return {
    successInstances: successes.concat(successInstances),
    errorInstances: errors.concat(errorInstances),
  }
}

const insertInstances: CrudFn = async (
  { typeName,
    instances,
    client }
): Promise<InstanceAndResult[]> => {
  if (instances.length === 0) {
    return []
  }
  const results = await client.bulkLoadOperation(
    typeName,
    'insert',
    await instancesToCreateRecords(instances)
  )
  const instancesAndResults = groupInstancesAndResultsByIndex(results, instances)

  // Add IDs to success instances
  instancesAndResults.filter(instAndRes => instAndRes.result.success)
    .forEach(({ instance, result }) => {
      instance.value[CUSTOM_OBJECT_ID_FIELD] = result.id
    })
  return instancesAndResults
}

const updateInstances: CrudFn = async (
  { typeName,
    instances,
    client,
    groupId }
): Promise<InstanceAndResult[]> => {
  if (instances.length === 0) {
    return []
  }
  const results = await client.bulkLoadOperation(
    typeName,
    'update',
    // For this special group, we know it's safe to update without adding nulls, since the Record
    // was previously added by us, and no Data could be deleted by the user during this process.
    await instancesToUpdateRecords(instances, groupId !== ADD_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP)
  )
  return groupInstancesAndResultsByIndex(results, instances)
}

const ALREADY_DELETED_ERROR = 'ENTITY_IS_DELETED:entity is deleted:--'

const removeSilencedDeleteErrors = (result: BatchResultInfo): BatchResultInfo => {
  if (!_.isEmpty(result.errors)) {
    const [silencedErrors, realErrors] = _.partition(result.errors,
      error => error === ALREADY_DELETED_ERROR)
    log.debug('Ignoring delete errors: %s%s', EOL, silencedErrors.join(EOL))
    return { ...result, success: result.success || _.isEmpty(realErrors), errors: realErrors }
  }

  return result
}

export const deleteInstances: CrudFn = async (
  { typeName,
    instances,
    client }
): Promise<InstanceAndResult[]> => {
  const results = (await client.bulkLoadOperation(
    typeName,
    'delete',
    instancesToDeleteRecords(instances)
  )).map(removeSilencedDeleteErrors)
  return groupInstancesAndResultsByIndex(results, instances)
}

const cloneWithoutNulls = (val: Values): Values =>
  (Object.fromEntries(Object.entries(val).filter(([_k, v]) => (v !== null)).map(([k, v]) => {
    if (_.isObject(v)) {
      return [k, cloneWithoutNulls(v)]
    }
    return [k, v]
  })))

const deployAddInstances = async (
  instances: InstanceElement[],
  idFields: Field[],
  client: SalesforceClient,
  groupId: string
): Promise<DeployResult> => {
  // Instances with internalIds have been already deployed previously, unless they are in the current
  // deployed group of instances This is relevant to the ADD_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP group for example.
  const instancesReferencingToBeDeployedInstances = instances
    .filter(instance => (
      Object.values(instance.value)
        // Only successfully deployed Instances have Id
        .some(v => isInstanceElement(v) && v.value[CUSTOM_OBJECT_ID_FIELD] === undefined)
    ))
  // Replacing self-reference field values with the resolved instances that will later contain the Record Ids
  const instanceByElemId = _.keyBy(instances, instance => instance.elemID.getFullName())
  await awu(instancesReferencingToBeDeployedInstances).forEach(instance => {
    instance.value = _.mapValues(instance.value, val => (isInstanceElement(val)
      ? instanceByElemId[val.elemID.getFullName()] ?? val
      : val))
  })
  const type = await instances[0].getType()
  const typeName = await apiName(type)
  const idFieldsNames = idFields.map(field => field.name)
  const computeSaltoIdHash = (vals: Values): string => {
    // Building the object this way because order of keys is important
    const idFieldsValues = Object.fromEntries(
      idFieldsNames.map(fieldName => [fieldName, vals[fieldName]])
    )
    return toMD5(safeJsonStringify(idFieldsValues))
  }
  const computeRecordSaltoIdHash = async (record: SalesforceRecord): Promise<string> => {
    const recordValues = await transformRecordToValues(type, record)
    // Remove null values from the record result to compare it to instance values
    const recordValuesWithoutNulls = cloneWithoutNulls(recordValues)
    return computeSaltoIdHash(recordValuesWithoutNulls)
  }
  const existingRecordsLookup = await keyByAsync(
    await getRecordsBySaltoIds(type, instances, idFields, client),
    computeRecordSaltoIdHash,
  )
  const [existingInstances, newInstances] = _.partition(
    instances,
    instance =>
      existingRecordsLookup[computeSaltoIdHash(instance.value)] !== undefined
  )
  const {
    successInstances: successInsertInstances,
    errorInstances: insertErrorInstances,
  } = await retryFlow(
    insertInstances,
    { typeName, instances: newInstances, client, groupId },
    client.dataRetry.maxAttempts
  )
  existingInstances.forEach(instance => {
    instance.value[
      CUSTOM_OBJECT_ID_FIELD
    ] = existingRecordsLookup[computeSaltoIdHash(instance.value)][CUSTOM_OBJECT_ID_FIELD]
  })
  const {
    successInstances: successUpdateInstances,
    errorInstances: errorUpdateInstances,
  } = await retryFlow(
    updateInstances,
    {
      typeName: await apiName(type),
      instances: existingInstances.concat(instancesReferencingToBeDeployedInstances),
      client,
      groupId,
    },
    client.dataRetry.maxAttempts
  )
  const allSuccessInstances = [...successInsertInstances, ...successUpdateInstances]
  return {
    appliedChanges: allSuccessInstances.map(instance => ({ action: 'add', data: { after: instance } })),
    errors: [...insertErrorInstances, ...errorUpdateInstances],
    extraProperties: {
      groups: [{ id: groupId }],
    },
  }
}

const deployRemoveInstances = async (
  instances: InstanceElement[],
  client: SalesforceClient,
  groupId: string
): Promise<DeployResult> => {
  const { successInstances, errorInstances } = await retryFlow(
    deleteInstances,
    { typeName: await apiName(await instances[0].getType()), instances, client, groupId },
    client.dataRetry.maxAttempts
  )
  return {
    appliedChanges: successInstances.map(instance => ({ action: 'remove', data: { before: instance } })),
    errors: errorInstances,
    extraProperties: {
      groups: [{ id: groupId }],
    },
  }
}

const deployModifyChanges = async (
  changes: Readonly<ModificationChange<InstanceElement>[]>,
  client: SalesforceClient,
  groupId: string
): Promise<DeployResult> => {
  const changesData = changes
    .map(change => change.data)
  const instancesType = await apiName(await changesData[0].after.getType())
  const [validData, diffApiNameData] = await partition(
    changesData,
    async changeData => await apiName(changeData.before) === await apiName(changeData.after)
  )
  const afters = validData.map(data => data.after)
  const { successInstances, errorInstances } = await retryFlow(
    updateInstances,
    { typeName: instancesType, instances: afters, client, groupId },
    client.dataRetry.maxAttempts
  )
  const successData = validData
    .filter(changeData =>
      successInstances.find(instance => instance.isEqual(changeData.after)))
  const diffApiNameErrors: SaltoElementError[] = await awu(diffApiNameData).map(async data => ({
    elemID: data.before.elemID,
    message: `Failed to update as api name prev=${await apiName(data.before)} and new=${await apiName(data.after)} are different`,
    severity: 'Error' as SeverityLevel,
  })).toArray()
  const errors: (SaltoElementError | SaltoError)[] = [...errorInstances, ...diffApiNameErrors]
  return {
    appliedChanges: successData.map(data => ({ action: 'modify', data })),
    errors,
    extraProperties: {
      groups: [{ id: groupId }],
    },
  }
}

export const isInstanceOfCustomObjectChange = async (
  change: Change
): Promise<boolean> => (
  isInstanceOfCustomObject(getChangeData(change))
)

export const isCustomObjectInstanceChanges = (
  changes: Change[]
): Promise<boolean> =>
  awu(changes).every(isInstanceOfCustomObjectChange)

const isModificationChangeList = <T>(
  changes: ReadonlyArray<Change<T>>
): changes is ReadonlyArray<ModificationChange<T>> => (
    changes.every(isModificationChange)
  )

const deploySingleTypeAndActionCustomObjectInstancesGroup = async (
  changes: ReadonlyArray<Change<InstanceElement>>,
  client: SalesforceClient,
  groupId: string,
  dataManagement?: DataManagement,
): Promise<DeployResult> => {
  try {
    const instances = changes.map(change => getChangeData(change))
    const instanceTypes = [...new Set(await awu(instances)
      .map(async inst => apiName(await inst.getType())).toArray())]
    if (instanceTypes.length > 1) {
      throw new Error(`Custom Object Instances change group should have a single type but got: ${instanceTypes}`)
    }
    const actualDataManagement = isListCustomSettingsObject(await instances[0].getType())
      ? await getDataManagementFromCustomSettings(instances) : dataManagement
    if (actualDataManagement === undefined) {
      throw new Error('dataManagement must be defined in the salesforce.nacl config to deploy Custom Object instances')
    }
    if (changes.every(isAdditionChange)) {
      const { idFields, invalidIdFields } = await getIdFields(
        await instances[0].getType(), actualDataManagement
      )
      if (invalidIdFields !== undefined && invalidIdFields.length > 0) {
        throw new Error(`Failed to add instances of type ${instanceTypes[0]} due to invalid SaltoIdFields - ${invalidIdFields}`)
      }
      return await deployAddInstances(instances, idFields, client, groupId)
    }
    if (changes.every(isRemovalChange)) {
      return await deployRemoveInstances(instances, client, groupId)
    }
    if (isModificationChangeList(changes)) {
      return await deployModifyChanges(changes, client, groupId)
    }
    throw new Error('Custom Object Instances change group must have one action')
  } catch (error: unknown) {
    return {
      appliedChanges: [],
      errors: [{ message: (error as Error).message, severity: 'Error' }],
    }
  }
}

const createNonDeployableConditionChangeError = (change: Change): SaltoElementError => ({
  message: `Cannot deploy ApprovalCondition instance ${getChangeData(change).elemID.getFullName()} since it depends on an ApprovalRule instance that was not deployed successfully`,
  severity: 'Error',
  elemID: getChangeData(change).elemID,
})

const deployAddCustomApprovalRulesAndConditions = async (
  changes: ReadonlyArray<Change<InstanceElement>>,
  client: SalesforceClient,
  dataManagement: DataManagement | undefined
): Promise<DeployResult> => {
  const approvalRuleChanges = await awu(changes)
    .filter(isInstanceOfTypeChange(SBAA_APPROVAL_RULE))
    .toArray()
  const approvalConditionChanges = await awu(changes)
    .filter(isInstanceOfTypeChange(SBAA_APPROVAL_CONDITION))
    .toArray()
  if (approvalRuleChanges.map(getChangeData).some(instance => instance.value[SBAA_CONDITIONS_MET] !== 'Custom')) {
    throw new Error('Received ApprovalRule instance without Custom ConditionsMet')
  }
  // On each ApprovalCondition instance, Replacing sbaa__ApprovalRule__c to point to the resolved instance
  const approvalRuleByElemID = _.keyBy(
    approvalRuleChanges.map(getChangeData),
    instance => instance.elemID.getFullName()
  )
  await awu(approvalConditionChanges.map(getChangeData)).forEach(instance => {
    instance.value = _.mapValues(instance.value, val => (isInstanceElement(val)
      ? approvalRuleByElemID[val.elemID.getFullName()] ?? val
      : val))
  })
  log.debug('Deploying ApprovalRule instances with "All" ConditionsMet instead of "Custom"')
  approvalRuleChanges
    .map(getChangeData)
    .forEach(instance => {
      instance.value[SBAA_CONDITIONS_MET] = 'All'
    })
  const approvalRulesWithAllConditionsMetDeployResult = await deploySingleTypeAndActionCustomObjectInstancesGroup(
    approvalRuleChanges,
    client,
    ADD_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP,
    dataManagement,
  )
  log.debug('Deploying ApprovalCondition instances')
  const [deployableConditionChanges, nonDeployableConditionChanges] = _.partition(
    approvalConditionChanges,
    change => {
      const instance = getChangeData(change)
      const approvalRule = instance.value[SBAA_APPROVAL_RULE]
      if (!isInstanceElement(approvalRule)) {
        log.error('Expected ApprovalCondition with name %s to contain InstanceElement for the sbaa__ApprovalRule__c field', instance.elemID.getFullName())
        return false
      }
      // Only successfully deployed Instances have Id
      if (approvalRule.value[CUSTOM_OBJECT_ID_FIELD] === undefined) {
        log.error('The ApprovalCondition with name %s is not referencing a successfully deployed ApprovalRule instance with name %s', instance.elemID.getFullName(), approvalRule.elemID.getFullName())
        return false
      }
      return true
    }
  )
  const conditionsDeployResult = await deploySingleTypeAndActionCustomObjectInstancesGroup(
    deployableConditionChanges,
    client,
    ADD_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP,
    dataManagement,
  )

  log.debug('Updating the ApprovalRule instances with Custom ConditionsMet')
  const firstDeployAppliedChanges = approvalRulesWithAllConditionsMetDeployResult.appliedChanges
    .filter(isInstanceChange)
  firstDeployAppliedChanges
    .map(getChangeData)
    .forEach(instance => {
      instance.value[SBAA_CONDITIONS_MET] = 'Custom'
    })
  const approvalRulesWithCustomDeployResult = await deploySingleTypeAndActionCustomObjectInstancesGroup(
    // Transforming to modification changes to trigger "update" instead of "insert"
    firstDeployAppliedChanges.map(change => toChange({ before: getChangeData(change), after: getChangeData(change) })),
    client,
    ADD_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP,
    dataManagement,
  )
  return {
    appliedChanges: approvalRulesWithCustomDeployResult.appliedChanges
      // Transforming back to addition changes
      .map(change => toChange({ after: getChangeData(change) }))
      .concat(conditionsDeployResult.appliedChanges),
    errors: approvalRulesWithAllConditionsMetDeployResult.errors.concat(
      conditionsDeployResult.errors,
      approvalRulesWithCustomDeployResult.errors,
      nonDeployableConditionChanges.map(createNonDeployableConditionChangeError)
    ),
  }
}


export const deployCustomObjectInstancesGroup = async (
  changes: ReadonlyArray<Change<InstanceElement>>,
  client: SalesforceClient,
  groupId: string,
  dataManagement?: DataManagement,
): Promise<DeployResult> => (
  groupId === ADD_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP
    ? deployAddCustomApprovalRulesAndConditions(changes, client, dataManagement)
    : deploySingleTypeAndActionCustomObjectInstancesGroup(changes, client, groupId, dataManagement)
)
