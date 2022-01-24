/*
*                      Copyright 2022 Salto Labs Ltd.
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
  InstanceElement, Values, ObjectType, ReferenceExpression, CORE_ANNOTATIONS, ElemID,
  ElemIdGetter, OBJECT_SERVICE_ID, OBJECT_NAME, toServiceIdsString,
} from '@salto-io/adapter-api'
import { pathNaclCase, naclCase, transformValues, TransformFunc } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { RECORDS_PATH } from './constants'
import { TransformationConfig, TransformationDefaultConfig, getConfigWithDefault,
  RecurseIntoCondition, isRecurseIntoConditionByField } from '../config'

const log = logger(module)

const ID_SEPARATOR = '__'

export type InstanceCreationParams = {
  entry: Values
  type: ObjectType
  transformationConfigByType: Record<string, TransformationConfig>
  transformationDefaultConfig: TransformationDefaultConfig
  defaultName: string
  nestName?: boolean
  parent?: InstanceElement
  normalized?: boolean
  getElemIdFunc?: ElemIdGetter
}

export const getInstanceName = (
  instanceValues: Values,
  idFields: string[],
): string | undefined => {
  const nameParts = idFields.map(field => _.get(instanceValues, field))
  if (nameParts.includes(undefined)) {
    log.warn(`could not find id for entry - expected id fields ${idFields}, available fields ${Object.keys(instanceValues)}`)
  }
  return nameParts.every(part => part !== undefined && part !== '') ? nameParts.map(String).join('_') : undefined
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
  getElemIdFunc,
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
    idFields, fileNameFields, serviceIdField,
  } = getConfigWithDefault(
    transformationConfigByType[type.elemID.name],
    transformationDefaultConfig,
  )

  const name = getInstanceName(entry, idFields) ?? defaultName

  const fileNameParts = (fileNameFields !== undefined
    ? fileNameFields.map(field => _.get(entry, field))
    : undefined)
  const fileName = ((fileNameParts?.every(p => _.isString(p) || _.isNumber(p))
    ? fileNameParts.join('_')
    : undefined))

  const desiredName = naclCase(
    parent && nestName ? `${parent.elemID.name}${ID_SEPARATOR}${name}` : String(name)
  )
  const adapterName = type.elemID.adapter
  const naclName = getElemIdFunc && serviceIdField
    ? getElemIdFunc(
      adapterName,
      {
        [serviceIdField]: entry[serviceIdField],
        [OBJECT_SERVICE_ID]: toServiceIdsString({
          [OBJECT_NAME]: type.elemID.getFullName(),
        }),
      },
      desiredName
    ).name
    : desiredName
  const filePath = type.isSettings
    ? [
      adapterName,
      RECORDS_PATH,
      pathNaclCase(type.elemID.name),
    ]
    : [
      adapterName,
      RECORDS_PATH,
      pathNaclCase(type.elemID.name),
      fileName ? pathNaclCase(naclCase(fileName)) : pathNaclCase(naclName),
    ]
  return new InstanceElement(
    type.isSettings ? ElemID.CONFIG_NAME : naclName,
    type,
    await transformValues({
      values: entryData,
      type,
      // omit nulls from returned value
      transformFunc: ({ value }) => (value === null ? undefined : value),
      strict: false,
    }),
    filePath,
    parent
      ? { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parent.elemID, parent)] }
      : undefined,
  )
}

export const shouldRecurseIntoEntry = (
  entry: Values,
  context?: Record<string, unknown>,
  conditions?: RecurseIntoCondition[]
): boolean => (
  (conditions ?? []).every(condition => {
    const compareValue = isRecurseIntoConditionByField(condition)
      ? _.get(entry, condition.fromField)
      : _.get(context, condition.fromContext)
    return condition.match.some(m => new RegExp(m).test(compareValue))
  })
)
