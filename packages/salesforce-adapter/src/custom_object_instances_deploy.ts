/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { collections, hash, strings, promises } from '@salto-io/lowerdash'
import {
  getChangeData, DeployResult, Change, isPrimitiveType, InstanceElement, Value, PrimitiveTypes,
  ModificationChange, Field, ObjectType, isObjectType, Values, isAdditionChange, isRemovalChange,
  isModificationChange,
  TypeElement,
} from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { BatchResultInfo } from 'jsforce-types'
import { EOL } from 'os'
import {
  isInstanceOfCustomObject, instancesToCreateRecords, apiName,
  instancesToDeleteRecords, instancesToUpdateRecords, Types,
} from './transformers/transformer'
import SalesforceClient from './client/client'
import { CUSTOM_OBJECT_ID_FIELD } from './constants'
import { getIdFields, transformRecordToValues } from './filters/custom_objects_instances'
import { buildSelectQueries } from './filters/utils'
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
  errorMessages: string[]
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

const getErrorMessagesFromInstAndResults = (instancesAndResults: InstanceAndResult[]): string[] =>
  instancesAndResults
    .map(({ instance, result }) => `${instance.elemID.name}:
    \t${result.errors?.join('\n\t')}`)

const getAndLogErrors = (instancesAndResults: InstanceAndResult[]): string[] => {
  const errored = instancesAndResults
    .filter(({ result }) => !result.success && result.errors !== undefined)
  logErroredInstances(errored)
  return getErrorMessagesFromInstAndResults(errored)
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
  const queries = await buildSelectQueries(
    await apiName(type),
    saltoIdFieldsWithIdField,
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
  const { typeName, instances, client } = crudFnArgs
  const { retryDelay, retryableFailures } = client.dataRetry

  let successes: InstanceElement[] = []
  let errMsgs: string[] = []

  const instanceResults = await crudFn({ typeName, instances, client })

  const [succeeded, failed] = _.partition(instanceResults, instanceResult =>
    instanceResult.result.success)
  const [recoverable, notRecoverable] = _.partition(failed, isRetryableErr(retryableFailures))

  successes = successes.concat(succeeded.map(instAndRes => instAndRes.instance))
  errMsgs = errMsgs.concat(getAndLogErrors(notRecoverable))

  if (_.isEmpty(recoverable)) {
    return { successInstances: successes, errorMessages: errMsgs }
  }
  if (retriesLeft === 0) {
    return {
      successInstances: successes,
      errorMessages: errMsgs.concat(getAndLogErrors(recoverable)),
    }
  }

  await sleep(retryDelay)

  log.debug(`in custom object deploy retry-flow. retries left: ${retriesLeft},
                  remaining retryable failures are: ${recoverable}`)

  const { successInstances, errorMessages } = await retryFlow(
    crudFn,
    { ...crudFnArgs, instances: recoverable.map(instAndRes => instAndRes.instance) },
    retriesLeft - 1
  )
  return {
    successInstances: successes.concat(successInstances),
    errorMessages: errMsgs.concat(errorMessages),
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
    client }
): Promise<InstanceAndResult[]> => {
  if (instances.length === 0) {
    return []
  }
  const results = await client.bulkLoadOperation(
    typeName,
    'update',
    await instancesToUpdateRecords(instances)
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
  client: SalesforceClient
): Promise<DeployResult> => {
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
    errorMessages: insertErrorMessages,
  } = await retryFlow(
    insertInstances,
    { typeName, instances: newInstances, client },
    client.dataRetry.maxAttempts
  )
  existingInstances.forEach(instance => {
    instance.value[
      CUSTOM_OBJECT_ID_FIELD
    ] = existingRecordsLookup[computeSaltoIdHash(instance.value)][CUSTOM_OBJECT_ID_FIELD]
  })
  const {
    successInstances: successUpdateInstances,
    errorMessages: updateErrorMessages,
  } = await retryFlow(
    updateInstances,
    { typeName: await apiName(type), instances: existingInstances, client },
    client.dataRetry.maxAttempts
  )
  const allSuccessInstances = [...successInsertInstances, ...successUpdateInstances]
  return {
    appliedChanges: allSuccessInstances.map(instance => ({ action: 'add', data: { after: instance } })),
    errors: [...insertErrorMessages, ...updateErrorMessages].map(error => new Error(error)),
  }
}

const deployRemoveInstances = async (
  instances: InstanceElement[],
  client: SalesforceClient
): Promise<DeployResult> => {
  const { successInstances, errorMessages } = await retryFlow(
    deleteInstances,
    { typeName: await apiName(await instances[0].getType()), instances, client },
    client.dataRetry.maxAttempts
  )
  return {
    appliedChanges: successInstances.map(instance => ({ action: 'remove', data: { before: instance } })),
    errors: errorMessages.map(error => new Error(error)),
  }
}

const deployModifyChanges = async (
  changes: Readonly<ModificationChange<InstanceElement>[]>,
  client: SalesforceClient,
): Promise<DeployResult> => {
  const changesData = changes
    .map(change => change.data)
  const instancesType = await apiName(await changesData[0].after.getType())
  const [validData, diffApiNameData] = await partition(
    changesData,
    async changeData => await apiName(changeData.before) === await apiName(changeData.after)
  )
  const afters = validData.map(data => data.after)
  const { successInstances, errorMessages } = await retryFlow(
    updateInstances,
    { typeName: instancesType, instances: afters, client },
    client.dataRetry.maxAttempts
  )
  const successData = validData
    .filter(changeData =>
      successInstances.find(instance => instance.isEqual(changeData.after)))
  const diffApiNameErrors = await awu(diffApiNameData).map(async data => new Error(`Failed to update as api name prev=${await apiName(
    data.before
  )} and new=${await apiName(data.after)} are different`)).toArray()
  const errors = errorMessages.map(error => new Error(error)).concat(diffApiNameErrors)
  return {
    appliedChanges: successData.map(data => ({ action: 'modify', data })),
    errors,
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

export const deployCustomObjectInstancesGroup = async (
  changes: ReadonlyArray<Change<InstanceElement>>,
  client: SalesforceClient,
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
      const { idFields, invalidFields } = await getIdFields(
        await instances[0].getType(), actualDataManagement
      )
      if (invalidFields !== undefined && invalidFields.length > 0) {
        throw new Error(`Failed to add instances of type ${instanceTypes[0]} due to invalid SaltoIdFields - ${invalidFields}`)
      }
      return await deployAddInstances(instances, idFields, client)
    }
    if (changes.every(isRemovalChange)) {
      return await deployRemoveInstances(instances, client)
    }
    if (isModificationChangeList(changes)) {
      return await deployModifyChanges(changes, client)
    }
    throw new Error('Custom Object Instances change group must have one action')
  } catch (error) {
    return {
      appliedChanges: [],
      errors: [error],
    }
  }
}
