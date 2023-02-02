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
import _, { isEmpty } from 'lodash'
import {
  InstanceElement, Values, ObjectType, ReferenceExpression, CORE_ANNOTATIONS, ElemID,
  ElemIdGetter, OBJECT_SERVICE_ID, OBJECT_NAME, toServiceIdsString, ServiceIds,
} from '@salto-io/adapter-api'
import { pathNaclCase, naclCase, transformValues, TransformFunc } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { RECORDS_PATH, SETTINGS_NESTED_PATH } from './constants'
import { TransformationConfig, TransformationDefaultConfig, getConfigWithDefault,
  RecurseIntoCondition, isRecurseIntoConditionByField, AdapterApiConfig, dereferenceFieldName, NameMappingOptions } from '../config'

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

const getNameMapping = (
  name: string,
  nameMapping?: NameMappingOptions,
): string => {
  switch (nameMapping) {
    case 'lowercase': return name.toLowerCase()
    case 'uppercase': return name.toUpperCase()
    default: return name
  }
}

export const joinInstanceNameParts = (
  nameParts: string[],
): string | undefined => (nameParts.every(part => part !== undefined && part !== '') ? nameParts.map(String).join('_') : undefined)

export const getInstanceName = (
  instanceValues: Values,
  idFields: string[],
  typeName: string,
): string | undefined => {
  const nameParts = idFields
    .map(fieldName => _.get(instanceValues, dereferenceFieldName(fieldName)))
  if (nameParts.includes(undefined)) {
    log.warn(`could not find id for entry in type ${typeName} - expected id fields ${idFields}, available fields ${Object.keys(instanceValues)}`)
  }
  return joinInstanceNameParts(nameParts)
}

export const getInstanceFilePath = ({
  fileNameFields,
  entry,
  naclName,
  typeName,
  isSettingType,
  nameMapping,
  adapterName,
}: {
  fileNameFields: string[] | undefined
  entry: Values
  naclName: string
  typeName: string
  isSettingType: boolean
  nameMapping?: NameMappingOptions
  adapterName: string
}): string[] => {
  const fileNameParts = (fileNameFields !== undefined
    ? fileNameFields.map(field => _.get(entry, field))
    : undefined)
  const fileName = ((fileNameParts?.every(p => _.isString(p) || _.isNumber(p))
    ? fileNameParts.join('_')
    : undefined))
  const naclCaseFileName = fileName ? pathNaclCase(naclCase(fileName)) : pathNaclCase(naclName)
  return isSettingType
    ? [
      adapterName,
      RECORDS_PATH,
      SETTINGS_NESTED_PATH,
      pathNaclCase(typeName),
    ]
    : [
      adapterName,
      RECORDS_PATH,
      pathNaclCase(typeName),
      nameMapping
        ? getNameMapping(naclCaseFileName, nameMapping) : naclCaseFileName,
    ]
}

export const generateInstanceNameFromConfig = (
  values: Values,
  typeName: string,
  apiDefinitions: AdapterApiConfig
): string | undefined => {
  const { idFields, nameMapping } = getConfigWithDefault(
    apiDefinitions.types[typeName]?.transformation ?? {},
    apiDefinitions.typeDefaults.transformation
  )
  const instanceName = getInstanceName(values, idFields, typeName)
  return instanceName !== undefined
    ? getNameMapping(instanceName, nameMapping) : instanceName
}

export const removeNullValues = async (
  values: Values,
  type: ObjectType,
  allowEmpty = false,
): Promise<Values> =>
  await transformValues({
    values,
    type,
    transformFunc: ({ value }) => (value === null ? undefined : value),
    strict: false,
    allowEmpty,
  }) ?? {}

export const createServiceIds = (
  entry: Values, serviceIdField: string, typeId: ElemID
): ServiceIds => ({
  [serviceIdField]: entry[serviceIdField],
  [OBJECT_SERVICE_ID]: toServiceIdsString({
    [OBJECT_NAME]: typeId.getFullName(),
  }),
})

export const getInstanceNaclName = ({
  entry,
  name,
  parentName,
  adapterName,
  getElemIdFunc,
  serviceIdField,
  typeElemId,
  nameMapping,
}:{
  entry: Values
  name: string
  parentName?: string
  adapterName: string
  getElemIdFunc?: ElemIdGetter
  serviceIdField?: string
  typeElemId: ElemID
  nameMapping?: NameMappingOptions
}): string => {
  // If the name is empty, there is no reason to add the ID_SEPARATOR
  const parentNameSuffix = !isEmpty(name) ? `${ID_SEPARATOR}${name}` : ''
  const newName = parentName ? `${parentName}${parentNameSuffix}` : String(name)
  const naclName = naclCase(newName)

  const desiredName = nameMapping
    ? getNameMapping(naclName, nameMapping)
    : naclName
  return getElemIdFunc && serviceIdField
    ? getElemIdFunc(
      adapterName,
      createServiceIds(entry, serviceIdField, typeElemId),
      desiredName
    ).name
    : desiredName
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
    idFields, fileNameFields, serviceIdField, nameMapping,
  } = getConfigWithDefault(
    transformationConfigByType[type.elemID.name],
    transformationDefaultConfig,
  )

  const name = getInstanceName(entry, idFields, type.elemID.typeName) ?? defaultName
  const parentName = parent && nestName ? parent.elemID.name : undefined
  const adapterName = type.elemID.adapter
  const naclName = getInstanceNaclName({
    entry,
    name,
    parentName,
    adapterName,
    getElemIdFunc,
    serviceIdField,
    typeElemId: type.elemID,
    nameMapping,
  })

  const filePath = getInstanceFilePath({
    fileNameFields,
    entry,
    naclName,
    typeName: type.elemID.name,
    isSettingType: type.isSettings,
    nameMapping,
    adapterName,
  })

  return new InstanceElement(
    type.isSettings ? ElemID.CONFIG_NAME : naclName,
    type,
    entryData !== undefined ? await removeNullValues(entryData, type) : {},
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
