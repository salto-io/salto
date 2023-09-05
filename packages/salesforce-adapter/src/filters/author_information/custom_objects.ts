/*
*                      Copyright 2023 Salto Labs Ltd.
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
import {
  CORE_ANNOTATIONS,
  Element,
  Field,
  ObjectType,
} from '@salto-io/adapter-api'
import { FileProperties } from 'jsforce-types'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { CUSTOM_FIELD, CUSTOM_OBJECT, INTERNAL_ID_ANNOTATION } from '../../constants'
import { getAuthorAnnotations, MetadataInstanceElement } from '../../transformers/transformer'
import { RemoteFilterCreator } from '../../filter'
import SalesforceClient from '../../client/client'
import {
  apiNameSync,
  ensureSafeFilterFetch,
  getAuthorInformationFromFileProps,
  getElementAuthorInformation,
  isCustomObjectSync,
  isElementWithParent,
  isMetadataInstanceElementSync, metadataTypeSync,
} from '../utils'
import { NESTED_INSTANCE_VALUE_TO_TYPE_NAME } from '../custom_objects_to_object_type'

type FilePropertiesMap = Record<string, FileProperties>
type FieldFileNameParts = {fieldName: string; objectName: string}
const log = logger(module)

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

type ObjectAuthorInformationSupplierArgs = {
  object: ObjectType
  typeFileProperties: FileProperties
  customFieldsFileProperties: FileProperties[]
  nestedInstances: MetadataInstanceElement[]
}

const setObjectAuthorInformation = (
  {
    object,
    typeFileProperties,
    customFieldsFileProperties,
    nestedInstances,
  }: ObjectAuthorInformationSupplierArgs
): void => {
  // Set author information on the CustomObject's fields
  Object.values(customFieldsFileProperties)
    .forEach(fileProp => {
      const field = getObjectFieldByFileProperties(fileProp, object)
      if (field === undefined) {
        return
      }
      field.annotations[INTERNAL_ID_ANNOTATION] = fileProp.id
      addAuthorAnnotationsToField(fileProp, field)
    })
  // Set the latest AuthorInformation on the CustomObject
  const allAuthorInformation = [getAuthorInformationFromFileProps(typeFileProperties)]
    .concat(customFieldsFileProperties.map(getAuthorInformationFromFileProps))
    .concat(nestedInstances.map(getElementAuthorInformation))
  const mostRecentAuthorInformation = _.maxBy(
    allAuthorInformation,
    authorInfo => (
      authorInfo.changedAt !== undefined
        ? new Date(authorInfo.changedAt).getTime()
        : undefined
    )
  )
  if (mostRecentAuthorInformation) {
    object.annotations[CORE_ANNOTATIONS.CHANGED_BY] = mostRecentAuthorInformation.changedBy
    object.annotations[CORE_ANNOTATIONS.CHANGED_AT] = mostRecentAuthorInformation.changedAt
    object.annotations[CORE_ANNOTATIONS.CREATED_BY] = mostRecentAuthorInformation.createdBy
    object.annotations[CORE_ANNOTATIONS.CREATED_AT] = mostRecentAuthorInformation.createdAt
  }
}

const CUSTOM_OBJECT_SUB_INSTANCES_METADATA_TYPES: Set<string> = new Set(
  Object.values(NESTED_INSTANCE_VALUE_TO_TYPE_NAME)
)

const isCustomObjectSubInstance = (instance: MetadataInstanceElement): boolean => (
  CUSTOM_OBJECT_SUB_INSTANCES_METADATA_TYPES.has(metadataTypeSync(instance))
)

export const WARNING_MESSAGE = 'Encountered an error while trying to populate author information in some of the Salesforce configuration elements.'

/*
 * add author information to object types and fields.
 */
const filterCreator: RemoteFilterCreator = ({ client, config }) => ({
  name: 'customObjectAuthorFilter',
  remote: true,
  onFetch: ensureSafeFilterFetch({
    warningMessage: WARNING_MESSAGE,
    config,
    filterName: 'authorInformation',
    fetchFilterFunc: async (elements: Element[]) => {
      const customTypeFilePropertiesMap = await getCustomObjectFileProperties(client)
      const customFieldsFilePropertiesMap = await getCustomFieldFileProperties(client)
      const instancesByParent = _.groupBy(
        elements
          .filter(isMetadataInstanceElementSync)
          .filter(isElementWithParent),
        instance => {
          const [parent] = instance.annotations[CORE_ANNOTATIONS.PARENT]
          return apiNameSync(parent.value)
        }
      )

      elements
        .filter(isCustomObjectSync)
        .forEach(object => {
          const typeFileProperties = customTypeFilePropertiesMap[apiNameSync(object) ?? '']
          if (typeFileProperties === undefined) {
            log.warn(`Not adding author information on the CustomObject ${apiNameSync(object)} and it's fields because it has no file properties`)
            return
          }
          const fieldsPropertiesMap = customFieldsFilePropertiesMap[apiNameSync(object) ?? '']
          if (fieldsPropertiesMap === undefined) {
            log.warn(`Not adding author information on the CustomObject ${apiNameSync(object)} and it's fields because it's fields has no file properties`)
            return
          }
          setObjectAuthorInformation({
            object,
            typeFileProperties,
            customFieldsFileProperties: Object.values(fieldsPropertiesMap),
            nestedInstances: instancesByParent[apiNameSync(object) ?? ''].filter(isCustomObjectSubInstance) ?? [],
          })
        })
    },
  }),
})

export default filterCreator
