/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { InstanceElement, ObjectType, Element, isObjectType, Field } from '@salto-io/adapter-api'
import { pathSaltoCase } from '@salto-io/adapter-utils'
import { createInvlidIdFieldConfigChange, createUnresolvedRefIdFieldConfigChange } from '../config_change'
import SalesforceClient from '../client/client'
import { SalesforceRecord } from '../client/types'
import {
  SALESFORCE, RECORDS_PATH, INSTALLED_PACKAGES_PATH, CUSTOM_OBJECT_ID_FIELD,
  OBJECTS_PATH, FIELD_ANNOTATIONS, MAX_IDS_PER_INSTANCES_QUERY,
} from '../constants'
import { FilterCreator } from '../filter'
import { apiName, isCustomObject, Types, createInstanceServiceIds } from '../transformers/transformer'
import { getNamespace, isMasterDetailField, isLookupField } from './utils'
import { DataManagementConfig, ConfigChangeSuggestion } from '../types'

const { mapValuesAsync } = promises.object
const { isDefined } = values
const { makeArray } = collections.array
const { toArrayAsync } = collections.asynciterable

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

const isNameField = (field: Field): boolean =>
  (isObjectType(field.type)
    && field.type.elemID.isEqual(Types.compoundDataTypes.Name.elemID))

const isReferenceField = (field: Field): boolean => (
  isMasterDetailField(field) || isLookupField(field)
)

const getReferenceTo = (field: Field): string[] =>
  makeArray(field.annotations[FIELD_ANNOTATIONS.REFERENCE_TO]) as string[]

const getQueryableFields = (object: ObjectType): Field[] => (
  Object.values(object.fields)
    // the "queryable" annotation defaults to true when missing
    .filter(field => field.annotations[FIELD_ANNOTATIONS.QUERYABLE] !== false)
)

export const buildSelectStr = (fields: Field[]): string => (
  fields
    .map(field => {
      if (isNameField(field)) {
        return Object.keys((field.type as ObjectType).fields).join(',')
      }
      return apiName(field, true)
    }).join(','))

const buildQueryString = (typeName: string, fields: Field[], ids?: string[]): string => {
  const selectStr = buildSelectStr(fields)
  const whereStr = (ids === undefined || _.isEmpty(ids)) ? '' : ` WHERE Id IN (${ids.map(id => `'${id}'`).join(',')})`
  return `SELECT ${selectStr} FROM ${typeName}${whereStr}`
}

const buildQueryStrings = (typeName: string, fields: Field[], ids?: string[]): string[] => {
  if (ids === undefined) {
    return [buildQueryString(typeName, fields)]
  }
  const chunkedIds = _.chunk(ids, MAX_IDS_PER_INSTANCES_QUERY)
  return chunkedIds.map(idChunk => buildQueryString(typeName, fields, idChunk))
}

const getRecords = async (
  client: SalesforceClient,
  type: ObjectType,
  ids?: string[],
): Promise<RecordById> => {
  const queryableFields = getQueryableFields(type)
  const typeName = apiName(type)
  if (_.isEmpty(queryableFields)) {
    log.debug(`Type ${typeName} had no queryable fields`)
    return {}
  }
  const queries = buildQueryStrings(typeName, queryableFields, ids)
  const recordsIterables = await Promise.all(queries.map(async query => client.queryAll(query)))
  const records = (await Promise.all(
    recordsIterables.map(async recordsIterable => (await toArrayAsync(recordsIterable)).flat())
  )).flat()
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

const transformCompoundNameValues = (
  type: ObjectType,
  recordValue: SalesforceRecord
): SalesforceRecord => {
  const nameSubFields = Object.keys(Types.compoundDataTypes.Name.fields)
  // We assume there's only one Name field
  const nameFieldName = Object.keys(_.pickBy(type.fields, isNameField))[0]
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

export const transformRecordToValues = (
  type: ObjectType,
  recordValue: SalesforceRecord
): SalesforceRecord => {
  const valuesWithTransformedName = transformCompoundNameValues(type, recordValue)
  return omitDefaultKeys(valuesWithTransformedName)
}

const recordToInstance = (
  { type, record, instanceSaltoName }: recordToInstanceParams
): InstanceElement => {
  const getInstancePath = (instanceName: string): string[] => {
    const typeNamespace = getNamespace(type)
    const instanceFileName = pathSaltoCase(instanceName)
    if (typeNamespace) {
      return [SALESFORCE, INSTALLED_PACKAGES_PATH, typeNamespace, OBJECTS_PATH,
        type.elemID.typeName, RECORDS_PATH, instanceFileName]
    }
    return [SALESFORCE, OBJECTS_PATH, type.elemID.typeName, RECORDS_PATH, instanceFileName]
  }
  const { name } = Types.getElemId(
    instanceSaltoName,
    true,
    createInstanceServiceIds(_.pick(record, CUSTOM_OBJECT_ID_FIELD), type),
  )
  return new InstanceElement(
    name,
    type,
    transformRecordToValues(type, record),
    getInstancePath(name),
  )
}

const typesRecordsToInstances = (
  recordByIdAndType: RecordsByTypeAndId,
  customObjectFetchSetting: Record<TypeName, CustomObjectFetchSetting>,
): { instances: InstanceElement[]; configChangeSuggestions: ConfigChangeSuggestion[] } => {
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

  const getRecordSaltoName = (
    typeName: string,
    record: SalesforceRecord,
  ): string => {
    const fieldToSaltoName = (field: Field): string | undefined => {
      const fieldValue = record[field.name]
      if (fieldValue === null || fieldValue === undefined) {
        return undefined
      }
      if (!isReferenceField(field)) {
        return fieldValue.toString()
      }
      const referencedTypeNames = getReferenceTo(field)
      const referencedName = referencedTypeNames.map(referencedTypeName => {
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
    const saltoIdsValues = saltoIdFields.map(field => fieldToSaltoName(field)).filter(isDefined)
    const fullName = saltoIdsValues.join(nameSeparator)
    setSaltoName(typeName, record[CUSTOM_OBJECT_ID_FIELD], fullName)
    return fullName
  }

  const instances = Object.entries(recordByIdAndType).flatMap(([typeName, idToRecord]) =>
    (Object.values(idToRecord)
      .map(record => ({
        type: customObjectFetchSetting[typeName].objectType,
        record,
        instanceSaltoName: getRecordSaltoName(typeName, record),
      }))
      .filter(recToInstanceParams =>
        !Object.keys(typesToUnresolvedRefFields).includes(apiName(recToInstanceParams.type)))
      .map(recordToInstance)))
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
    getReferencedRecordsRecursively(newReferencedRecords)
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

export const getIdFields = (
  type: ObjectType,
  config: DataManagementConfig
): { idFields: Field[]; invalidFields?: string[] } => {
  const typeOverride = makeArray(config.saltoIDSettings?.overrides)
    .find(objectIdSetting => new RegExp(objectIdSetting.objectsRegex).test(apiName(type)))
  const idFieldsNames = typeOverride === undefined
    ? config.saltoIDSettings?.defaultIdFields : typeOverride.idFields
  const idFieldsWithParents = idFieldsNames.flatMap(fieldName =>
    ((fieldName === detectsParentsIndicator)
      ? getParentFieldNames(Object.values(type.fields)) : fieldName))
  const invalidIdFieldNames = idFieldsWithParents
    .filter(fieldName => type.fields[fieldName] === undefined
        || type.fields[fieldName].annotations[FIELD_ANNOTATIONS.QUERYABLE] === false)
  if (invalidIdFieldNames.length > 0) {
    return { idFields: [], invalidFields: invalidIdFieldNames }
  }
  return { idFields: idFieldsWithParents.map(fieldName => type.fields[fieldName]) }
}

export const getCustomObjectsFetchSettings = (
  types: ObjectType[],
  config: DataManagementConfig,
): CustomObjectFetchSetting[] => {
  const allowReferencesToRegexes = makeArray(config.allowReferenceTo).map(e => new RegExp(e))
  const includeObjectsRegexes = makeArray(config.includeObjects).map(e => new RegExp(e))
  const excludeObjectsRegexes = makeArray(config.excludeObjects).map(e => new RegExp(e))
  const isBaseType = (type: ObjectType): boolean =>
    (includeObjectsRegexes.some(objRegex => objRegex.test(apiName(type)))
      && !excludeObjectsRegexes.some(objRejex => objRejex.test(apiName(type))))
  const isReferencedType = (type: ObjectType): boolean =>
    allowReferencesToRegexes.some(objRegex => objRegex.test(apiName(type)))
  const relevantTypes = types
    .filter(customObject => isBaseType(customObject) || isReferencedType(customObject))
  const typeToFetchSettings = (type: ObjectType): CustomObjectFetchSetting => {
    const fields = getIdFields(type, config)
    return {
      objectType: type,
      isBase: isBaseType(type),
      idFields: fields.idFields,
      invalidIdFields: fields.invalidFields,
    }
  }
  return relevantTypes.map(typeToFetchSettings)
}

const filterCreator: FilterCreator = ({ client, config }) => ({
  onFetch: async (elements: Element[]): Promise<ConfigChangeSuggestion[]> => {
    if (config.dataManagement === undefined) {
      return []
    }
    const customObjects = elements.filter(isCustomObject)
    const customObjectFetchSetting = getCustomObjectsFetchSettings(
      customObjects,
      config.dataManagement
    )
    const [validFetchSettings, invalidFetchSettings] = _.partition(
      customObjectFetchSetting,
      setting => setting.invalidIdFields === undefined
    )
    const validChangesFetchSettings = _.keyBy(
      validFetchSettings,
      setting => apiName(setting.objectType),
    )
    const { instances, configChangeSuggestions } = await getAllInstances(
      client,
      validChangesFetchSettings,
    )
    elements.push(...instances)
    const invalidFieldSuggestions = invalidFetchSettings
      .map(setting =>
        createInvlidIdFieldConfigChange(
          apiName(setting.objectType),
          makeArray(setting.invalidIdFields),
        ))
    return [...invalidFieldSuggestions, ...configChangeSuggestions]
  },
})

export default filterCreator
