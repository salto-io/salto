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
import { logger } from '@salto-io/logging'
import {
  collections,
  hash,
  strings,
  promises,
  values,
  retry,
} from '@salto-io/lowerdash'
import {
  AdditionChange,
  getChangeData,
  DeployResult,
  Change,
  isPrimitiveType,
  InstanceElement,
  Value,
  PrimitiveTypes,
  ModificationChange,
  Field,
  ObjectType,
  isObjectType,
  Values,
  isAdditionChange,
  isRemovalChange,
  isModificationChange,
  TypeElement,
  SaltoElementError,
  SaltoError,
  SeverityLevel,
  isInstanceElement,
  isInstanceChange,
  toChange,
  isElement,
  getAllChangeData,
  ElemID,
  isAdditionOrModificationChange,
} from '@salto-io/adapter-api'
import {
  inspectValue,
  safeJsonStringify,
  getValuesChanges,
  applyFunctionToChangeData,
} from '@salto-io/adapter-utils'
import { BatchResultInfo } from '@salto-io/jsforce-types'
import { EOL } from 'os'
import {
  isInstanceOfCustomObject,
  instancesToCreateRecords,
  apiName,
  instancesToDeleteRecords,
  instancesToUpdateRecords,
  Types,
} from './transformers/transformer'
import SalesforceClient from './client/client'
import {
  ADD_SBAA_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP,
  CUSTOM_OBJECT_ID_FIELD,
  FIELD_ANNOTATIONS,
  DEFAULT_CUSTOM_OBJECT_DEPLOY_RETRY_DELAY,
  DEFAULT_CUSTOM_OBJECT_DEPLOY_RETRY_DELAY_MULTIPLIER,
  OWNER_ID,
  SBAA_APPROVAL_CONDITION,
  SBAA_APPROVAL_RULE,
  SBAA_CONDITIONS_MET,
  SYSTEM_FIELDS,
  ADD_CPQ_CUSTOM_PRICE_RULE_AND_CONDITION_GROUP,
  CPQ_PRICE_RULE,
  CPQ_PRICE_CONDITION,
  CPQ_CONDITIONS_MET,
  CPQ_PRICE_CONDITION_RULE_FIELD,
  CPQ_PRODUCT_RULE,
  CPQ_ERROR_CONDITION,
  CPQ_ERROR_CONDITION_RULE_FIELD,
  ADD_CPQ_CUSTOM_PRODUCT_RULE_AND_CONDITION_GROUP,
} from './constants'
import {
  getIdFields,
  transformRecordToValues,
} from './filters/custom_objects_instances'
import {
  apiNameSync,
  buildSelectQueries,
  getFieldNamesForQuery,
  isHiddenField,
  isInstanceOfTypeChangeSync,
  SoqlQuery,
} from './filters/utils'
import { isListCustomSettingsObject } from './filters/custom_settings_filter'
import { SalesforceRecord } from './client/types'
import { buildDataManagement } from './fetch_profile/data_management'
import { DataManagement } from './types'

const { toArrayAsync } = collections.asynciterable
const { partition } = promises.array
const { sleep } = promises.timeout
const { awu, keyByAsync } = collections.asynciterable
const { toMD5 } = hash
const { exponentialBackoff } = retry.retryStrategies
const log = logger(module)

type ActionResult = {
  successInstances: InstanceElement[]
  errorInstances: (SaltoElementError | SaltoError)[]
}

type InstanceAndResult = {
  instance: InstanceElement
  result: BatchResultInfo
}

type ErrorType = 'recoverable' | 'fatal' | 'given-up-on-recoverable'

const logErroredInstances = (
  instancesAndResults: InstanceAndResult[],
  errorType: ErrorType,
): void =>
  instancesAndResults.forEach(({ instance, result }) => {
    if (result.errors !== undefined) {
      log.error(
        'Instance %s had %s deploy errors - %s and values - %o',
        instance.elemID.getFullName(),
        errorType,
        ['', ...result.errors].join('\n\t'),
        inspectValue(instance.value),
      )
    }
  })

const getErrorInstancesFromInstAndResults = (
  instancesAndResults: InstanceAndResult[],
): SaltoElementError[] =>
  instancesAndResults.flatMap(({ instance, result }) =>
    values.isDefined(result.errors)
      ? result.errors.filter(Boolean).map(
          (error: string) =>
            ({
              elemID: instance.elemID,
              message: error,
              severity: 'Error',
            }) as SaltoElementError,
        )
      : [],
  )

const getAndLogErrors = (
  instancesAndResults: InstanceAndResult[],
  errorType: ErrorType,
): SaltoElementError[] => {
  const errored = instancesAndResults.filter(
    ({ result }) => !result.success && result.errors !== undefined,
  )
  logErroredInstances(errored, errorType)
  return getErrorInstancesFromInstAndResults(errored)
}

const groupInstancesAndResultsByIndex = (
  results: BatchResultInfo[],
  instances: InstanceElement[],
): InstanceAndResult[] =>
  instances.map((instance, index) => ({ instance, result: results[index] }))

const escapeWhereStr = (str: string): string =>
  str.replace(/(\\)|(')/g, (escaped) => `\\${escaped}`)

const getStringValueToEscape = (field: Field, value: Value): string => {
  if (_.isString(value)) {
    return value
  }
  // Relevant for advanced deploy groups e.g. ADD_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP
  if (isElement(value)) {
    const referencedElementApiName = apiNameSync(value)
    if (!_.isString(referencedElementApiName)) {
      throw new Error(
        `Expected referenced element to have apiName in field ${field.elemID.getFullName()}`,
      )
    }
    return referencedElementApiName
  }
  throw new Error(
    `Expected value of field ${field.elemID.getFullName()} to be string. received ${safeJsonStringify(value)}`,
  )
}

const formatValueForWhere = async (
  field: Field,
  value: Value,
): Promise<string> => {
  if (value === undefined) {
    return 'null'
  }
  const fieldType = await field.getType()
  if (isPrimitiveType(fieldType)) {
    if (fieldType.primitive === PrimitiveTypes.STRING) {
      return `'${escapeWhereStr(getStringValueToEscape(field, value))}'`
    }
    return value.toString()
  }
  throw new Error(
    `Can not create WHERE clause for non-primitive field ${field.name}`,
  )
}

const isCompoundFieldType = (type: TypeElement): type is ObjectType =>
  isObjectType(type) &&
  Object.values(Types.compoundDataTypes).some((compoundType) =>
    compoundType.isEqual(type),
  )

const MANDATORY_FIELDS_FOR_UPDATE = [CUSTOM_OBJECT_ID_FIELD, OWNER_ID]

const mandatoryFieldsForType = (type: ObjectType): string[] =>
  // Should always query these fields along the SaltoIdFields as they're mandatory for update operation
  MANDATORY_FIELDS_FOR_UPDATE
    // Some mandatory fields might not be in the type (e.g. for custom settings or the detail side of
    // master-detail relationship for CustomObjects)
    .filter((mandatoryField) =>
      Object.keys(type.fields).includes(mandatoryField),
    )

const queryInstancesWithFields = async (
  client: SalesforceClient,
  typeName: string,
  fieldsToQuery: string[],
  instanceIdValues: ReadonlyArray<ReadonlyArray<SoqlQuery>>,
): Promise<SalesforceRecord[]> => {
  const queries = buildSelectQueries(typeName, fieldsToQuery, instanceIdValues)
  const recordsIterable = awu(queries).flatMap((query) =>
    client.queryAll(query),
  )
  return (await toArrayAsync(recordsIterable)).flat()
}

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
    field: Field,
  ): Promise<[string, string][]> => {
    const fieldType = await field.getType()
    if (isCompoundFieldType(fieldType)) {
      return Promise.all(
        Object.values(fieldType.fields).map(async (innerField) => [
          strings.capitalizeFirstLetter(innerField.name),
          await formatValueForWhere(
            innerField,
            instance.value[field.name]?.[innerField.name],
          ),
        ]),
      ) as Promise<[string, string][]>
    }
    return [
      [
        await apiName(field, true),
        await formatValueForWhere(field, instance.value[field.name]),
      ],
    ]
  }

  if (apiNameSync(type) === undefined) {
    log.debug(
      'Type %s has no API name. Existing records will not be fetched.',
      type.elemID.getFullName(),
    )
    return []
  }

  const instanceIdValues = await Promise.all(
    instances.map(async (inst) => {
      const idFieldsNameToValue = (
        await Promise.all(
          saltoIdFields.map((field) => getFieldNamesToValues(inst, field)),
        )
      ).flat()
      const r = idFieldsNameToValue.map(([fieldName, value]) => ({
        fieldName,
        operator: 'IN' as const,
        value,
      }))
      return r
    }),
  )

  const fieldsToQuery = _.uniq(
    mandatoryFieldsForType(type).concat(
      await awu(saltoIdFields).flatMap(getFieldNamesForQuery).toArray(),
    ),
  )
  return queryInstancesWithFields(
    client,
    apiNameSync(type) as string,
    fieldsToQuery,
    instanceIdValues,
  )
}

const getDataManagementFromCustomSettings = async (
  instances: InstanceElement[],
): Promise<DataManagement> =>
  buildDataManagement({
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

const isRetryableErr =
  (retryableFailures: string[]) =>
  (instAndRes: InstanceAndResult): boolean =>
    _.every(instAndRes.result.errors, (salesforceErr) =>
      _.some(retryableFailures, (retryableFailure) =>
        salesforceErr.includes(retryableFailure),
      ),
    )

const retryDelayStrategyFromConfig = (
  client: SalesforceClient,
): retry.RetryStrategy =>
  exponentialBackoff({
    initial:
      client.dataRetry.retryDelay ?? DEFAULT_CUSTOM_OBJECT_DEPLOY_RETRY_DELAY,
    multiplier:
      client.dataRetry.retryDelayMultiplier ??
      DEFAULT_CUSTOM_OBJECT_DEPLOY_RETRY_DELAY_MULTIPLIER,
  })()

export const retryFlow = async (
  crudFn: CrudFn,
  crudFnArgs: CrudFnArgs,
  retriesLeft: number,
  retryDelayStrategy?: retry.RetryStrategy,
): Promise<ActionResult> => {
  const { client } = crudFnArgs
  const { retryableFailures } = client.dataRetry

  let successes: InstanceElement[] = []
  let errors: (SaltoElementError | SaltoError)[] = []

  const instanceResults = await crudFn(crudFnArgs)

  const [succeeded, failed] = _.partition(
    instanceResults,
    (instanceResult) => instanceResult.result.success,
  )
  const [recoverable, notRecoverable] = _.partition(
    failed,
    isRetryableErr(retryableFailures),
  )

  successes = successes.concat(
    succeeded.map((instAndRes) => instAndRes.instance),
  )
  errors = errors.concat(getAndLogErrors(notRecoverable, 'fatal'))

  if (_.isEmpty(recoverable)) {
    return { successInstances: successes, errorInstances: errors }
  }
  if (retriesLeft === 0) {
    return {
      successInstances: successes,
      errorInstances: errors.concat(
        getAndLogErrors(recoverable, 'given-up-on-recoverable'),
      ),
    }
  }

  const actualRetryDelayStrategy =
    retryDelayStrategy ?? retryDelayStrategyFromConfig(client)
  const retryDelay = actualRetryDelayStrategy()
  if (_.isNumber(retryDelay)) {
    await sleep(retryDelay)
  } else {
    log.warn('Invalid delay %s', retryDelay)
    await sleep(client.dataRetry.retryDelay)
  }

  log.debug('in custom object deploy retry-flow. retries left: %d', retriesLeft)
  logErroredInstances(recoverable, 'recoverable')

  const { successInstances, errorInstances } = await retryFlow(
    crudFn,
    {
      ...crudFnArgs,
      instances: recoverable.map((instAndRes) => instAndRes.instance),
    },
    retriesLeft - 1,
    actualRetryDelayStrategy,
  )
  return {
    successInstances: successes.concat(successInstances),
    errorInstances: errors.concat(errorInstances),
  }
}

const removeFieldsWithNoPermission = async (
  instanceChange: Change<InstanceElement>,
  permissionAnnotation: string,
): Promise<SaltoElementError[]> => {
  const shouldRemoveField = (
    type: ObjectType,
    fieldName: string,
    fieldValue: Value,
  ): boolean => {
    const fieldDef = type.fields[fieldName]
    if (fieldDef === undefined) {
      return false
    }
    if (isHiddenField(fieldDef) || SYSTEM_FIELDS.includes(fieldName)) {
      return false
    }
    return (
      fieldValue === undefined ||
      !type.fields[fieldName].annotations[permissionAnnotation]
    )
  }
  const createRemovedFieldWarning = (
    type: ObjectType,
    instanceId: ElemID,
    fieldValue: Value,
    fieldName: string,
  ): SaltoElementError => {
    log.info(
      'Removing field %s from %s: %s=%s, value=%s',
      fieldName,
      instanceId.getFullName(),
      permissionAnnotation,
      type.fields[fieldName]?.annotations[permissionAnnotation],
      fieldValue,
    )
    return {
      message: `The field ${fieldName} will not be deployed because it lacks the '${permissionAnnotation}' permission`,
      severity: 'Warning',
      elemID: instanceId,
    }
  }
  let namesOfFieldsThatChanged = Object.keys(
    getChangeData(instanceChange).value,
  )
  if (isModificationChange(instanceChange)) {
    const [instanceBefore, instanceAfter] = getAllChangeData(instanceChange)
    const detailedChanges = getValuesChanges({
      id: instanceBefore.elemID,
      before: instanceBefore.value,
      after: instanceAfter.value,
      beforeId: instanceBefore.elemID,
      afterId: instanceAfter.elemID,
    })
    namesOfFieldsThatChanged = detailedChanges
      .filter((detailedChange) =>
        isAdditionOrModificationChange(detailedChange),
      )
      .map((detailedChange) => detailedChange.id.name)
  }
  const instanceAfter = getChangeData(instanceChange)
  const instanceType = instanceAfter.getTypeSync()
  const fieldsToRemove = namesOfFieldsThatChanged.filter((fieldName) =>
    shouldRemoveField(instanceType, fieldName, instanceAfter.value[fieldName]),
  )

  const warnings = fieldsToRemove.map((fieldName) =>
    createRemovedFieldWarning(
      instanceType,
      instanceAfter.elemID,
      instanceAfter.value[fieldName],
      fieldName,
    ),
  )

  instanceAfter.value = _.omit(instanceAfter.value, fieldsToRemove)
  return warnings
}

const insertInstances: CrudFn = async ({
  typeName,
  instances,
  client,
}): Promise<InstanceAndResult[]> => {
  if (instances.length === 0) {
    return []
  }
  const results = await client.bulkLoadOperation(
    typeName,
    'insert',
    await instancesToCreateRecords(instances),
  )
  const instancesAndResults = groupInstancesAndResultsByIndex(
    results,
    instances,
  )

  // Add IDs to success instances
  instancesAndResults
    .filter((instAndRes) => instAndRes.result.success)
    .forEach(({ instance, result }) => {
      instance.value[CUSTOM_OBJECT_ID_FIELD] = result.id
    })
  return instancesAndResults
}

const updateInstances: CrudFn = async ({
  typeName,
  instances,
  client,
  groupId,
}): Promise<InstanceAndResult[]> => {
  if (instances.length === 0) {
    return []
  }
  const results = await client.bulkLoadOperation(
    typeName,
    'update',
    // For this special group, we know it's safe to update without adding nulls, since the Record
    // was previously added by us, and no Data could be deleted by the user during this process.
    await instancesToUpdateRecords(
      instances,
      groupId !== ADD_SBAA_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP,
    ),
  )
  return groupInstancesAndResultsByIndex(results, instances)
}

const ALREADY_DELETED_ERROR = 'ENTITY_IS_DELETED:entity is deleted:--'

const removeSilencedDeleteErrors = (
  result: BatchResultInfo,
): BatchResultInfo => {
  if (!_.isEmpty(result.errors)) {
    const [silencedErrors, realErrors] = _.partition(
      result.errors,
      (error) => error === ALREADY_DELETED_ERROR,
    )
    log.debug('Ignoring delete errors: %s%s', EOL, silencedErrors.join(EOL))
    return {
      ...result,
      success: result.success || _.isEmpty(realErrors),
      errors: realErrors,
    }
  }

  return result
}

export const deleteInstances: CrudFn = async ({
  typeName,
  instances,
  client,
}): Promise<InstanceAndResult[]> => {
  const results = (
    await client.bulkLoadOperation(
      typeName,
      'delete',
      instancesToDeleteRecords(instances),
    )
  ).map(removeSilencedDeleteErrors)
  return groupInstancesAndResultsByIndex(results, instances)
}

const cloneWithoutNulls = (val: Values): Values =>
  Object.fromEntries(
    Object.entries(val)
      .filter(([_k, v]) => v !== null)
      .map(([k, v]) => {
        if (_.isObject(v)) {
          return [k, cloneWithoutNulls(v)]
        }
        return [k, v]
      }),
  )

const deployAddInstances = async (
  changes: ReadonlyArray<AdditionChange<InstanceElement>>,
  idFields: Field[],
  client: SalesforceClient,
  groupId: string,
): Promise<DeployResult> => {
  const instances = changes.map(getChangeData)
  // Instances with internalIds have been already deployed previously, unless they are in the current
  // deployed group of instances This is relevant to the ADD_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP group for example.
  const instancesReferencingToBeDeployedInstances = instances.filter(
    (instance) =>
      Object.values(instance.value)
        // Only successfully deployed Instances have Id
        .some(
          (v) =>
            isInstanceElement(v) &&
            v.value[CUSTOM_OBJECT_ID_FIELD] === undefined,
        ),
  )
  // Replacing self-reference field values with the resolved instances that will later contain the Record Ids
  const instanceByElemId = _.keyBy(instances, (instance) =>
    instance.elemID.getFullName(),
  )
  await awu(instancesReferencingToBeDeployedInstances).forEach((instance) => {
    instance.value = _.mapValues(instance.value, (val) =>
      isInstanceElement(val)
        ? instanceByElemId[val.elemID.getFullName()] ?? val
        : val,
    )
  })
  const type = await instances[0].getType()
  const typeName = await apiName(type)
  const idFieldsNames = idFields.map((field) => field.name)
  const computeSaltoIdHash = (vals: Values): string => {
    // Building the object this way because order of keys is important
    const idFieldsValues = Object.fromEntries(
      idFieldsNames
        .map((fieldName) => [fieldName, vals[fieldName]])
        // Relevant for advanced deploy groups e.g. ADD_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP
        .map(([fieldName, value]) => [
          fieldName,
          isInstanceElement(value) ? apiNameSync(value) : value,
        ]),
    )
    return toMD5(safeJsonStringify(idFieldsValues))
  }
  const computeRecordSaltoIdHash = async (
    record: SalesforceRecord,
  ): Promise<string> => {
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
    changes,
    (change) =>
      existingRecordsLookup[computeSaltoIdHash(getChangeData(change).value)] !==
      undefined,
  )

  const warningsForInvalidFieldsInAddedInstances = await awu(newInstances)
    .flatMap((change) =>
      removeFieldsWithNoPermission(change, FIELD_ANNOTATIONS.CREATABLE),
    )
    .toArray()
  const warningsForInvalidFieldsInModifiedInstances = await awu(
    existingInstances,
  )
    .flatMap((change) =>
      removeFieldsWithNoPermission(change, FIELD_ANNOTATIONS.UPDATEABLE),
    )
    .toArray()
  const {
    successInstances: successInsertInstances,
    errorInstances: insertErrorInstances,
  } = await retryFlow(
    insertInstances,
    { typeName, instances: newInstances.map(getChangeData), client, groupId },
    client.dataRetry.maxAttempts,
  )
  if (instancesReferencingToBeDeployedInstances.length > 0) {
    log.debug(
      'Updating existingRecordsLookup of instances referencing to be deployed instances',
    )
    const lookups = await keyByAsync(
      await getRecordsBySaltoIds(
        type,
        instancesReferencingToBeDeployedInstances,
        idFields,
        client,
      ),
      computeRecordSaltoIdHash,
    )
    Object.entries(lookups).forEach(([idHash, record]) => {
      existingRecordsLookup[idHash] = record
    })
  }
  const instancesToUpdate = existingInstances
    .map(getChangeData)
    .concat(instancesReferencingToBeDeployedInstances)
  instancesToUpdate.forEach((instance) => {
    const existingRecordLookup =
      existingRecordsLookup[computeSaltoIdHash(instance.value)]
    if (existingRecordLookup === undefined) {
      log.warn(
        'Failed to find existing record for instance %s',
        instance.elemID.getFullName(),
      )
      return
    }
    MANDATORY_FIELDS_FOR_UPDATE.forEach((mandatoryField) => {
      if (
        instance.value[mandatoryField] === undefined &&
        existingRecordLookup[mandatoryField] !== undefined
      ) {
        instance.value[mandatoryField] = existingRecordLookup[mandatoryField]
      }
    })
  })
  const {
    successInstances: successUpdateInstances,
    errorInstances: errorUpdateInstances,
  } = await retryFlow(
    updateInstances,
    {
      typeName: await apiName(type),
      instances: instancesToUpdate,
      client,
      groupId,
    },
    client.dataRetry.maxAttempts,
  )
  const allSuccessInstances = [
    ...successInsertInstances,
    ...successUpdateInstances,
  ]
  return {
    appliedChanges: allSuccessInstances.map((instance) => ({
      action: 'add',
      data: { after: instance },
    })),
    errors: [
      ...insertErrorInstances,
      ...errorUpdateInstances,
      ...warningsForInvalidFieldsInAddedInstances,
      ...warningsForInvalidFieldsInModifiedInstances,
    ],
  }
}

const deployRemoveInstances = async (
  instances: InstanceElement[],
  client: SalesforceClient,
  groupId: string,
): Promise<DeployResult> => {
  const { successInstances, errorInstances } = await retryFlow(
    deleteInstances,
    {
      typeName: await apiName(await instances[0].getType()),
      instances,
      client,
      groupId,
    },
    client.dataRetry.maxAttempts,
  )
  return {
    appliedChanges: successInstances.map((instance) => ({
      action: 'remove',
      data: { before: instance },
    })),
    errors: errorInstances,
  }
}

const deployModifyChanges = async (
  changes: ReadonlyArray<ModificationChange<InstanceElement>>,
  client: SalesforceClient,
  groupId: string,
): Promise<DeployResult> => {
  const changesData = changes.map((change) => change.data)
  const instancesType = await apiName(await changesData[0].after.getType())
  const [validData, diffApiNameData] = await partition(
    changesData,
    async (changeData) =>
      (await apiName(changeData.before)) === (await apiName(changeData.after)),
  )
  const afters = validData.map((data) => data.after)

  const invalidFieldsWarnings = await awu(changes)
    .flatMap((change) =>
      removeFieldsWithNoPermission(change, FIELD_ANNOTATIONS.UPDATEABLE),
    )
    .toArray()
  const { successInstances, errorInstances } = await retryFlow(
    updateInstances,
    { typeName: instancesType, instances: afters, client, groupId },
    client.dataRetry.maxAttempts,
  )
  const successData = validData.filter((changeData) =>
    successInstances.find((instance) => instance.isEqual(changeData.after)),
  )
  const diffApiNameErrors: SaltoElementError[] = await awu(diffApiNameData)
    .map(async (data) => ({
      elemID: data.before.elemID,
      message: `Failed to update as api name prev=${await apiName(data.before)} and new=${await apiName(data.after)} are different`,
      severity: 'Error' as SeverityLevel,
    }))
    .toArray()
  const errors: (SaltoElementError | SaltoError)[] = [
    ...errorInstances,
    ...diffApiNameErrors,
    ...invalidFieldsWarnings,
  ]
  return {
    appliedChanges: successData.map((data) => ({ action: 'modify', data })),
    errors,
  }
}

/**
 * @deprecated use {@link isInstanceOfCustomObjectChangeSync} instead.
 */
export const isInstanceOfCustomObjectChange = async (
  change: Change,
): Promise<boolean> => isInstanceOfCustomObject(getChangeData(change))

export const isCustomObjectInstanceChanges = (
  changes: ReadonlyArray<Change>,
): Promise<boolean> => awu(changes).every(isInstanceOfCustomObjectChange)

const isModificationChangeList = <T>(
  changes: ReadonlyArray<Change<T>>,
): changes is ReadonlyArray<ModificationChange<T>> =>
  changes.every(isModificationChange)

const getMissingFields = (change: Change<InstanceElement>): string[] => {
  const typeFields = new Set(
    Object.keys(getChangeData(change).getTypeSync().fields),
  )
  return Object.keys(getChangeData(change).value).filter(
    (instanceField) => !typeFields.has(instanceField),
  )
}

const omitMissingFieldsValues = async (
  change: Change<InstanceElement>,
): Promise<Change<InstanceElement>> =>
  applyFunctionToChangeData(change, (instance) => {
    const instanceClone = instance.clone()
    const typeFields = new Set(Object.keys(instanceClone.getTypeSync().fields))
    Object.keys(instanceClone.value).forEach((instanceField) => {
      if (!typeFields.has(instanceField)) {
        delete instanceClone.value[instanceField]
      }
    })
    return instanceClone
  })

const deploySingleTypeAndActionCustomObjectInstancesGroup = async (
  changes: ReadonlyArray<Change<InstanceElement>>,
  client: SalesforceClient,
  groupId: string,
  dataManagement?: DataManagement,
): Promise<DeployResult> => {
  const customObjectInstancesDeployError = (message: string): DeployResult => ({
    appliedChanges: [],
    errors: changes.map((change) => ({
      message,
      severity: 'Error',
      elemID: getChangeData(change).elemID,
    })),
  })
  const [changesWithMissingFields, validChanges] = _.partition(
    changes,
    (change) => getMissingFields(change).length > 0,
  )
  const missingFieldValuesWarnings: SaltoElementError[] =
    changesWithMissingFields
      .map((change) => ({ change, missingFields: getMissingFields(change) }))
      .map(({ change, missingFields }) => ({
        severity: 'Warning',
        elemID: getChangeData(change).elemID,
        message: `The values of the following fields were not deployed since they are not defined in the type: [${missingFields.join(', ')}]`,
      }))
  const withMissingFieldValuesErrors = (
    deployResult: DeployResult,
  ): DeployResult => {
    const appliedChangesElemIds = new Set(
      deployResult.appliedChanges.map((change) =>
        getChangeData(change).elemID.getFullName(),
      ),
    )
    return {
      ...deployResult,
      errors: deployResult.errors
        // We should omit warnings on non applied changes
        .concat(
          missingFieldValuesWarnings.filter((warning) =>
            appliedChangesElemIds.has(warning.elemID.getFullName()),
          ),
        ),
    }
  }
  const changesToDeploy = validChanges.concat(
    await awu(changesWithMissingFields).map(omitMissingFieldsValues).toArray(),
  )
  try {
    const instances = changesToDeploy.map((change) => getChangeData(change))
    const instanceTypes = [
      ...new Set(
        await awu(instances)
          .map(async (inst) => apiName(await inst.getType()))
          .toArray(),
      ),
    ]
    if (instanceTypes.length > 1) {
      return customObjectInstancesDeployError(
        `Custom Object Instances change group should have a single type but got: ${instanceTypes}`,
      )
    }
    const actualDataManagement = isListCustomSettingsObject(
      await instances[0].getType(),
    )
      ? await getDataManagementFromCustomSettings(instances)
      : dataManagement
    if (actualDataManagement === undefined) {
      return customObjectInstancesDeployError(
        'dataManagement must be defined in the salesforce.nacl config to deploy Custom Object instances',
      )
    }
    if (changes.every(isAdditionChange)) {
      const { idFields, invalidIdFields } = await getIdFields(
        await instances[0].getType(),
        actualDataManagement,
      )
      if (invalidIdFields !== undefined && invalidIdFields.length > 0) {
        return customObjectInstancesDeployError(
          `Failed to add instances of type ${instanceTypes[0]} due to invalid SaltoIdFields - ${invalidIdFields}`,
        )
      }
      return withMissingFieldValuesErrors(
        await deployAddInstances(changes, idFields, client, groupId),
      )
    }
    if (changes.every(isRemovalChange)) {
      return await deployRemoveInstances(instances, client, groupId)
    }
    if (isModificationChangeList(changesToDeploy)) {
      return withMissingFieldValuesErrors(
        await deployModifyChanges(changesToDeploy, client, groupId),
      )
    }
    return customObjectInstancesDeployError(
      'Custom Object Instances change group must have one action',
    )
  } catch (error) {
    log.error('Error occurred for Data Deploy group %s: %o', groupId, error)
    return customObjectInstancesDeployError(error.message)
  }
}

/** Deploy a group with a circular dependency between the elements.
 *
 * CPQ and Advanced Approvals packages contain a pattern that results in a circular dependency between instances:
 *  - There is a "Rule" type (sbaa__ApprovalRule__c or SBQQ__PriceRule__c) and a "Condition" type
 *    (sbaa__ApprovalCondition__c or SBQQ__PriceCondition__c).
 *  - The "Condition" type contains a MasterDetail field that references the "Rule" type
 *  - The "Rule" type contains a "ConditionsMet" field (sbaa_ConditionsMet__c or SBQQ__ConditionsMet__c). If this field
 *    is set to "Custom" then the "AdvancedCondition" field (sbaa_AdvancedCondition__c or SBQQ_AdvancedCondition__c) has
 *    an indirect reference to some "Condition" instances. This reference is indirect because the "AdvancedCondition"
 *    field is a text field that contains indexes of "Condition" instances.
 *  - Thus if the "ConditionsMet" field is set to "Custom", then the "Rule" instance references specific "Condition"
 *    instances (via the "AdvancedCondition" field) while the "Condition" instances, in turn, reference the same "Rule"
 *    instance, leading to a circular dependency.
 *
 *  What we do in this case is we first set the "ConditionsMet" field of all the "Rule" instances to "All" (to break the
 *  circular dependency), then deploy them. This ensures any references from the (still undeployed) "Condition"
 *  instances is valid. We then deploy the "Condition" instances. Finally, we set the "ConditionsMet" field back to
 *  "Custom", and deploy the "Rule" instances again.
 *
 * @param ruleTypeName
 * @param ruleConditionFieldName
 * @param conditionTypeName
 * @param conditionRuleFieldName
 * @param changes
 * @param changeGroupId
 * @param client
 * @param dataManagement
 */
const deployRulesAndConditionsGroup = async (
  ruleTypeName: string,
  ruleConditionFieldName: string,
  conditionTypeName: string,
  conditionRuleFieldName: string,
  changes: ReadonlyArray<Change<InstanceElement>>,
  changeGroupId: string,
  client: SalesforceClient,
  dataManagement: DataManagement | undefined,
): Promise<DeployResult> => {
  const createNonDeployableConditionChangeError = (
    change: Change,
  ): SaltoElementError => ({
    message: `Cannot deploy ${conditionTypeName} instance ${getChangeData(change).elemID.getFullName()} since it depends on an ${ruleTypeName} instance that was not deployed successfully`,
    severity: 'Error',
    elemID: getChangeData(change).elemID,
  })

  const ruleChanges = changes.filter(isInstanceOfTypeChangeSync(ruleTypeName))

  const conditionChanges = changes.filter(
    isInstanceOfTypeChangeSync(conditionTypeName),
  )

  const anyInvalidRuleInstances = ruleChanges
    .map(getChangeData)
    .some((instance) => instance.value[ruleConditionFieldName] !== 'Custom')

  if (anyInvalidRuleInstances) {
    throw new Error(
      `Received ${ruleTypeName} instance without Custom ConditionsMet`,
    )
  }
  // On each condition instance, Replacing field referencing the rule to point to the resolved instance
  const ruleInstanceByElemID = _.keyBy(
    ruleChanges.map(getChangeData),
    (instance) => instance.elemID.getFullName(),
  )
  await awu(conditionChanges.map(getChangeData)).forEach((instance) => {
    instance.value = _.mapValues(instance.value, (val) =>
      isInstanceElement(val)
        ? ruleInstanceByElemID[val.elemID.getFullName()] ?? val
        : val,
    )
  })
  log.debug(
    `Deploying ${ruleTypeName} instances with "All" ConditionsMet instead of "Custom"`,
  )
  ruleChanges.map(getChangeData).forEach((instance) => {
    instance.value[ruleConditionFieldName] = 'All'
  })
  const rulesWithAllConditionsMetDeployResult =
    await deploySingleTypeAndActionCustomObjectInstancesGroup(
      ruleChanges,
      client,
      changeGroupId,
      dataManagement,
    )
  log.debug(`Deploying ${conditionTypeName} instances`)
  const [deployableConditionChanges, nonDeployableConditionChanges] =
    _.partition(conditionChanges, (change) => {
      const conditionInstance = getChangeData(change)
      const ruleInstance = conditionInstance.value[conditionRuleFieldName]
      if (!isInstanceElement(ruleInstance)) {
        log.error(
          `Expected ${conditionTypeName} with name %s to contain InstanceElement for the ${conditionRuleFieldName} field`,
          conditionInstance.elemID.getFullName(),
        )
        return false
      }
      // Only successfully deployed Instances have Id
      if (ruleInstance.value[CUSTOM_OBJECT_ID_FIELD] === undefined) {
        log.error(
          `The ${conditionTypeName} with name %s is not referencing a successfully deployed ${ruleTypeName} instance with name %s`,
          conditionInstance.elemID.getFullName(),
          ruleInstance.elemID.getFullName(),
        )
        return false
      }
      return true
    })
  const conditionsDeployResult =
    await deploySingleTypeAndActionCustomObjectInstancesGroup(
      deployableConditionChanges,
      client,
      changeGroupId,
      dataManagement,
    )

  const ruleType = getChangeData(ruleChanges[0]).getTypeSync()
  const mandatoryFieldsForUpdate = mandatoryFieldsForType(ruleType)
  const instanceIdToMandatoryFields: Record<string, SalesforceRecord> = {}
  if (mandatoryFieldsForUpdate.length > 0) {
    const fieldsQuery = rulesWithAllConditionsMetDeployResult.appliedChanges
      .map((change) => getChangeData(change) as InstanceElement)
      .map((instance) => instance.value[CUSTOM_OBJECT_ID_FIELD])
      .map((internalId) => [
        {
          fieldName: CUSTOM_OBJECT_ID_FIELD,
          operator: 'IN' as const,
          value: `'${internalId}'`,
        },
      ])
    const recordsWithMandatoryFields = await queryInstancesWithFields(
      client,
      ruleTypeName,
      mandatoryFieldsForUpdate,
      fieldsQuery,
    )
    recordsWithMandatoryFields.forEach((record) => {
      instanceIdToMandatoryFields[record[CUSTOM_OBJECT_ID_FIELD]] = record
    })
  }

  log.debug(
    `Updating the ${ruleTypeName} instances with Custom ${ruleConditionFieldName}`,
  )
  const firstDeployAppliedChanges =
    rulesWithAllConditionsMetDeployResult.appliedChanges.filter(
      isInstanceChange,
    )
  firstDeployAppliedChanges.map(getChangeData).forEach((instance) => {
    instance.value[ruleConditionFieldName] = 'Custom'
    const instanceId = instance.value[CUSTOM_OBJECT_ID_FIELD]
    _(mandatoryFieldsForUpdate)
      .without(CUSTOM_OBJECT_ID_FIELD)
      .forEach((fieldName) => {
        instance.value[fieldName] =
          instanceIdToMandatoryFields[instanceId]?.[fieldName]
      })
  })
  const rulesWithCustomDeployResult =
    await deploySingleTypeAndActionCustomObjectInstancesGroup(
      // Transforming to modification changes to trigger "update" instead of "insert"
      firstDeployAppliedChanges.map((change) =>
        toChange({
          before: getChangeData(change),
          after: getChangeData(change),
        }),
      ),
      client,
      changeGroupId,
      dataManagement,
    )
  return {
    appliedChanges: rulesWithCustomDeployResult.appliedChanges
      // Transforming back to addition changes
      .map((change) => toChange({ after: getChangeData(change) }))
      .concat(conditionsDeployResult.appliedChanges),
    errors: rulesWithAllConditionsMetDeployResult.errors.concat(
      conditionsDeployResult.errors,
      rulesWithCustomDeployResult.errors,
      nonDeployableConditionChanges.map(
        createNonDeployableConditionChangeError,
      ),
    ),
  }
}

const deployAddCustomApprovalRulesAndConditions = async (
  changes: ReadonlyArray<Change<InstanceElement>>,
  client: SalesforceClient,
  dataManagement: DataManagement | undefined,
): Promise<DeployResult> =>
  deployRulesAndConditionsGroup(
    SBAA_APPROVAL_RULE,
    SBAA_CONDITIONS_MET,
    SBAA_APPROVAL_CONDITION,
    SBAA_APPROVAL_RULE,
    changes,
    ADD_SBAA_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP,
    client,
    dataManagement,
  )

const deployAddCustomPriceRulesAndConditions = async (
  changes: ReadonlyArray<Change<InstanceElement>>,
  client: SalesforceClient,
  dataManagement: DataManagement | undefined,
): Promise<DeployResult> =>
  deployRulesAndConditionsGroup(
    CPQ_PRICE_RULE,
    CPQ_CONDITIONS_MET,
    CPQ_PRICE_CONDITION,
    CPQ_PRICE_CONDITION_RULE_FIELD,
    changes,
    ADD_CPQ_CUSTOM_PRICE_RULE_AND_CONDITION_GROUP,
    client,
    dataManagement,
  )

const deployAddCustomProductRulesAndConditions = async (
  changes: ReadonlyArray<Change<InstanceElement>>,
  client: SalesforceClient,
  dataManagement: DataManagement | undefined,
): Promise<DeployResult> =>
  deployRulesAndConditionsGroup(
    CPQ_PRODUCT_RULE,
    CPQ_CONDITIONS_MET,
    CPQ_ERROR_CONDITION,
    CPQ_ERROR_CONDITION_RULE_FIELD,
    changes,
    ADD_CPQ_CUSTOM_PRODUCT_RULE_AND_CONDITION_GROUP,
    client,
    dataManagement,
  )

export const deployCustomObjectInstancesGroup = async (
  changes: ReadonlyArray<Change<InstanceElement>>,
  client: SalesforceClient,
  groupId: string,
  dataManagement?: DataManagement,
): Promise<DeployResult> => {
  switch (groupId) {
    case ADD_SBAA_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP: {
      return deployAddCustomApprovalRulesAndConditions(
        changes,
        client,
        dataManagement,
      )
    }
    case ADD_CPQ_CUSTOM_PRICE_RULE_AND_CONDITION_GROUP: {
      return deployAddCustomPriceRulesAndConditions(
        changes,
        client,
        dataManagement,
      )
    }
    case ADD_CPQ_CUSTOM_PRODUCT_RULE_AND_CONDITION_GROUP: {
      return deployAddCustomProductRulesAndConditions(
        changes,
        client,
        dataManagement,
      )
    }
    default: {
      return deploySingleTypeAndActionCustomObjectInstancesGroup(
        changes,
        client,
        groupId,
        dataManagement,
      )
    }
  }
}
