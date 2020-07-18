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

const masterDetailNamesSeparator = '___'

// This will be exctracted to a config once we have more knowledge
// on naming "patterns"
const objectsToAdditionalNameFields: Record<string, string[]> = {
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

const getObjectRecords = async (
  client: SalesforceClient,
  object: ObjectType
): Promise<Record<string, SalesforceRecord>> => {
  const queryString = buildQueryString(object)
  const recordsIterable = await client.queryAll(queryString)
  return _.keyBy(
    (await toArrayAsync(recordsIterable)).flat(),
    record => record[CUSTOM_OBJECT_ID_FIELD]
  )
}

const objectsRecordToInstances = (
  objectToIdsToRecords: Record<string, Record<string, SalesforceRecord>>,
  objectNameToObject: Record<string, ObjectType>,
  nameBasedObjects: ObjectType[],
): InstanceElement[] => {
  const objectsToIdsToSaltoNames = {} as Record<string, Record<string, string>>

  const getRecordSaltoName = (
    record: SalesforceRecord,
    object: ObjectType,
  ): string => {
    const setSaltoName = (saltoName: string): void => {
      if (objectsToIdsToSaltoNames[apiName(object)] === undefined) {
        objectsToIdsToSaltoNames[apiName(object)] = {}
      }
      objectsToIdsToSaltoNames[apiName(object)][record[CUSTOM_OBJECT_ID_FIELD]] = saltoName
    }

    const saltoName = objectsToIdsToSaltoNames[apiName(object)] !== undefined
      ? objectsToIdsToSaltoNames[apiName(object)][record[CUSTOM_OBJECT_ID_FIELD]] : undefined
    if (saltoName !== undefined) {
      return saltoName
    }
    const selfName = record.Name
    const prefixField = _.pickBy(
      object.fields,
      (field => (isPrimitiveType(field.type)
        && Types.primitiveDataTypes.MasterDetail.isEqual(field.type))
        || (objectsToAdditionalNameFields[apiName(object)]?.includes(field.name))
      )
    )
    const prefixNames = Object.values(_.mapValues(
      prefixField,
      (field: Field, fieldName: string) => {
        const fieldValue = record[fieldName]
        // If it's a special case of using a non-ref field simply use the value
        if (!(isPrimitiveType(field.type)
          && (Types.primitiveDataTypes.MasterDetail.isEqual(field.type)
          || Types.primitiveDataTypes.Lookup.isEqual(field.type)))) {
          return fieldValue.toString()
        }
        const objectNames = field.annotations[FIELD_ANNOTATIONS.REFERENCE_TO] as string[]
        return objectNames.map(objectName => {
          const objectRecords = objectToIdsToRecords[objectName]
          if (objectRecords === undefined) {
            log.warn(`failed to find object name ${objectName} when looking for master`)
            return undefined
          }
          const rec = objectRecords[fieldValue]
          if (rec === undefined) {
            log.warn(`failed to find record with id ${fieldValue} in ${objectRecords} when looking for master`)
            return undefined
          }
          return getRecordSaltoName(rec, objectNameToObject[objectName])
        }).find(isDefined)
      }
    )).filter(isDefined)
    const fullName = [...prefixNames, selfName].join(masterDetailNamesSeparator)
    setSaltoName(fullName)
    return fullName
  }

  const recordToInstance = (
    record: SalesforceRecord,
    object: ObjectType,
    isNameBased: boolean,
  ): InstanceElement => {
    const getInstancePath = (instanceName: string): string[] => {
      const objectNamespace = getNamespace(object)
      if (objectNamespace) {
        return [SALESFORCE, INSTALLED_PACKAGES_PATH, objectNamespace, OBJECTS_PATH,
          object.elemID.typeName, RECORDS_PATH, instanceName]
      }
      return [SALESFORCE, OBJECTS_PATH, object.elemID.typeName, RECORDS_PATH, instanceName]
    }
    // Name compound sub-fields are returned at top level -> move them to the nameField
    const transformCompoundNameValues = (recordValue: SalesforceRecord): SalesforceRecord => {
      const nameSubFields = Object.keys(Types.compoundDataTypes.Name.fields)
      // We assume there's only one Name field
      const nameFieldName = Object.keys(_.pickBy(object.fields, isNameField))[0]
      return _.isUndefined(nameFieldName)
        ? recordValue
        : {
          ..._.omit(recordValue, nameSubFields),
          [nameFieldName]: _.pick(recordValue, nameSubFields),
          [CUSTOM_OBJECT_ID_FIELD]: recordValue[CUSTOM_OBJECT_ID_FIELD],
        }
    }
    const suggestedIDName = isNameBased
      ? getRecordSaltoName(record, object)
      : record[CUSTOM_OBJECT_ID_FIELD]
    const { name } = Types.getElemId(
      suggestedIDName,
      true,
      createInstanceServiceIds(_.pick(record, CUSTOM_OBJECT_ID_FIELD), object),
    )
    return new InstanceElement(
      name,
      object,
      transformCompoundNameValues(record),
      getInstancePath(name),
    )
  }

  return Object.values(_.mapValues(
    objectToIdsToRecords,
    (idsToRecords: Record<string, SalesforceRecord>, objectName: string): InstanceElement[] =>
      Object.values(idsToRecords).map(record =>
        recordToInstance(
          record,
          objectNameToObject[objectName],
          nameBasedObjects.some(o => o.isEqual(objectNameToObject[objectName])),
        ))
  )).flat()
}

const getObjectTypesInstances = async (
  client: SalesforceClient,
  objects: ObjectType[],
  nameBasedObjects: ObjectType[],
): Promise<InstanceElement[]> => {
  const objectNameToObject = _.keyBy(objects, object => apiName(object))
  const objectNamesToRecords = await mapValuesAsync(
    objectNameToObject,
    (object, _objectName) => getObjectRecords(client, object)
  )
  return objectsRecordToInstances(objectNamesToRecords, objectNameToObject, nameBasedObjects)
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
    const nameBasedObjects = filterObjectTypes(relevantObjectTypes, nameBasedIDConfigs)
    const instances = await getObjectTypesInstances(client, relevantObjectTypes, nameBasedObjects)
    elements.push(...instances)
  },
})

export default filterCreator
