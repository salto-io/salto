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
import { CORE_ANNOTATIONS, Element, Field, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { FileProperties } from 'jsforce-types'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { AwuIterable } from '@salto-io/lowerdash/src/collections/asynciterable'
import { CUSTOM_FIELD, CUSTOM_OBJECT } from '../constants'
import { apiName, getAuditAnnotations, isCustomObject, isInstanceOfCustomObject } from '../transformers/transformer'
import { FilterCreator, FilterWith } from '../filter'
import SalesforceClient from '../client/client'
import { conditionQueries, ensureSafeFilterFetch, queryClient } from './utils'

const { awu } = collections.asynciterable

type FilePropertiesMap = Record<string, FileProperties>
type FieldFileNameParts = {fieldName: string; objectName: string}
const log = logger(module)
const GET_ID_AND_NAMES_OF_USERS_QUERY = 'SELECT Id,Name FROM User'

const getFieldNameParts = (fileProperties: FileProperties): FieldFileNameParts =>
  ({ fieldName: fileProperties.fullName.split('.')[1],
    objectName: fileProperties.fullName.split('.')[0] } as FieldFileNameParts)

const getObjectFieldByFileProperties = (
  fileProperties: FileProperties,
  object: ObjectType
): Field | undefined =>
  object.fields[getFieldNameParts(fileProperties).fieldName]

const addAuditAnnotationsToField = (
  fileProperties: FileProperties,
  field: Field | undefined
): void => {
  if (!field) {
    return
  }
  Object.assign(field.annotations, getAuditAnnotations(fileProperties))
}

const addAuditAnnotationsToFields = (
  fileProperties: FilePropertiesMap,
  object: ObjectType
): void => {
  Object.values(fileProperties)
    .forEach(fileProp => addAuditAnnotationsToField(
      fileProp,
      getObjectFieldByFileProperties(fileProp, object)
    ))
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

const objectAuditInformationSupplier = async (
  customTypeFilePropertiesMap: FilePropertiesMap,
  customFieldsFilePropertiesMap: Record<string, FilePropertiesMap>,
  object: ObjectType
): Promise<void> => {
  if (await apiName(object) in customTypeFilePropertiesMap) {
    Object.assign(object.annotations,
      getAuditAnnotations(customTypeFilePropertiesMap[object.elemID.name]))
  }
  if (object.elemID.name in customFieldsFilePropertiesMap) {
    addAuditAnnotationsToFields(customFieldsFilePropertiesMap[object.elemID.name], object)
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

const moveAuditFieldsToAnnotations = (
  instance: InstanceElement,
  IDToNameMap: Record<string, string>
): void => {
  instance.annotations[CORE_ANNOTATIONS.CREATED_AT] = instance.value.CreatedDate
  instance.annotations[CORE_ANNOTATIONS.CREATED_BY] = IDToNameMap[instance.value.CreatedById]
  instance.annotations[CORE_ANNOTATIONS.CHANGED_AT] = instance.value.LastModifiedDate
  instance.annotations[CORE_ANNOTATIONS.CHANGED_BY] = IDToNameMap[
    instance.value.LastModifiedById]
}

const moveInstancesAuditFieldsToAnnotations = (
  instances: InstanceElement[],
  IDToNameMap: Record<string, string>
): void => {
  instances.forEach(instance => moveAuditFieldsToAnnotations(instance, IDToNameMap))
}

export const WARNING_MESSAGE = 'Encountered an error while trying to populate audit information in some of the Salesforce configuration elements.'

/**
 * add audit information to object types, and data instance elements.
 */
const filterCreator: FilterCreator = ({ client, config }): FilterWith<'onFetch'> => ({
  onFetch: ensureSafeFilterFetch({
    warningMessage: WARNING_MESSAGE,
    config,
    filterName: 'auditInformation',
    fetchFilterFunc: async (elements: Element[]) => {
      const customTypeFilePropertiesMap = await getCustomObjectFileProperties(client)
      const customFieldsFilePropertiesMap = await getCustomFieldFileProperties(client)
      await (awu(elements)
        .filter(isCustomObject) as AwuIterable<ObjectType>)
        .forEach(async object => {
          await objectAuditInformationSupplier(customTypeFilePropertiesMap,
            customFieldsFilePropertiesMap,
            object)
        })
      const customObjectInstances = await awu(elements).filter(isInstanceOfCustomObject)
        .toArray() as InstanceElement[]
      const IDToNameMap = await getIDToNameMap(client, customObjectInstances)
      moveInstancesAuditFieldsToAnnotations(customObjectInstances, IDToNameMap)
    },
  }),
})

export default filterCreator
