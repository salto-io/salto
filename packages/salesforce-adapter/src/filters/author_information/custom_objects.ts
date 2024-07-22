/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { FileProperties } from '@salto-io/jsforce-types'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { collections, values } from '@salto-io/lowerdash'
import {
  CUSTOM_FIELD,
  CUSTOM_OBJECT,
  INTERNAL_ID_ANNOTATION,
} from '../../constants'
import {
  getAuthorAnnotations,
  MetadataInstanceElement,
} from '../../transformers/transformer'
import { RemoteFilterCreator } from '../../filter'
import SalesforceClient from '../../client/client'
import {
  apiNameSync,
  ensureSafeFilterFetch,
  getAuthorInformationFromFileProps,
  getElementAuthorInformation,
  isCustomObjectSync,
  isElementWithResolvedParent,
  isMetadataInstanceElementSync,
  metadataTypeSync,
} from '../utils'
import { NESTED_INSTANCE_VALUE_TO_TYPE_NAME } from '../custom_objects_to_object_type'

type FilePropertiesMap = Record<string, FileProperties>
type FieldFileNameParts = { fieldName: string; objectName: string }
const log = logger(module)

const { makeArray } = collections.array
const { isDefined } = values

const getFieldNameParts = (
  fileProperties: FileProperties,
): FieldFileNameParts =>
  ({
    fieldName: fileProperties.fullName.split('.')[1],
    objectName: fileProperties.fullName.split('.')[0],
  }) as FieldFileNameParts

const getObjectFieldByFileProperties = (
  fileProperties: FileProperties,
  object: ObjectType,
): Field | undefined =>
  object.fields[getFieldNameParts(fileProperties).fieldName]

const addAuthorAnnotationsToField = (
  fileProperties: FileProperties,
  field: Field | undefined,
): void => {
  if (!field) {
    return
  }
  Object.assign(field.annotations, getAuthorAnnotations(fileProperties))
}

const getCustomObjectFileProperties = async (
  client: SalesforceClient,
): Promise<FilePropertiesMap> => {
  const { result, errors } = await client.listMetadataObjects({
    type: CUSTOM_OBJECT,
  })
  if (errors && errors.length > 0) {
    log.warn(
      `Encountered errors while listing file properties for CustomObjects: ${errors}`,
    )
  }
  return _.keyBy(result, (fileProp) => fileProp.fullName)
}

const getCustomFieldFileProperties = async (
  client: SalesforceClient,
): Promise<Record<string, FilePropertiesMap>> => {
  const { result, errors } = await client.listMetadataObjects({
    type: CUSTOM_FIELD,
  })
  if (errors && errors.length > 0) {
    log.warn(
      `Encountered errors while listing file properties for CustomFields: ${errors}`,
    )
  }
  return _(result)
    .groupBy(
      (fileProps: FileProperties) => getFieldNameParts(fileProps).objectName,
    )
    .mapValues((v: FileProperties[]) =>
      _.keyBy(
        v,
        (fileProps: FileProperties) => getFieldNameParts(fileProps).fieldName,
      ),
    )
    .value()
}

type ObjectAuthorInformationSupplierArgs = {
  object: ObjectType
  typeFileProperties?: FileProperties
  customFieldsFileProperties: FileProperties[]
  nestedInstances: MetadataInstanceElement[]
}

const setObjectAuthorInformation = ({
  object,
  typeFileProperties,
  customFieldsFileProperties,
  nestedInstances,
}: ObjectAuthorInformationSupplierArgs): void => {
  // Set author information on the CustomObject's fields
  Object.values(customFieldsFileProperties).forEach((fileProp) => {
    const field = getObjectFieldByFileProperties(fileProp, object)
    if (field === undefined) {
      return
    }
    if (!_.isEmpty(field.annotations[INTERNAL_ID_ANNOTATION])) {
      field.annotations[INTERNAL_ID_ANNOTATION] = fileProp.id
    }
    addAuthorAnnotationsToField(fileProp, field)
  })
  // Set the latest AuthorInformation on the CustomObject
  const allAuthorInformation = [
    typeFileProperties
      ? getAuthorInformationFromFileProps(typeFileProperties)
      : undefined,
  ]
    .concat(customFieldsFileProperties.map(getAuthorInformationFromFileProps))
    .concat(nestedInstances.map(getElementAuthorInformation))
    .filter(isDefined)
  const mostRecentAuthorInformation = _.maxBy(
    allAuthorInformation,
    (authorInfo) =>
      authorInfo.changedAt !== undefined
        ? new Date(authorInfo.changedAt).getTime()
        : undefined,
  )
  if (mostRecentAuthorInformation) {
    object.annotations[CORE_ANNOTATIONS.CHANGED_BY] =
      mostRecentAuthorInformation.changedBy
    object.annotations[CORE_ANNOTATIONS.CHANGED_AT] =
      mostRecentAuthorInformation.changedAt
    // This info should always come from the FileProperties of the CustomObject.
    // Standard Objects won't have values here
    if (typeFileProperties) {
      object.annotations[CORE_ANNOTATIONS.CREATED_BY] =
        typeFileProperties.createdByName
      object.annotations[CORE_ANNOTATIONS.CREATED_AT] =
        typeFileProperties.createdDate
    }
  }
}

const CUSTOM_OBJECT_SUB_INSTANCES_METADATA_TYPES: Set<string> = new Set(
  Object.values(NESTED_INSTANCE_VALUE_TO_TYPE_NAME),
)

const isCustomObjectSubInstance = (
  instance: MetadataInstanceElement,
): boolean =>
  CUSTOM_OBJECT_SUB_INSTANCES_METADATA_TYPES.has(metadataTypeSync(instance))

export const WARNING_MESSAGE =
  'Encountered an error while trying to populate author information in some of the Salesforce configuration elements.'

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
      const customTypeFilePropertiesMap =
        await getCustomObjectFileProperties(client)
      const customFieldsFilePropertiesMap =
        await getCustomFieldFileProperties(client)
      const instancesByParent = _.groupBy(
        elements
          .filter(isMetadataInstanceElementSync)
          .filter(isElementWithResolvedParent),
        (instance) => {
          // SALTO-4824
          // eslint-disable-next-line no-underscore-dangle
          const [parent] = instance.annotations._parent
          return apiNameSync(parent.value)
        },
      )

      elements.filter(isCustomObjectSync).forEach((object) => {
        const typeFileProperties =
          customTypeFilePropertiesMap[apiNameSync(object) ?? '']
        const fieldsPropertiesMap =
          customFieldsFilePropertiesMap[apiNameSync(object) ?? ''] ?? {}
        setObjectAuthorInformation({
          object,
          typeFileProperties,
          customFieldsFileProperties: Object.values(fieldsPropertiesMap),
          nestedInstances: makeArray(
            instancesByParent[apiNameSync(object) ?? ''],
          ).filter(isCustomObjectSubInstance),
        })
      })
    },
  }),
})

export default filterCreator
