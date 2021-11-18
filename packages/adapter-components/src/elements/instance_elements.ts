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
import _ from 'lodash'
import {
  InstanceElement, Values, ObjectType, ReferenceExpression, CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { pathNaclCase, naclCase, transformValues, TransformFunc } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { RECORDS_PATH } from './constants'
import { TransformationConfig, TransformationDefaultConfig, getConfigWithDefault } from '../config'

const log = logger(module)

const ID_SEPARATOR = '__'
const UNSUPPORTED_FIELD_REPRESENTATION = ''
export const NAME_PARTS_SEPARATOR = '_'

export type InstanceCreationParams = {
  entry: Values
  type: ObjectType
  transformationConfigByType: Record<string, TransformationConfig>
  transformationDefaultConfig: TransformationDefaultConfig
  defaultName: string
  nestName?: boolean
  parent?: InstanceElement
  normalized?: boolean
}

/**
 * Generate an instance for a single entry returned for a given type.
 *
 * - The elem id is determined based on the name field, with a fallback
 *    to a default name that might not be multienv-friendly.
 */
export const toBasicInstance = async ({
  entry,
  type,
  transformationConfigByType,
  transformationDefaultConfig,
  nestName,
  parent,
  defaultName,
}: InstanceCreationParams): Promise<InstanceElement> => {
  const omitFields: TransformFunc = ({ value, field }) => {
    if (field !== undefined) {
      const parentType = field.parent.elemID.name
      const shouldOmit = (
        transformationConfigByType[parentType]?.fieldsToOmit
        ?? transformationDefaultConfig.fieldsToOmit
      )?.find(({ fieldName, fieldType }) => (
        fieldName === field.name
        && (fieldType === undefined || fieldType === field.refType.elemID.name)
      ))
      if (shouldOmit) {
        return undefined
      }
    }
    return value
  }
  const entryData = await transformValues({
    values: entry,
    type,
    transformFunc: omitFields,
    strict: false,
  })

  const {
    idFields, fileNameFields,
  } = getConfigWithDefault(
    transformationConfigByType[type.elemID.name],
    transformationDefaultConfig,
  )

  const isValueTypeSupported = (value: any) => {
    return _.isString(value) || _.isNumber(value)
  }

  const hasDefinedField = (fields: string[] | undefined): boolean =>
    fields !== undefined && fields.some(field => {
      const value = _.get(entry, field)
      return value !== undefined && value !== null && isValueTypeSupported(value)
    })


  const getNamePart = (field: string): string => {
    const value = _.get(entry, field)
    if (value === undefined || value === null) {
      log.warn('Ignoring field "%s" with value "%s"', field, value)
      return UNSUPPORTED_FIELD_REPRESENTATION
    } else if (!isValueTypeSupported(value)) {
      log.warn('Ignoring field "%s" with unsupported type "$%s". Supported types: String, Number', field, typeof value)
      return UNSUPPORTED_FIELD_REPRESENTATION
    }
    return value
  }

  const fileNameParts = fileNameFields?.map(getNamePart) ?? []
  const fileName = hasDefinedField(fileNameFields) ? fileNameParts.map(String).join(NAME_PARTS_SEPARATOR) : defaultName

  const idParts = idFields?.map(getNamePart) ?? []
  const elementIdName = hasDefinedField(idFields) ? idParts.map(String).join(NAME_PARTS_SEPARATOR) : defaultName
  const naclName = naclCase(
      parent && nestName ? `${parent.elemID.name}${ID_SEPARATOR}${elementIdName}` : String(elementIdName)
  )
  const adapterName = type.elemID.adapter

  return new InstanceElement(
    naclName,
    type,
    await transformValues({
      values: entryData,
      type,
      // omit nulls from returned value
      transformFunc: ({ value }) => (value === null ? undefined : value),
      strict: false,
    }),
    [
      adapterName,
      RECORDS_PATH,
      pathNaclCase(type.elemID.name),
      fileName ? pathNaclCase(naclCase(fileName)) : pathNaclCase(naclName),
    ],
    parent ? { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parent.elemID)] } : undefined,
  )
}
