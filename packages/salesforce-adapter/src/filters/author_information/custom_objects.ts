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
import { Element, Field, ObjectType } from '@salto-io/adapter-api'
import { FileProperties } from 'jsforce-types'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { CUSTOM_FIELD, CUSTOM_OBJECT } from '../../constants'
import { apiName, getAuthorAnnotations, isCustomObject } from '../../transformers/transformer'
import { FilterWith, RemoteFilterCreator } from '../../filter'
import SalesforceClient from '../../client/client'
import { ensureSafeFilterFetch } from '../utils'

const { awu } = collections.asynciterable
type AwuIterable<T> = collections.asynciterable.AwuIterable<T>

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

export const WARNING_MESSAGE = 'Encountered an error while trying to populate author information in some of the Salesforce configuration elements.'

/*
 * add author information to object types and fields.
 */
const filterCreator: RemoteFilterCreator = ({ client, config }): FilterWith<'onFetch'> => ({
  name: 'customObjectAuthorFilter',
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
    },
  }),
})

export default filterCreator
