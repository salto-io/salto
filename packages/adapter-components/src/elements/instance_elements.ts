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
const NULL_REPRESENTATION = ''
const FIELDS_SEPARATOR = '_'

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
  const { idFields, fileNameFields } = getConfigWithDefault(
    transformationConfigByType[type.elemID.name],
    transformationDefaultConfig,
  )

  const getFieldValue = (fieldName: string): unknown => _.get(entry, fieldName)

  const getNameFromFields = (fields: string[]): string | undefined => {
    const fieldValues = fields.map(getFieldValue)
    const undefinedFieldsNames = fieldValues
      .filter(_.isUndefined)
      .map((__, i,) => fields[i])
    if (undefinedFieldsNames.length > 0) {
      log.warn('Found undefined fields: %s.', undefinedFieldsNames)
      return undefined
    }
    if (_.isEmpty(fieldValues)) {
      log.warn('No fields were given')
      return undefined
    }
    if (fieldValues.every(_.isNull)) {
      log.warn('All given fields were null: %s', fields)
      return undefined
    }
    const formatValue = (v: unknown): string => (_.isNull(v) ? NULL_REPRESENTATION : _.toString(v))
    return fieldValues.map(formatValue).join(FIELDS_SEPARATOR)
  }

  const entryData = await transformValues({
    values: entry,
    type,
    transformFunc: omitFields,
    strict: false,
  })

  const elementIdName = getNameFromFields(idFields) ?? defaultName
  const naclName = naclCase(
    parent && nestName
      ? `${parent.elemID.name}${ID_SEPARATOR}${elementIdName}`
      : String(elementIdName)
  )
  const getFileName = (): string => {
    const hasUnsupportedValue = (fields: string[]): boolean =>
      fields
        .map(getFieldValue)
        .some(v => !(_.isString(v) || _.isNumber(v) || _.isNull(v)))
    const defaultFileName = pathNaclCase(naclName)
    if (_.isUndefined(fileNameFields) || hasUnsupportedValue(fileNameFields)) {
      return defaultFileName
    }
    const fileName = getNameFromFields(fileNameFields)
    return _.isUndefined(fileName) ? defaultFileName : pathNaclCase(naclCase(fileName))
  }

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
      type.elemID.adapter,
      RECORDS_PATH,
      pathNaclCase(type.elemID.name),
      getFileName(),
    ],
    parent
      ? { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parent.elemID, parent)] }
      : undefined,
  )
}
