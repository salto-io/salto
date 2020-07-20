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

const buildQueryString = (type: ObjectType): string => {
  const selectStr = Object.values(type.fields)
    .map(field => {
      if (isNameField(field)) {
        return Object.keys((field.type as ObjectType).fields).join(',')
      }
      return apiName(field, true)
    }).join(',')
  return `SELECT ${selectStr} FROM ${apiName(type)}`
}

const getTypeRecords = async (
  client: SalesforceClient,
  type: ObjectType
): Promise<Record<RecordID, SalesforceRecord>> => {
  const queryString = buildQueryString(type)
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
      if (!(isPrimitiveType(field.type)
        && (Types.primitiveDataTypes.MasterDetail.isEqual(field.type)
        || Types.primitiveDataTypes.Lookup.isEqual(field.type)))) {
        return fieldValue.toString()
      }
      const referenceToTypeNames = field.annotations[FIELD_ANNOTATIONS.REFERENCE_TO] as string[]
      return referenceToTypeNames.map(typeName => {
        const typeRecords = recordByIdAndType[typeName]
        if (typeRecords === undefined) {
          log.warn(`failed to find object name ${typeName} when looking for master`)
          return undefined
        }
        const rec = typeRecords[fieldValue]
        if (rec === undefined) {
          log.warn(`failed to find record with id ${fieldValue} in ${typeRecords} when looking for master`)
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

const getObjectTypesInstances = async (
  client: SalesforceClient,
  types: ObjectType[],
  nameBasedObjects: ObjectType[],
): Promise<InstanceElement[]> => {
  const typeByName = _.keyBy(types, type => apiName(type))
  const recordByIdAndType = await mapValuesAsync(
    typeByName,
    type => getTypeRecords(client, type)
  )
  return typesRecordsToInstances(recordByIdAndType, typeByName, nameBasedObjects)
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
    const nameBasedIDConfigs = dataManagementConfigs.filter(dmConfig => dmConfig.isNameBasedID)
    const nameBasedTypes = filterObjectTypes(relevantObjectTypes, nameBasedIDConfigs)
    const instances = await getObjectTypesInstances(client, relevantObjectTypes, nameBasedTypes)
    elements.push(...instances)
  },
})

export default filterCreator
