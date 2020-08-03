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
import { InstanceElement, ObjectType, Element, isObjectType, Field, isPrimitiveType, isReferenceExpression } from '@salto-io/adapter-api'
import SalesforceClient from '../client/client'
import { SalesforceRecord } from '../client/types'
import {
  SALESFORCE, RECORDS_PATH, INSTALLED_PACKAGES_PATH, CUSTOM_OBJECT_ID_FIELD,
  OBJECTS_PATH, FIELD_ANNOTATIONS, MAX_IDS_PER_INSTANCES_QUERY,
} from '../constants'
import { FilterCreator } from '../filter'
import { apiName, isCustomObject, Types, createInstanceServiceIds } from '../transformers/transformer'
import { getNamespace, getNamespaceFromString } from './utils'
import { DataManagementConfig } from '../types'

const { mapValuesAsync } = promises.object
const { isDefined } = values
const { makeArray } = collections.array
const { toArrayAsync } = collections.asynciterable

const log = logger(module)

type TypeName = string
type RecordID = string
type RecordById = Record<RecordID, SalesforceRecord>
type RecordsByTypeAndId = Record<TypeName, RecordById>

const masterDetailNamesSeparator = '___'

// This will be exctracted to a config once we have more knowledge
// on naming "patterns"
const typeToAdditionalNameFields: Record<TypeName, string[]> = {
  PricebookEntry: ['Pricebook2Id'],
  // eslint-disable-next-line @typescript-eslint/camelcase
  SBQQ__CustomAction__c: ['SBQQ__Location__c', 'SBQQ__DisplayOrder__c'],
}

const isNameField = (field: Field): boolean =>
  (isObjectType(field.type)
    && field.type.elemID.isEqual(Types.compoundDataTypes.Name.elemID))

const isReferenceField = (field: Field): boolean =>
  (isPrimitiveType(field.type)
  && (Types.primitiveDataTypes.MasterDetail.isEqual(field.type)
  || Types.primitiveDataTypes.Lookup.isEqual(field.type)))

const getReferenceToTypeNames = (field: Field): string[] =>
  makeArray(field.annotations[FIELD_ANNOTATIONS.REFERENCE_TO])
    .map(ref => (
      isReferenceExpression(ref)
        ? ref.elemId.typeName
        : ref
    ))

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
  typeByName: Record<TypeName, ObjectType>,
  nameBasedTypeNames: string[],
): InstanceElement[] => {
  const saltoNameByIdAndType = {} as Record<TypeName, Record<RecordID, string>>
  const setSaltoName = (type: ObjectType, recordId: string, saltoName: string): void => {
    if (saltoNameByIdAndType[apiName(type)] === undefined) {
      saltoNameByIdAndType[apiName(type)] = {}
    }
    saltoNameByIdAndType[apiName(type)][recordId] = saltoName
  }
  const getSaltoName = (type: ObjectType, recordId: string): string | undefined =>
    saltoNameByIdAndType[apiName(type)]?.[recordId]

  const isPrefixField = (type: ObjectType, field: Field): boolean =>
    (isPrimitiveType(field.type)
      && Types.primitiveDataTypes.MasterDetail.isEqual(field.type))
      || (typeToAdditionalNameFields[apiName(type)]?.includes(field.name))

  const getRecordSaltoName = (
    record: SalesforceRecord,
    type: ObjectType,
  ): string => {
    const fieldToPrefixName = (fieldName: string, field: Field): string | undefined => {
      const fieldValue = record[fieldName]
      if (!isReferenceField(field)) {
        return fieldValue.toString()
      }
      const referencedTypeNames = getReferenceToTypeNames(field)
      return referencedTypeNames.map(typeName => {
        const rec = recordByIdAndType[typeName] !== undefined
          ? recordByIdAndType[typeName][fieldValue] : undefined
        if (rec === undefined) {
          log.warn(`failed to find record with id ${fieldValue} of type ${typeName} when looking for parent`)
          return undefined
        }
        return getRecordSaltoName(rec, typeByName[typeName])
      }).find(isDefined)
    }

    const saltoName = getSaltoName(type, record[CUSTOM_OBJECT_ID_FIELD])
    if (saltoName !== undefined) {
      return saltoName
    }

    const prefixFields = _.pickBy(type.fields, (field => isPrefixField(type, field)))
    const prefixNames = Object.entries(prefixFields)
      .map(([fieldName, field]) => fieldToPrefixName(fieldName, field)).filter(isDefined)

    const fullName = [...prefixNames, record.Name].join(masterDetailNamesSeparator)
    setSaltoName(type, record[CUSTOM_OBJECT_ID_FIELD], fullName)
    return fullName
  }

  const recordToInstance = (
    record: SalesforceRecord,
    type: ObjectType,
    isNameBased: boolean,
  ): InstanceElement => {
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
    const suggestedIDName = isNameBased
      ? getRecordSaltoName(record, type)
      : record[CUSTOM_OBJECT_ID_FIELD]
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
          record,
          typeByName[typeName],
          nameBasedTypeNames.includes(typeName),
        )
      ))
    ))
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
        getReferenceToTypeNames(field).filter(typeName => allowedRefToTypeNames.includes(typeName)),
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
  referencedTypes: ObjectType[],
  baseRecordByIdAndType: RecordsByTypeAndId,
  allTypesByName: Record<TypeName, ObjectType>
): Promise<RecordsByTypeAndId> => {
  const allReferenceRecords = {} as RecordsByTypeAndId
  const allowedRefToTypeNames = referencedTypes.map(type => apiName(type))
  const getMissingReferencedIds = (
    records: RecordsByTypeAndId
  ): Record<TypeName, RecordID[]> => {
    const missingReferencedRecordIds = Object.entries(records)
      .flatMap(([typeName, idToRecords]) => {
        const type = allTypesByName[typeName]
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
      (ids, typeName) => getRecords(client, allTypesByName[typeName], ids)
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
  baseTypes: ObjectType[],
  referencedTypes: ObjectType[],
  nameBasedTypeNames: string[],
): Promise<InstanceElement[]> => {
  // Get the base types records
  const baseTypesByName = _.keyBy(baseTypes, type => apiName(type))
  const baseRecordByTypeAndId = await mapValuesAsync(
    baseTypesByName,
    type => getRecords(client, type)
  )

  // Get reference to records
  const referencedTypesByName = _.keyBy(referencedTypes, type => apiName(type))
  const mergedTypesByName = _.merge(baseTypesByName, referencedTypesByName)
  const referencedRecordsByTypeAndId = await getReferencedRecords(
    client,
    referencedTypes,
    baseRecordByTypeAndId,
    mergedTypesByName
  )
  const mergedRecords = _.merge(baseRecordByTypeAndId, referencedRecordsByTypeAndId)
  return typesRecordsToInstances(mergedRecords, mergedTypesByName, nameBasedTypeNames)
}

const getBaseTypesNames = (
  customObjectNames: string[],
  configs: DataManagementConfig[]
): string[] => {
  const groupedIncludeNamespaces = configs.flatMap(config => makeArray(config.includeNamespaces))
  const groupedIncludeObjects = configs.flatMap(config => makeArray(config.includeObjects))
  const groupedExcludeObjects = configs.flatMap(config => makeArray(config.excludeObjects))
  return customObjectNames.filter(customObjectName => {
    const namespace = getNamespaceFromString(customObjectName)
    return ((namespace !== undefined && groupedIncludeNamespaces.includes(namespace))
      || groupedIncludeObjects.includes(customObjectName))
      && !groupedExcludeObjects.includes(customObjectName)
  })
}

const getAllowReferencedTypesNames = (
  customObjectNames: string[],
  configs: DataManagementConfig[]
): string[] => {
  const allowReferebcedTypeNames = configs
    .flatMap(config => makeArray(config.allowReferenceTo)).filter(isDefined)
  const baseObjectNames = getBaseTypesNames(customObjectNames, configs)
  return customObjectNames.filter(customObjectName =>
    allowReferebcedTypeNames.includes(customObjectName)
    && !baseObjectNames.includes(customObjectName))
}

const getNameBasedObjectNames = (
  customObjectNames: string[],
  configs: DataManagementConfig[]
): string[] => {
  const nameBasedConfigs = configs.filter(config => config.isNameBasedID)
  return [
    ...getBaseTypesNames(customObjectNames, nameBasedConfigs),
    ...getAllowReferencedTypesNames(customObjectNames, nameBasedConfigs),
  ]
}

const filterCreator: FilterCreator = ({ client, config }) => ({
  onFetch: async (elements: Element[]) => {
    const customObjects = elements.filter(isObjectType).filter(isCustomObject)
    const customObjectNames = customObjects.map(customObject => apiName(customObject))
    const dataManagementConfigs = config.dataManagement || []
    const enabledConfigs = dataManagementConfigs
      .filter(dataManagementConfig => dataManagementConfig.enabled)
    const baseTypesNames = getBaseTypesNames(customObjectNames, enabledConfigs)
    if (baseTypesNames.length === 0) {
      return
    }
    const allowReferencedTypesNames = getAllowReferencedTypesNames(
      customObjectNames,
      enabledConfigs
    )
    const nameBasedTypesNames = getNameBasedObjectNames(customObjectNames, enabledConfigs)
    const instances = await getAllInstances(
      client,
      customObjects.filter(co => baseTypesNames.includes(apiName(co))),
      customObjects.filter(co => allowReferencedTypesNames.includes(apiName(co))),
      nameBasedTypesNames,
    )
    elements.push(...instances)
  },
})

export default filterCreator
