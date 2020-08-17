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
import { InstanceElement, ObjectType, Element, isObjectType, Field, isPrimitiveType } from '@salto-io/adapter-api'
import { createInvlidIdFieldConfigChange, createEmptyRefIdFieldConfigChange } from '../config_change'
import SalesforceClient from '../client/client'
import { SalesforceRecord } from '../client/types'
import {
  SALESFORCE, RECORDS_PATH, INSTALLED_PACKAGES_PATH, CUSTOM_OBJECT_ID_FIELD,
  OBJECTS_PATH, FIELD_ANNOTATIONS, MAX_IDS_PER_INSTANCES_QUERY,
} from '../constants'
import { FilterCreator } from '../filter'
import { apiName, isCustomObject, Types, createInstanceServiceIds } from '../transformers/transformer'
import { getNamespace } from './utils'
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

type CustomObjectFetchSetting = {
  objectType: ObjectType
  isBase: boolean
  idFields: Field[]
  invalidIdFields?: string[]
}

const nameSeparator = '___'
const detectsParentsIndicator = '##autoDetectedParentFields##'

const isNameField = (field: Field): boolean =>
  (isObjectType(field.type)
    && field.type.elemID.isEqual(Types.compoundDataTypes.Name.elemID))

const isReferenceField = (field: Field): boolean =>
  (isPrimitiveType(field.type)
    && (Types.primitiveDataTypes.MasterDetail.isEqual(field.type)
      || Types.primitiveDataTypes.Lookup.isEqual(field.type)))

const getReferenceTo = (field: Field): string[] =>
  makeArray(field.annotations[FIELD_ANNOTATIONS.REFERENCE_TO]) as string[]

const buildQueryString = (type: ObjectType, ids?: string[]): string => {
  const selectStr = Object.values(type.fields)
    // the "queryable" annotation defaults to true when missing
    .filter(field => field.annotations[FIELD_ANNOTATIONS.QUERYABLE] !== false)
    .map(field => {
      if (isNameField(field)) {
        return Object.keys((field.type as ObjectType).fields).join(',')
      }
      return apiName(field, true)
    }).join(',')
  const whereStr = (ids === undefined || _.isEmpty(ids)) ? '' : ` WHERE Id IN (${ids.map(id => `'${id}'`).join(',')})`
  return `SELECT ${selectStr} FROM ${apiName(type)}${whereStr}`
}

const buildQueryStrings = (type: ObjectType, ids?: string[]): string[] => {
  if (ids === undefined) {
    return [buildQueryString(type)]
  }
  const chunkedIds = _.chunk(ids, MAX_IDS_PER_INSTANCES_QUERY)
  return chunkedIds.map(idChunk => buildQueryString(type, idChunk))
}

const getRecords = async (
  client: SalesforceClient,
  type: ObjectType,
  ids?: string[],
): Promise<RecordById> => {
  const queries = buildQueryStrings(type, ids)
  const recordsIterables = await Promise.all(queries.map(async query => client.queryAll(query)))
  const records = (await Promise.all(
    recordsIterables.map(async recordsIterable => (await toArrayAsync(recordsIterable)).flat())
  )).flat()
  return _.keyBy(
    records,
    record => record[CUSTOM_OBJECT_ID_FIELD]
  )
}

const typesRecordsToInstances = (
  recordByIdAndType: RecordsByTypeAndId,
  customObjectFetchSetting: Record<TypeName, CustomObjectFetchSetting>,
): InstanceElement[] => {
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
    const fieldToPrefixName = (field: Field): string | undefined => {
      const fieldValue = record[field.name]
      if (!isReferenceField(field)) {
        return fieldValue?.toString()
      }
      const referencedTypeNames = getReferenceTo(field)
      return referencedTypeNames.map(name => {
        const rec = recordByIdAndType[name] !== undefined
          ? recordByIdAndType[name][fieldValue] : undefined
        if (rec === undefined) {
          log.warn(`failed to find record with id ${fieldValue} of type ${name} when looking for parent`)
          return undefined
        }
        return getRecordSaltoName(name, rec)
      }).find(isDefined)
    }

    const saltoName = getSaltoName(typeName, record[CUSTOM_OBJECT_ID_FIELD])
    if (saltoName !== undefined) {
      return saltoName
    }
    const saltoIdFields = customObjectFetchSetting[typeName].idFields
    const saltoIdsValues = saltoIdFields.map(field => fieldToPrefixName(field)).filter(isDefined)
    const fullName = saltoIdsValues.join(nameSeparator)
    setSaltoName(typeName, record[CUSTOM_OBJECT_ID_FIELD], fullName)
    return fullName
  }

  const recordToInstance = (
    typeName: TypeName,
    record: SalesforceRecord,
  ): InstanceElement => {
    const type = customObjectFetchSetting[typeName].objectType
    const getInstancePath = (instanceName: string): string[] => {
      const typeNamespace = getNamespace(type)
      if (typeNamespace) {
        return [SALESFORCE, INSTALLED_PACKAGES_PATH, typeNamespace, OBJECTS_PATH,
          type.elemID.typeName, RECORDS_PATH, instanceName]
      }
      return [SALESFORCE, OBJECTS_PATH, type.elemID.typeName, RECORDS_PATH, instanceName]
    }
    // Name compound sub-fields are returned at top level -> move them to the nameField
    const transformCompoundNameValues = (recordValue: SalesforceRecord): SalesforceRecord => {
      const nameSubFields = Object.keys(Types.compoundDataTypes.Name.fields)
      // We assume there's only one Name field
      const nameFieldName = Object.keys(_.pickBy(type.fields, isNameField))[0]
      return _.isUndefined(nameFieldName)
        ? recordValue
        : {
          ..._.omit(recordValue, nameSubFields),
          [nameFieldName]: _.pick(recordValue, nameSubFields),
          [CUSTOM_OBJECT_ID_FIELD]: recordValue[CUSTOM_OBJECT_ID_FIELD],
        }
    }
    const suggestedIDName = getRecordSaltoName(typeName, record)
    const { name } = Types.getElemId(
      suggestedIDName,
      true,
      createInstanceServiceIds(_.pick(record, CUSTOM_OBJECT_ID_FIELD), type),
    )
    return new InstanceElement(
      name,
      type,
      transformCompoundNameValues(record),
      getInstancePath(name),
    )
  }

  return Object.entries(recordByIdAndType)
    .flatMap(([typeName, idsToRecords]) => (
      Object.values(idsToRecords).map(record => (
        recordToInstance(
          typeName,
          record,
        )
      ))
    ))
}

const getNameRefsValidity = (
  recordByIdAndType: RecordsByTypeAndId,
  customObjectFetchSetting: Record<TypeName, CustomObjectFetchSetting>,
): Record<TypeName, Record<RecordID, string[]>> => Object.fromEntries(
  Object.entries(recordByIdAndType).map(([typeName, idsToRecords]) => [
    typeName,
    _.mapValues(
      idsToRecords,
      record => {
        const { idFields } = customObjectFetchSetting[typeName]
        const refToIdFields = idFields.filter(isReferenceField)
        return refToIdFields.filter(field => {
          const val = record[field.name]
          const referencedTypeNames = getReferenceTo(field)
          const referencedRecords = referencedTypeNames
            .map(refToName => ((recordByIdAndType[refToName] !== undefined)
              ? recordByIdAndType[refToName][val] : undefined))
            .filter(isDefined)
          return referencedRecords.length === 0
        }).map(field => field.name)
      }
    ),
  ])
)

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

const getAllInstances = async (
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
  const mergedRecords = _.merge(baseRecordByTypeAndId, referencedRecordsByTypeAndId)
  const nameRefsValidity = getNameRefsValidity(mergedRecords, customObjectFetchSetting)
  const validTypesRecords = _.pickBy(
    mergedRecords,
    (_idToRecord, typeName) =>
      Object.values(nameRefsValidity[typeName])
        .every(invalidNameRefs => invalidNameRefs === undefined || _.isEmpty(invalidNameRefs))
  )
  const configSuggestions = Object.entries(nameRefsValidity).flatMap(
    ([typeName, idToInvalidFields]) => {
      const invalidIdsToFields = _.pickBy(
        idToInvalidFields,
        invalidFields => !_.isEmpty(invalidFields)
      )
      return Object.entries(invalidIdsToFields).map(([id, invalidFields]) =>
        createEmptyRefIdFieldConfigChange(typeName, id, invalidFields))
    }
  )
  return {
    instances: typesRecordsToInstances(validTypesRecords, customObjectFetchSetting),
    configChangeSuggestions: configSuggestions,
  }
}

const getParentFieldNames = (fields: Field[]): string[] =>
  fields
    .filter(field => isPrimitiveType(field.type)
      && Types.primitiveDataTypes.MasterDetail.isEqual(field.type))
    .map(field => field.name)

const getIdFields = (
  type: ObjectType,
  idFieldsNames: string[]
): { idFields: Field[]; invalidFields?: string[] } => {
  const typeFields = type.fields
  const idFieldsWithParents = idFieldsNames.flatMap(fieldName =>
    ((fieldName === detectsParentsIndicator)
      ? getParentFieldNames(Object.values(typeFields)) : fieldName))
  const invalidIdFieldNames = idFieldsWithParents
    .filter(fieldName => typeFields[fieldName] === undefined)
  if (invalidIdFieldNames.length > 0) {
    return { idFields: [], invalidFields: invalidIdFieldNames }
  }
  return { idFields: idFieldsWithParents.map(fieldName => typeFields[fieldName]) }
}


const getCustomObjectsFetchSettings = (
  types: ObjectType[],
  config: DataManagementConfig,
): Record<TypeName, CustomObjectFetchSetting> => {
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
  const idSettingsOverrides = makeArray(config.saltoIDSettings.overrides)
  const getIdSettings = (type: ObjectType): string[] => {
    const typeOverride = idSettingsOverrides
      .find(objectIdSetting => new RegExp(objectIdSetting.objectsRegex).test(apiName(type)))
    return typeOverride === undefined
      ? config.saltoIDSettings.defaultIdFields : typeOverride.idFields
  }

  const typeToFetchSettings = (type: ObjectType): CustomObjectFetchSetting => {
    const fields = getIdFields(type, getIdSettings(type))
    return ({
      objectType: type,
      isBase: isBaseType(type),
      idFields: fields.idFields,
      invalidIdFields: fields.invalidFields,
    })
  }
  return _.mapValues(
    _.keyBy(relevantTypes, type => apiName(type)),
    type => typeToFetchSettings(type)
  )
}

const filterCreator: FilterCreator = ({ client, config }) => ({
  onFetch: async (elements: Element[]): Promise<ConfigChangeSuggestion[]> => {
    if (config.dataManagement === undefined) {
      return []
    }
    const customObjects = elements.filter(isObjectType).filter(isCustomObject)
    const customObjectFetchSetting = getCustomObjectsFetchSettings(
      customObjects,
      config.dataManagement
    )
    const validChangesFetchSettings = _.pickBy(
      customObjectFetchSetting,
      setting => setting.invalidIdFields === undefined
    )
    const { instances, configChangeSuggestions } = await getAllInstances(
      client,
      validChangesFetchSettings,
    )
    elements.push(...instances)
    const suggestChangesFetchSettings = _.pickBy(
      customObjectFetchSetting,
      setting => setting.invalidIdFields !== undefined
    )
    const invalidFieldSuggestions = Object.entries(suggestChangesFetchSettings)
      .map(([typeName, fetchSettings]) =>
        createInvlidIdFieldConfigChange(typeName, makeArray(fetchSettings.invalidIdFields)))
    return [...invalidFieldSuggestions, ...configChangeSuggestions]
  },
})

export default filterCreator
