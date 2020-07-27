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
import SalesforceClient from '../client/client'
import { SalesforceRecord } from '../client/types'
import { SALESFORCE, RECORDS_PATH, INSTALLED_PACKAGES_PATH, CUSTOM_OBJECT_ID_FIELD, OBJECTS_PATH, FIELD_ANNOTATIONS } from '../constants'
import { FilterCreator } from '../filter'
import { apiName, isCustomObject, Types, createInstanceServiceIds } from '../transformers/transformer'
import { getNamespace } from './utils'
import { DataManagementConfig } from '../types'

const { mapValuesAsync } = promises.object
const { isDefined } = values
const { makeArray } = collections.array
const { toArrayAsync } = collections.asynciterable

const log = logger(module)

type TypeName = string
type RecordID = string

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

const isReferenceToField = (field: Field): boolean =>
  (isPrimitiveType(field.type)
  && (Types.primitiveDataTypes.MasterDetail.isEqual(field.type)
  || Types.primitiveDataTypes.Lookup.isEqual(field.type)))

const buildQueryString = (type: ObjectType, ids?: string[]): string => {
  const selectStr = Object.values(type.fields)
    .map(field => {
      if (isNameField(field)) {
        return Object.keys((field.type as ObjectType).fields).join(',')
      }
      return apiName(field, true)
    }).join(',')
  const whereStr = (ids === undefined || _.isEmpty(ids)) ? '' : ` WHERE Id IN (${ids.map(id => `'${id}'`).join(',')})`
  return `SELECT ${selectStr} FROM ${apiName(type)}${whereStr}`
}

const getTypeRecords = async (
  client: SalesforceClient,
  type: ObjectType,
  ids?: string[],
): Promise<Record<RecordID, SalesforceRecord>> => {
  const queryString = buildQueryString(type, ids)
  const recordsIterable = await client.queryAll(queryString)
  return _.keyBy(
    (await toArrayAsync(recordsIterable)).flat(),
    record => record[CUSTOM_OBJECT_ID_FIELD]
  )
}

const typesRecordsToInstances = (
  recordByIdAndType: Record<TypeName, Record<RecordID, SalesforceRecord>>,
  typeByName: Record<TypeName, ObjectType>,
  nameBasedTypes: ObjectType[],
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
      // If it's a special case of using a non-ref field simply use the value
      if (!isReferenceToField(field)) {
        return fieldValue.toString()
      }
      const referenceToTypeNames = field.annotations[FIELD_ANNOTATIONS.REFERENCE_TO] as string[]
      return referenceToTypeNames.map(typeName => {
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
          nameBasedTypes.some(o => o.isEqual(typeByName[typeName])),
        )
      ))
    ))
}


const getFieldsToRefToTypes = (
  type: ObjectType,
  allowedRefToTypeNames: string[]
): Record<string, TypeName[]> => {
  const referenceFields = _.pickBy(type.fields, isReferenceToField)
  return _.mapValues(
    referenceFields,
    field => (field.annotations[FIELD_ANNOTATIONS.REFERENCE_TO] as string[])
      .filter(refToTypeName => allowedRefToTypeNames.includes(refToTypeName))
  )
}

const getRefToRecords = async (
  client: SalesforceClient,
  referenceToTypes: ObjectType[],
  baseRecordByIdAndType: Record<TypeName, Record<RecordID, SalesforceRecord>>,
  allTypesByName: Record<TypeName, ObjectType>
): Promise<Record<TypeName, Record<RecordID, SalesforceRecord>>> => {
  const refToRecsByIdAndType = {} as Record<TypeName, Record<RecordID, SalesforceRecord>>
  const doesRecordAlreadyExist = (typeName: string, id: string): boolean =>
    refToRecsByIdAndType[typeName] !== undefined && refToRecsByIdAndType[typeName][id] !== undefined
  const addNewRecords = (
    newRecords: Record<TypeName, Record<RecordID, SalesforceRecord>>
  ): Record<TypeName, Record<RecordID, SalesforceRecord>> =>
    _.merge(refToRecsByIdAndType, newRecords)

  const allowedRefToTypeNames = referenceToTypes.map(type => apiName(type))
  const referenceTypeToIdsFromRecords = (
    records: Record<TypeName, Record<RecordID, SalesforceRecord>>
  ): Record<TypeName, RecordID[]> => {
    const typeAndIdsTuples = Object.entries(records).flatMap(([typeName, idToRecords]) => {
      const type = allTypesByName[typeName]
      const fieldNameToRefToNames = getFieldsToRefToTypes(type, allowedRefToTypeNames)
      const sfRecords = Object.values(idToRecords)
      return sfRecords.flatMap(record =>
        (Object.entries(fieldNameToRefToNames).flatMap(([fieldName, refToNames]) => {
          const fieldValue = record[fieldName]
          return (fieldValue === undefined || _.isNull(fieldValue)) ? undefined
            : refToNames.map(name => ({ type: name, id: fieldValue }))
        }))).filter(isDefined)
    })
    const typeToTypeAndIds = _.groupBy(
      typeAndIdsTuples,
      t => t.type
    )
    return _.mapValues(
      typeToTypeAndIds,
      (tuples, type) => _.uniq(
        tuples.map(t => t.id).filter(id => !doesRecordAlreadyExist(type, id))
      )
    )
  }

  const getRefToRecordsRecursively = async (
    currentLevelRecords: Record<TypeName, Record<RecordID, SalesforceRecord>>
  ): Promise<void> => {
    const typeToRecordIds = referenceTypeToIdsFromRecords(currentLevelRecords)
    const refToRecords = await mapValuesAsync(
      typeToRecordIds,
      (ids, typeName) => getTypeRecords(client, allTypesByName[typeName], ids)
    )
    if (_.isEmpty(refToRecords)) {
      return
    }
    addNewRecords(refToRecords)
    getRefToRecordsRecursively(refToRecords)
  }
  await getRefToRecordsRecursively(baseRecordByIdAndType)
  return refToRecsByIdAndType
}

const getAllInstances = async (
  client: SalesforceClient,
  baseTypes: ObjectType[],
  referenceToTypes: ObjectType[],
  nameBasedTypes: ObjectType[],
): Promise<InstanceElement[]> => {
  // Get the base types records
  const baseTypesByName = _.keyBy(baseTypes, type => apiName(type))
  const baseRecordByIdAndType = await mapValuesAsync(
    baseTypesByName,
    type => getTypeRecords(client, type)
  )

  // Get reference to records
  const refToTypesByName = _.keyBy(referenceToTypes, type => apiName(type))
  const mergedTypesByName = _.merge(baseTypesByName, refToTypesByName)
  const refToRecordsByIdAndType = await getRefToRecords(
    client,
    referenceToTypes,
    baseRecordByIdAndType,
    mergedTypesByName
  )
  const mergedRecords = _.merge(baseRecordByIdAndType, refToRecordsByIdAndType)
  return typesRecordsToInstances(mergedRecords, mergedTypesByName, nameBasedTypes)
}

const filterObjectTypes = (
  elements: Element[],
  dataManagementConfigs: DataManagementConfig[]
): ObjectType[] => {
  const enabledConfigs = dataManagementConfigs
    .filter(config => config.enabled)
  const groupedIncludeNamespaces = _.flatten(
    enabledConfigs.map(config => makeArray(config.includeNamespaces))
  )
  const groupedIncludeObjects = _.flatten(
    enabledConfigs
      .map(config => makeArray(config.includeObjects))
  )
  const groupedExcludeObjects = _.flatten(
    enabledConfigs
      .map(config => makeArray(config.excludeObjects))
  )
  return elements
    .filter(isObjectType)
    .filter(isCustomObject)
    .filter(e => {
      const namespace = getNamespace(e)
      const elementApiName = apiName(e, true)
      return (
        (!_.isUndefined(namespace) && groupedIncludeNamespaces.includes(namespace))
          || groupedIncludeObjects.includes(elementApiName)
      ) && !groupedExcludeObjects.includes(elementApiName)
    })
}

const getReferenceToObjectTypes = (
  elements: Element[],
  baseObjectTypes: ObjectType[],
  dataManagementConfigs: DataManagementConfig[]
): ObjectType[] => {
  const referenceToTypeNames = dataManagementConfigs
    .flatMap(conf => conf.allowReferenceTo).filter(isDefined)
  return elements
    .filter(isObjectType)
    .filter(isCustomObject)
    .filter(e =>
      referenceToTypeNames.includes(apiName(e, true))
      && !baseObjectTypes.find(obj => obj.isEqual(e)))
}

const filterCreator: FilterCreator = ({ client, config }) => ({
  onFetch: async (elements: Element[]) => {
    const dataManagementConfigs = config.dataManagement || []
    const relevantObjectTypes = filterObjectTypes(
      elements,
      dataManagementConfigs
    )
    if (relevantObjectTypes.length === 0) {
      return
    }
    const referenceToObjectTypes = getReferenceToObjectTypes(
      elements,
      relevantObjectTypes,
      dataManagementConfigs
    )
    const nameBasedIDConfigs = dataManagementConfigs.filter(dmConfig => dmConfig.isNameBasedID)
    const nameBasedTypes = filterObjectTypes(relevantObjectTypes, nameBasedIDConfigs).concat(
      getReferenceToObjectTypes(referenceToObjectTypes, relevantObjectTypes, nameBasedIDConfigs)
    )
    const instances = await getAllInstances(
      client,
      relevantObjectTypes,
      referenceToObjectTypes,
      nameBasedTypes
    )
    elements.push(...instances)
  },
})

export default filterCreator
