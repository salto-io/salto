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
import { CORE_ANNOTATIONS, Element, Field, InstanceElement, isInstanceElement, ObjectType } from '@salto-io/adapter-api'
import { FileProperties } from 'jsforce-types'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { CUSTOM_FIELD, CUSTOM_OBJECT, SHARING_RULES_TYPE } from '../constants'
import { apiName, getAuthorAnnotations, isCustomObject, isInstanceOfCustomObject } from '../transformers/transformer'
import { FilterCreator, FilterWith } from '../filter'
import SalesforceClient from '../client/client'
import { conditionQueries, ensureSafeFilterFetch, isInstanceOfType, queryClient } from './utils'

const { awu } = collections.asynciterable
type AwuIterable<T> = collections.asynciterable.AwuIterable<T>

type FilePropertiesMap = Record<string, FileProperties>
type FieldFileNameParts = {fieldName: string; objectName: string}
const log = logger(module)
const GET_ID_AND_NAMES_OF_USERS_QUERY = 'SELECT Id,Name FROM User'
const SHARING_RULES_API_NAMES = ['SharingCriteriaRule', 'SharingGuestRule', 'SharingOwnerRule']

const isSharingRulesInstance = isInstanceOfType(SHARING_RULES_TYPE)
const getFieldNameParts = (fileProperties: FileProperties): FieldFileNameParts =>
  ({ fieldName: fileProperties.fullName.split('.')[1],
    objectName: fileProperties.fullName.split('.')[0] } as FieldFileNameParts)

const getObjectFieldByFileProperties = (
  fileProperties: FileProperties,
  object: ObjectType
): Field | undefined =>
  object.fields[getFieldNameParts(fileProperties).fieldName]

const addAuthorAnnotationsToField = (
  fileProperties: FileProperties,
  field: Field | undefined
): void => {
  if (!field) {
    return
  }
  Object.assign(field.annotations, getAuthorAnnotations(fileProperties))
}

const addAuthorAnnotationsToFields = (
  fileProperties: FilePropertiesMap,
  object: ObjectType
): void => {
  Object.values(fileProperties)
    .forEach(fileProp => addAuthorAnnotationsToField(
      fileProp,
      getObjectFieldByFileProperties(fileProp, object)
    ))
}

const getSharingRulesFileProperties = async (client: SalesforceClient):
  Promise<FileProperties[]> => {
  const { result, errors } = await client.listMetadataObjects(
    SHARING_RULES_API_NAMES.map(ruleType => ({ type: ruleType }))
  )
  if (errors && errors.length > 0) {
    log.warn(`Encountered errors while listing file properties for CustomObjects: ${errors}`)
  }
  return result
}

const getCustomObjectFileProperties = async (client: SalesforceClient):
  Promise<FilePropertiesMap> => {
  const { result, errors } = await client.listMetadataObjects({ type: CUSTOM_OBJECT })
  if (errors && errors.length > 0) {
    log.warn(`Encountered errors while listing file properties for CustomObjects: ${errors}`)
  }
  return _.keyBy(result, fileProp => fileProp.fullName)
}

const getCustomFieldFileProperties = async (client: SalesforceClient):
  Promise<Record<string, FilePropertiesMap>> => {
  const { result, errors } = await client.listMetadataObjects({ type: CUSTOM_FIELD })
  if (errors && errors.length > 0) {
    log.warn(`Encountered errors while listing file properties for CustomFields: ${errors}`)
  }
  return _(result).groupBy((fileProps: FileProperties) => getFieldNameParts(fileProps).objectName)
    .mapValues((values: FileProperties[]) => _.keyBy(values,
      (fileProps:FileProperties) => getFieldNameParts(fileProps).fieldName)).value()
}

const objectAuthorInformationSupplier = async (
  customTypeFilePropertiesMap: FilePropertiesMap,
  customFieldsFilePropertiesMap: Record<string, FilePropertiesMap>,
  object: ObjectType
): Promise<void> => {
  const objectApiName = await apiName(object)
  if (objectApiName in customTypeFilePropertiesMap) {
    Object.assign(object.annotations,
      getAuthorAnnotations(customTypeFilePropertiesMap[objectApiName]))
  }
  if (objectApiName in customFieldsFilePropertiesMap) {
    addAuthorAnnotationsToFields(customFieldsFilePropertiesMap[objectApiName], object)
  }
}

const getIDToNameMap = async (client: SalesforceClient,
  instances: InstanceElement[]): Promise<Record<string, string>> => {
  const instancesIDs = Array.from(new Set(
    instances.flatMap(instance => [instance.value.CreatedById, instance.value.LastModifiedById])
  ))
  const queries = conditionQueries(GET_ID_AND_NAMES_OF_USERS_QUERY,
    instancesIDs.map(id => ({ Id: `'${id}'` })))
  const records = await queryClient(client, queries)
  return Object.fromEntries(records.map(record => [record.Id, record.Name]))
}

const moveAuthorFieldsToAnnotations = (
  instance: InstanceElement,
  IDToNameMap: Record<string, string>
): void => {
  instance.annotations[CORE_ANNOTATIONS.CREATED_AT] = instance.value.CreatedDate
  instance.annotations[CORE_ANNOTATIONS.CREATED_BY] = IDToNameMap[instance.value.CreatedById]
  instance.annotations[CORE_ANNOTATIONS.CHANGED_AT] = instance.value.LastModifiedDate
  instance.annotations[CORE_ANNOTATIONS.CHANGED_BY] = IDToNameMap[
    instance.value.LastModifiedById]
}

const moveInstancesAuthorFieldsToAnnotations = (
  instances: InstanceElement[],
  IDToNameMap: Record<string, string>
): void => {
  instances.forEach(instance => moveAuthorFieldsToAnnotations(instance, IDToNameMap))
}


const fetchAllSharingRules = async (
  client: SalesforceClient
): Promise<Record<string, FileProperties[]>> => {
  const allRules = await getSharingRulesFileProperties(client)
  return _.groupBy(allRules.flatMap(file => file),
    fileProp => getFieldNameParts(fileProp).objectName)
}

const getLastSharingRuleFileProperties = (
  sharingRules: InstanceElement,
  sharingRulesMap: Record<string, FileProperties[]>,
): FileProperties =>
  _.sortBy(sharingRulesMap[sharingRules.value.fullName],
    fileProp => Date.parse(fileProp.lastModifiedDate)).reverse()[0]

export const WARNING_MESSAGE = 'Encountered an error while trying to populate author information in some of the Salesforce configuration elements.'

/*
 * add author information to object types, and data instance elements.
 */
const filterCreator: FilterCreator = ({ client, config }): FilterWith<'onFetch'> => ({
  onFetch: ensureSafeFilterFetch({
    warningMessage: WARNING_MESSAGE,
    config,
    filterName: 'authorInformation',
    fetchFilterFunc: async (elements: Element[]) => {
      const customTypeFilePropertiesMap = await getCustomObjectFileProperties(client)
      const customFieldsFilePropertiesMap = await getCustomFieldFileProperties(client)
      await (awu(elements)
        .filter(isCustomObject) as AwuIterable<ObjectType>)
        .forEach(async object => {
          await objectAuthorInformationSupplier(customTypeFilePropertiesMap,
            customFieldsFilePropertiesMap,
            object)
        })
      const customObjectInstances = await awu(elements).filter(isInstanceOfCustomObject)
        .toArray() as InstanceElement[]
      const IDToNameMap = await getIDToNameMap(client, customObjectInstances)
      moveInstancesAuthorFieldsToAnnotations(customObjectInstances, IDToNameMap)

      const sharingRulesMap = await fetchAllSharingRules(client)
      const sharingRulesInstances = await (awu(elements)
        .filter(isInstanceElement)
        .filter(isSharingRulesInstance)
        .toArray())
      sharingRulesInstances.forEach(sharingRules => {
        const lastRuleFileProp = getLastSharingRuleFileProperties(sharingRules, sharingRulesMap)
        if (!_.isUndefined(lastRuleFileProp)) {
          const ruleAuthorInformation = getAuthorAnnotations(lastRuleFileProp)
          delete ruleAuthorInformation[CORE_ANNOTATIONS.CREATED_AT]
          delete ruleAuthorInformation[CORE_ANNOTATIONS.CREATED_BY]
          sharingRules.annotate(getAuthorAnnotations(lastRuleFileProp))
        }
      })
    },
  }),
})

export default filterCreator
