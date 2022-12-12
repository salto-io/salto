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
import { collections, values, promises } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { InstanceElement, ObjectType, Element, Field } from '@salto-io/adapter-api'
import { pathNaclCase } from '@salto-io/adapter-utils'
import {
  createInvlidIdFieldConfigChange, createManyInstancesExcludeConfigChange,
  createUnresolvedRefIdFieldConfigChange,
} from '../config_change'
import SalesforceClient from '../client/client'
import { SalesforceRecord } from '../client/types'
import {
  SALESFORCE, RECORDS_PATH, INSTALLED_PACKAGES_PATH, CUSTOM_OBJECT_ID_FIELD,
  FIELD_ANNOTATIONS, UNLIMITED_INSTANCES_VALUE,
} from '../constants'
import { FilterResult, RemoteFilterCreator } from '../filter'
import { apiName, isCustomObject, Types, createInstanceServiceIds, isNameField } from '../transformers/transformer'
import { getNamespace, isMasterDetailField, isLookupField, queryClient, buildSelectQueries, getFieldNamesForQuery } from './utils'
import { ConfigChangeSuggestion } from '../types'
import { DataManagement } from '../fetch_profile/data_management'

const { mapValuesAsync, pickAsync } = promises.object
const { isDefined } = values
const { makeArray } = collections.array
const { keyByAsync, awu } = collections.asynciterable

const log = logger(module)

type TypeName = string
type RecordID = string
type RecordById = Record<RecordID, SalesforceRecord>
type RecordsByTypeAndId = Record<TypeName, RecordById>

export type CustomObjectFetchSetting = {
  objectType: ObjectType
  isBase: boolean
  idFields: Field[]
  invalidIdFields?: string[]
}

const defaultRecordKeysToOmit = ['attributes']
const nameSeparator = '___'
const detectsParentsIndicator = '##allMasterDetailFields##'

const isReferenceField = (field: Field): boolean => (
  isMasterDetailField(field) || isLookupField(field)
)

const getReferenceTo = (field: Field): string[] =>
  makeArray(field.annotations[FIELD_ANNOTATIONS.REFERENCE_TO]) as string[]

const isQueryableField = (field: Field): boolean => (
  field.annotations[FIELD_ANNOTATIONS.QUERYABLE] === true
)

const getQueryableFields = (object: ObjectType): Field[] => (
  Object.values(object.fields).filter(isQueryableField)
)

const buildQueryStrings = async (
  typeName: string,
  fields: Field[],
  ids?: string[]
): Promise<string[]> => {
  const fieldNames = await awu(fields).flatMap(getFieldNamesForQuery).toArray()
  return buildSelectQueries(typeName, fieldNames, ids?.map(id => ({ Id: `'${id}'` })))
}

const getRecords = async (
  client: SalesforceClient,
  type: ObjectType,
  ids?: string[],
): Promise<RecordById> => {
  const queryableFields = getQueryableFields(type)
  const typeName = await apiName(type)
  if (_.isEmpty(queryableFields)) {
    log.debug(`Type ${typeName} had no queryable fields`)
    return {}
  }
  const queries = await buildQueryStrings(typeName, queryableFields, ids)
  const records = await queryClient(client, queries)
  log.debug(`Fetched ${records.length} records of type ${typeName}`)
  return _.keyBy(
    records,
    record => record[CUSTOM_OBJECT_ID_FIELD]
  )
}

type recordToInstanceParams = {
  type: ObjectType
  record: SalesforceRecord
  instanceSaltoName: string
}

const transformCompoundNameValues = async (
  type: ObjectType,
  recordValue: SalesforceRecord
): Promise<SalesforceRecord> => {
  const nameSubFields = Object.keys(Types.compoundDataTypes.Name.fields)
  // We assume there's only one Name field
  const nameFieldName = Object.keys(await pickAsync(type.fields, isNameField))[0]
  const subNameValues = _.pick(recordValue, nameSubFields)
  return (_.isUndefined(nameFieldName) || _.isEmpty(subNameValues))
    ? recordValue
    : {
      ..._.omit(recordValue, nameSubFields),
      [nameFieldName]: subNameValues,
      [CUSTOM_OBJECT_ID_FIELD]: recordValue[CUSTOM_OBJECT_ID_FIELD],
    }
}

const omitDefaultKeys = (recordValue: SalesforceRecord): SalesforceRecord =>
  ({
    ..._.omit(recordValue, defaultRecordKeysToOmit),
    [CUSTOM_OBJECT_ID_FIELD]: recordValue[CUSTOM_OBJECT_ID_FIELD],
  })

export const transformRecordToValues = async (
  type: ObjectType,
  recordValue: SalesforceRecord
): Promise<SalesforceRecord> => {
  const valuesWithTransformedName = await transformCompoundNameValues(type, recordValue)
  return omitDefaultKeys(valuesWithTransformedName)
}

const recordToInstance = async (
  { type, record, instanceSaltoName }: recordToInstanceParams
): Promise<InstanceElement> => {
  const getInstancePath = async (instanceName: string): Promise<string[]> => {
    const typeNamespace = await getNamespace(type)
    const instanceFileName = pathNaclCase(instanceName)
    if (typeNamespace) {
      return [SALESFORCE, INSTALLED_PACKAGES_PATH, typeNamespace,
        RECORDS_PATH, type.elemID.typeName, instanceFileName]
    }
    return [SALESFORCE, RECORDS_PATH, type.elemID.typeName, instanceFileName]
  }
  const { name } = Types.getElemId(
    instanceSaltoName,
    true,
    createInstanceServiceIds(_.pick(record, CUSTOM_OBJECT_ID_FIELD), type),
  )
  return new InstanceElement(
    name,
    type,
    await transformRecordToValues(type, record),
    await getInstancePath(name),
  )
}

const typesRecordsToInstances = async (
  recordByIdAndType: RecordsByTypeAndId,
  customObjectFetchSetting: Record<TypeName, CustomObjectFetchSetting>,
): Promise<{ instances: InstanceElement[]; configChangeSuggestions: ConfigChangeSuggestion[] }> => {
  const typesToUnresolvedRefFields = {} as Record<TypeName, Set<string>>
  const addUnresolvedRefFieldByType = (typeName: string, unresolvedFieldName: string): void => {
    if (typesToUnresolvedRefFields[typeName] === undefined) {
      typesToUnresolvedRefFields[typeName] = new Set([unresolvedFieldName])
    }
    typesToUnresolvedRefFields[typeName].add(unresolvedFieldName)
  }
  const saltoNameByIdAndType = {} as Record<TypeName, Record<RecordID, string>>
  const setSaltoName = (typeName: TypeName, recordId: string, saltoName: string): void => {
    if (saltoNameByIdAndType[typeName] === undefined) {
      saltoNameByIdAndType[typeName] = {}
    }
    saltoNameByIdAndType[typeName][recordId] = saltoName
  }
  const getSaltoName = (typeName: TypeName, recordId: string): string | undefined =>
    saltoNameByIdAndType[typeName]?.[recordId]

  const getRecordSaltoName = async (
    typeName: string,
    record: SalesforceRecord,
  ): Promise<string> => {
    const fieldToSaltoName = async (field: Field): Promise<string | undefined> => {
      const fieldValue = record[field.name]
      if (fieldValue === null || fieldValue === undefined) {
        return undefined
      }
      if (!isReferenceField(field)) {
        return fieldValue.toString()
      }
      const referencedTypeNames = getReferenceTo(field)
      const referencedName = await awu(referencedTypeNames).map(referencedTypeName => {
        const rec = recordByIdAndType[referencedTypeName]?.[fieldValue]
        if (rec === undefined) {
          log.debug(`Failed to find record with id ${fieldValue} of type ${referencedTypeName} when looking for reference`)
          return undefined
        }
        return getRecordSaltoName(referencedTypeName, rec)
      }).find(isDefined)
      if (referencedName === undefined) {
        addUnresolvedRefFieldByType(typeName, field.name)
      }
      return referencedName
    }
    const saltoName = getSaltoName(typeName, record[CUSTOM_OBJECT_ID_FIELD])
    if (saltoName !== undefined) {
      return saltoName
    }
    const saltoIdFields = customObjectFetchSetting[typeName].idFields
    const saltoIdsValues = await awu(saltoIdFields)
      .map(field => fieldToSaltoName(field))
      .filter(isDefined)
      .toArray()
    const fullName = saltoIdsValues.join(nameSeparator)
    setSaltoName(typeName, record[CUSTOM_OBJECT_ID_FIELD], fullName)
    return fullName
  }

  const instances = await awu(Object.entries(recordByIdAndType))
    .flatMap(async ([typeName, idToRecord]) =>
      (awu(Object.values(idToRecord))
        .map(async record => ({
          type: customObjectFetchSetting[typeName].objectType,
          record,
          instanceSaltoName: await getRecordSaltoName(typeName, record),
        }))
        .filter(async recToInstanceParams =>
          !Object.keys(typesToUnresolvedRefFields).includes(
            await apiName(recToInstanceParams.type)
          ))
        .map(recordToInstance))).toArray()
  const configChangeSuggestions = Object.entries(typesToUnresolvedRefFields)
    .map(([typeName, unresolvedRefFields]) =>
      createUnresolvedRefIdFieldConfigChange(typeName, [...unresolvedRefFields]))
  return {
    instances,
    configChangeSuggestions,
  }
}

const getTargetRecordIds = (
  type: ObjectType,
  records: SalesforceRecord[],
  allowedRefToTypeNames: string[],
): { targetTypeName: string; id: string }[] => {
  const referenceFieldsToTargets = Object.fromEntries(
    Object.values(type.fields)
      .filter(isReferenceField)
      .map(field => [
        field.name,
        getReferenceTo(field).filter(typeName => allowedRefToTypeNames.includes(typeName)),
      ])
  )
  return records.flatMap(record =>
    Object.entries(referenceFieldsToTargets)
      .filter(([fieldName]) => _.isString(record[fieldName]))
      .flatMap(([fieldName, targets]) => (
        targets.map(targetTypeName => ({ targetTypeName, id: record[fieldName] }))
      )))
}

const getReferencedRecords = async (
  client: SalesforceClient,
  customObjectFetchSetting: Record<TypeName, CustomObjectFetchSetting>,
  baseRecordByIdAndType: RecordsByTypeAndId,
): Promise<RecordsByTypeAndId> => {
  const allReferenceRecords = {} as RecordsByTypeAndId
  const allowedRefToTypeNames = Object.keys(_.pickBy(
    customObjectFetchSetting,
    setting => !setting.isBase
  ))
  const getMissingReferencedIds = (
    records: RecordsByTypeAndId
  ): Record<TypeName, RecordID[]> => {
    const missingReferencedRecordIds = Object.entries(records)
      .flatMap(([typeName, idToRecords]) => {
        const type = customObjectFetchSetting[typeName].objectType
        const sfRecords = Object.values(idToRecords)
        const targetRecordIds = getTargetRecordIds(type, sfRecords, allowedRefToTypeNames)
        return targetRecordIds
          // Filter out already fetched target records
          .filter(({ targetTypeName, id }) =>
            allReferenceRecords[targetTypeName]?.[id] === undefined)
      })
    const referencedRecordsById = _.groupBy(
      missingReferencedRecordIds,
      t => t.targetTypeName
    )
    return _.mapValues(
      referencedRecordsById,
      tuples => _.uniq(tuples.map(t => t.id))
    )
  }

  const getReferencedRecordsRecursively = async (
    currentLevelRecords: RecordsByTypeAndId
  ): Promise<void> => {
    const typeToMissingIds = getMissingReferencedIds(currentLevelRecords)
    const newReferencedRecords = await mapValuesAsync(
      typeToMissingIds,
      (ids, typeName) => getRecords(client, customObjectFetchSetting[typeName].objectType, ids)
    )
    if (_.isEmpty(newReferencedRecords)) {
      return
    }
    _.merge(allReferenceRecords, newReferencedRecords)
    await getReferencedRecordsRecursively(newReferencedRecords)
  }
  await getReferencedRecordsRecursively(baseRecordByIdAndType)
  return allReferenceRecords
}

export const getAllInstances = async (
  client: SalesforceClient,
  customObjectFetchSetting: Record<TypeName, CustomObjectFetchSetting>,
): Promise<{ instances: InstanceElement[]; configChangeSuggestions: ConfigChangeSuggestion[] }> => {
  const baseTypesSettings = _.pickBy(
    customObjectFetchSetting,
    setting => setting.isBase
  )
  const baseRecordByTypeAndId = await mapValuesAsync(
    baseTypesSettings,
    setting => getRecords(client, setting.objectType)
  )
  // Get reference to records
  const referencedRecordsByTypeAndId = await getReferencedRecords(
    client,
    customObjectFetchSetting,
    baseRecordByTypeAndId
  )
  const mergedRecords = {
    ...referencedRecordsByTypeAndId,
    ...baseRecordByTypeAndId,
  }
  return typesRecordsToInstances(mergedRecords, customObjectFetchSetting)
}

const getParentFieldNames = (fields: Field[]): string[] =>
  fields
    .filter(isMasterDetailField)
    .map(field => field.name)

export const getIdFields = async (
  type: ObjectType,
  dataManagement: DataManagement
): Promise<{ idFields: Field[]; invalidFields?: string[] }> => {
  const idFieldsNames = dataManagement.getObjectIdsFields(await apiName(type))
  const idFieldsWithParents = idFieldsNames.flatMap(fieldName =>
    ((fieldName === detectsParentsIndicator)
      ? getParentFieldNames(Object.values(type.fields)) : fieldName))
  const invalidIdFieldNames = idFieldsWithParents.filter(fieldName => (
    type.fields[fieldName] === undefined || !isQueryableField(type.fields[fieldName])
  ))
  if (invalidIdFieldNames.length > 0) {
    return { idFields: [], invalidFields: invalidIdFieldNames }
  }
  return { idFields: idFieldsWithParents.map(fieldName => type.fields[fieldName]) }
}

export const getCustomObjectsFetchSettings = async (
  types: ObjectType[],
  dataManagement: DataManagement,
): Promise<CustomObjectFetchSetting[]> => {
  const typeToFetchSettings = async (type: ObjectType): Promise<CustomObjectFetchSetting> => {
    const fields = await getIdFields(type, dataManagement)
    return {
      objectType: type,
      isBase: dataManagement.isObjectMatch(await apiName(type)),
      idFields: fields.idFields,
      invalidIdFields: fields.invalidFields,
    }
  }

  return awu(types)
    .filter(async type => dataManagement.isObjectMatch(await apiName(type))
      || dataManagement.isReferenceAllowed(await apiName(type)))
    .map(typeToFetchSettings)
    .toArray()
}

const filterTypesWithManyInstances = async (
  { validChangesFetchSettings, maxInstancesPerType, client }
: {
  validChangesFetchSettings: Record<string, CustomObjectFetchSetting>
  maxInstancesPerType: number
  client: SalesforceClient
}
): Promise<{
  filteredChangesFetchSettings: Record<string, CustomObjectFetchSetting>
  heavyTypesSuggestions: ConfigChangeSuggestion[]
}> => {
  if (maxInstancesPerType === UNLIMITED_INSTANCES_VALUE) {
    return { filteredChangesFetchSettings: validChangesFetchSettings, heavyTypesSuggestions: [] }
  }
  const typesToFilter: string[] = []
  const heavyTypesSuggestions: ConfigChangeSuggestion[] = []

  // Creates a lists of typeNames and changeSuggestions for types with too many instances
  await awu(Object.keys(validChangesFetchSettings))
    .forEach(async typeName => {
      const instancesCount = await client.countInstances(typeName)
      if (instancesCount > maxInstancesPerType) {
        typesToFilter.push(typeName)
        heavyTypesSuggestions.push(
          createManyInstancesExcludeConfigChange({ typeName, instancesCount, maxInstancesPerType })
        )
      }
    })

  return {
    filteredChangesFetchSettings: _.omit(validChangesFetchSettings, typesToFilter),
    heavyTypesSuggestions,
  }
}

const filterCreator: RemoteFilterCreator = ({ client, config }) => ({
  onFetch: async (elements: Element[]): Promise<FilterResult> => {
    const { dataManagement } = config.fetchProfile
    if (dataManagement === undefined) {
      return {}
    }
    const customObjects = await awu(elements).filter(isCustomObject).toArray() as ObjectType[]
    const customObjectFetchSetting = await getCustomObjectsFetchSettings(
      customObjects,
      dataManagement
    )
    const [validFetchSettings, invalidFetchSettings] = _.partition(
      customObjectFetchSetting,
      setting => setting.invalidIdFields === undefined
    )
    const validChangesFetchSettings = await keyByAsync(
      validFetchSettings,
      setting => apiName(setting.objectType),
    )

    const {
      filteredChangesFetchSettings,
      heavyTypesSuggestions,
    } = await filterTypesWithManyInstances({
      validChangesFetchSettings,
      maxInstancesPerType: config.fetchProfile.maxInstancesPerType,
      client,
    })

    const { instances, configChangeSuggestions } = await getAllInstances(
      client,
      filteredChangesFetchSettings,
    )
    instances.forEach(instance => elements.push(instance))
    log.debug(`Fetched ${instances.length} instances of Custom Objects`)
    const invalidFieldSuggestions = await awu(invalidFetchSettings)
      .map(async setting =>
        createInvlidIdFieldConfigChange(
          await apiName(setting.objectType),
          makeArray(setting.invalidIdFields),
        ))
      .toArray()
    return {
      configSuggestions: [
        ...invalidFieldSuggestions,
        ...heavyTypesSuggestions,
        ...configChangeSuggestions,
      ],
    }
  },
})

export default filterCreator
