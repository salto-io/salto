/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { values, collections, hash, strings } from '@salto-io/lowerdash'
import {
  getChangeElement, DeployResult, Change, isPrimitiveType, InstanceElement, Value, PrimitiveTypes,
  ModificationChange, Field, ObjectType, isObjectType, Values, isAdditionChange, isRemovalChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { BatchResultInfo } from 'jsforce-types'
import { isInstanceOfCustomObject, instancesToCreateRecords, apiName,
  instancesToDeleteRecords, instancesToUpdateRecords, Types } from './transformers/transformer'
import SalesforceClient from './client/client'
import { CUSTOM_OBJECT_ID_FIELD } from './constants'
import { DataManagementConfig } from './types'
import { getIdFields, buildSelectStr, transformRecordToValues } from './filters/custom_objects_instances'
import { isListCustomSettingsObject } from './filters/custom_settings_filter'
import { SalesforceRecord } from './client/types'

const { isDefined } = values
const { toArrayAsync } = collections.asynciterable
const { toMD5 } = hash

type ActionResult = {
  successInstances: InstanceElement[]
  errorMessages: string[]
}

const getErrorMessagesFromResults = (results: BatchResultInfo[]): string[] =>
  results
    .filter(result => !result.success)
    .flatMap(erroredResult => erroredResult.errors)
    .filter(isDefined)

const getActionResult = (
  results: BatchResultInfo[],
  instances: InstanceElement[]
): ActionResult => {
  const successIds = results.filter(result => result.success).map(result => result.id)
  const successInstances = instances.filter(instance => successIds.includes(apiName(instance)))
  const errorMessages = getErrorMessagesFromResults(results)
  return { successInstances, errorMessages }
}

const escapeWhereStr = (str: string): string =>
  str.replace(/(\\)|(')/g, escaped => `\\${escaped}`)

const formatValueForWhere = (field: Field, value: Value): string => {
  if (value === undefined) {
    return 'null'
  }
  if (isPrimitiveType(field.type)) {
    if (field.type.primitive === PrimitiveTypes.STRING) {
      return `'${escapeWhereStr(value)}'`
    }
    return value.toString()
  }
  throw new Error(`Can not create WHERE clause for non-primitve field ${field.name}`)
}

const getRecordsBySaltoIds = async (
  type: ObjectType,
  instances: InstanceElement[],
  saltoIdFields: Field[],
  client: SalesforceClient,
): Promise<SalesforceRecord[]> => {
  // The use of IN can lead to querying uneeded records (cross values between instances)
  // and can be optimized
  const computeWhereConditions = (field: Field): string | string[] => {
    const fieldType = field.type
    if (isObjectType(fieldType)) {
      const compoundFieldType = Object.values(Types.compoundDataTypes)
        .find(compoundType => compoundType.isEqual(fieldType))
      if (compoundFieldType !== undefined) {
        return Object
          .entries(compoundFieldType.fields).map(([compoundFieldName, compoundField]) => {
            const compoundFieldValues = [
              ...new Set(instances.map(instance =>
                (formatValueForWhere(
                  compoundField,
                  instance.value[field.name]?.[compoundFieldName]
                )))),
            ]
            return `${strings.capitalizeFirstLetter(compoundFieldName)} IN (${compoundFieldValues.join(',')})`
          })
      }
    }
    const instancesFieldValues = [...new Set(instances
      .map(instance =>
        (formatValueForWhere(instance.type.fields[field.name], instance.value[field.name]))))]
    return `${apiName(field, true)} IN (${instancesFieldValues.join(',')})`
  }
  // Should always query Id together with the SaltoIdFields to match it to instances
  const saltoIdFieldsWithIdField = (saltoIdFields
    .find(field => field.name === CUSTOM_OBJECT_ID_FIELD) === undefined)
    ? [type.fields[CUSTOM_OBJECT_ID_FIELD], ...saltoIdFields] : saltoIdFields
  const selectStr = buildSelectStr(saltoIdFieldsWithIdField)
  const fieldsWheres = saltoIdFields.flatMap(computeWhereConditions)
  const whereStr = fieldsWheres.join(' AND ')
  const query = `SELECT ${selectStr} FROM ${apiName(type)} WHERE ${whereStr}`
  const recordsIterable = await client.queryAll(query)
  return (await toArrayAsync(recordsIterable)).flat()
}

const getDataManagementConfigForCustomSettings = (instances: InstanceElement[]):
  DataManagementConfig => ({
  includeObjects: [`^${apiName(instances[0].type)}`],
  saltoIDSettings: {
    defaultIdFields: ['Name'],
  },
})

const insertInstances = async (
  typeName: string,
  instances: InstanceElement[],
  client: SalesforceClient,
): Promise<ActionResult> => {
  if (instances.length === 0) {
    return { successInstances: [], errorMessages: [] }
  }
  const results = await client.bulkLoadOperation(
    typeName,
    'insert',
    instancesToCreateRecords(instances)
  )
  const successInstanceAndIndexes = instances
    .map((instance, index) => ({ instance, index }))
    .filter((_instance, index) => results[index]?.success)
  successInstanceAndIndexes.forEach(({ instance, index }) => {
    instance.value[CUSTOM_OBJECT_ID_FIELD] = results[index].id
  })
  const errorMessages = getErrorMessagesFromResults(results)
  return {
    successInstances: successInstanceAndIndexes.map(({ instance }) => instance),
    errorMessages,
  }
}

const updateInstances = async (
  typeName: string,
  instances: InstanceElement[],
  client: SalesforceClient,
): Promise<ActionResult> => {
  if (instances.length === 0) {
    return { successInstances: [], errorMessages: [] }
  }
  const results = await client.bulkLoadOperation(
    typeName,
    'update',
    instancesToUpdateRecords(instances)
  )
  return getActionResult(results, instances)
}

const deleteInstances = async (
  typeName: string,
  instances: InstanceElement[],
  client: SalesforceClient,
): Promise<ActionResult> => {
  const results = await client.bulkLoadOperation(
    typeName,
    'delete',
    instancesToDeleteRecords(instances),
  )
  return getActionResult(results, instances)
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
): Promise<DeployResult> => {
  const { type } = instances[0]
  const typeName = apiName(type)
  const idFieldsNames = idFields.map(field => field.name)
  const computeSaltoIdHash = (vals: Values): string => {
    // Building the object this way because order of keys is important
    const idFieldsValues = Object.fromEntries(
      idFieldsNames.map(fieldName => [fieldName, vals[fieldName]])
    )
    return toMD5(safeJsonStringify(idFieldsValues))
  }
  const computeRecordSaltoIdHash = (record: SalesforceRecord): string => {
    const recordValues = transformRecordToValues(type, record)
    // Remove null values from the record result to compare it to instance values
    const recordValuesWithoutNulls = cloneWithoutNulls(recordValues)
    return computeSaltoIdHash(recordValuesWithoutNulls)
  }
  const existingRecordsLookup = _.keyBy(
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
  } = await insertInstances(
    typeName,
    newInstances,
    client,
  )
  existingInstances.forEach(instance => {
    instance.value[
      CUSTOM_OBJECT_ID_FIELD
    ] = existingRecordsLookup[computeSaltoIdHash(instance.value)][CUSTOM_OBJECT_ID_FIELD]
  })
  const {
    successInstances: successUpdateInstances,
    errorMessages: updateErrorMessages,
  } = await updateInstances(
    apiName(type),
    existingInstances,
    client
  )
  const allSuccessInstances = [...successInsertInstances, ...successUpdateInstances]
  return {
    appliedChanges: allSuccessInstances.map(instance => ({ action: 'add', data: { after: instance } })),
    errors: [...insertErrorMessages, ...updateErrorMessages].map(error => new Error(error)),
  }
}

const deployRemoveInstances = async (
  instances: InstanceElement[],
  client: SalesforceClient,
): Promise<DeployResult> => {
  const { successInstances, errorMessages } = await deleteInstances(
    apiName(instances[0].type),
    instances,
    client
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
  const instancesType = apiName(changesData[0].after.type)
  const [validData, diffApiNameData] = _.partition(
    changesData,
    changeData => apiName(changeData.before) === apiName(changeData.after)
  )
  const afters = validData.map(data => data.after)
  const { successInstances, errorMessages } = await updateInstances(instancesType, afters, client)
  const successData = validData
    .filter(changeData =>
      successInstances.find(instance => instance.isEqual(changeData.after)))
  const diffApiNameErrors = diffApiNameData.map(data => new Error(`Failed to update as api name prev=${apiName(
    data.before
  )} and new=${apiName(data.after)} are different`))
  const errors = errorMessages.map(error => new Error(error)).concat(diffApiNameErrors)
  return {
    appliedChanges: successData.map(data => ({ action: 'modify', data })),
    errors,
  }
}

export const isInstanceOfCustomObjectChange = (
  change: Change
): change is Change<InstanceElement> => (
  isInstanceOfCustomObject(getChangeElement(change))
)

export const isCustomObjectInstanceChanges = (
  changes: Change[]
): changes is Change<InstanceElement>[] =>
  changes.every(isInstanceOfCustomObjectChange)

const isModificationChangeList = <T>(
  changes: ReadonlyArray<Change<T>>
): changes is ReadonlyArray<ModificationChange<T>> => (
    changes.every(isModificationChange)
  )

export const deployCustomObjectInstancesGroup = async (
  changes: ReadonlyArray<Change<InstanceElement>>,
  client: SalesforceClient,
  dataManagementConfig?: DataManagementConfig,
): Promise<DeployResult> => {
  try {
    const instances = changes.map(change => getChangeElement(change))
    const instanceTypes = [...new Set(instances.map(inst => apiName(inst.type)))]
    if (instanceTypes.length > 1) {
      throw new Error(`Custom Object Instances change group should have a single type but got: ${instanceTypes}`)
    }
    const actualDataManagement = isListCustomSettingsObject(instances[0].type)
      ? getDataManagementConfigForCustomSettings(instances) : dataManagementConfig
    if (actualDataManagement === undefined) {
      throw new Error('dataManagement must be defined in the salesforce.nacl config to deploy Custom Object instances')
    }
    if (changes.every(isAdditionChange)) {
      const { idFields, invalidFields } = getIdFields(instances[0].type, actualDataManagement)
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
