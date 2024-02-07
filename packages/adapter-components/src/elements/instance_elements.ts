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
import _, { isEmpty } from 'lodash'
import {
  InstanceElement, Values, ObjectType, ReferenceExpression, CORE_ANNOTATIONS, ElemID,
  ElemIdGetter,
} from '@salto-io/adapter-api'
import { pathNaclCase, naclCase, TransformFunc, TransformFuncSync, transformValuesSync } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { RECORDS_PATH, SETTINGS_NESTED_PATH } from './constants'
import { TransformationConfig, TransformationDefaultConfig, getConfigWithDefault, shouldNestFiles,
  RecurseIntoCondition, isRecurseIntoConditionByField, AdapterApiConfig, dereferenceFieldName } from '../config'
import { NameMappingOptions } from '../definitions'
import { createServiceIDs, getNameMapping } from '../fetch/element/id_utils'

const log = logger(module)

const ID_SEPARATOR = '__'

export type InstanceCreationParams = {
  entry: Values
  type: ObjectType
  transformationConfigByType: Record<string, TransformationConfig>
  transformationDefaultConfig: TransformationDefaultConfig
  defaultName: string
  nestName?: boolean
  nestedPath?: string[]
  parent?: InstanceElement
  normalized?: boolean
  getElemIdFunc?: ElemIdGetter
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
  nestedPaths,
}: {
  fileNameFields: string[] | undefined
  entry: Values
  naclName: string
  typeName: string
  isSettingType: boolean
  nameMapping?: NameMappingOptions
  adapterName: string
  nestedPaths?: string[]
}): string[] => {
  const fileNameParts = (fileNameFields !== undefined
    ? fileNameFields.map(field => _.get(entry, field))
    : undefined)
  const fileName = ((fileNameParts?.every(p => _.isString(p) || _.isNumber(p))
    ? fileNameParts.join('_')
    : undefined))
  const naclCaseFileName = fileName ? pathNaclCase(naclCase(fileName)) : pathNaclCase(naclName)
  return (isSettingType
    ? [
      adapterName,
      RECORDS_PATH,
      SETTINGS_NESTED_PATH,
      pathNaclCase(typeName),
    ]
    : [
      adapterName,
      RECORDS_PATH,
      ...(nestedPaths ? nestedPaths.map(pathNaclCase) : [pathNaclCase(typeName)]),
      nameMapping
        ? getNameMapping(naclCaseFileName, nameMapping) : naclCaseFileName,
    ])
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

export const removeNullValuesTransformFunc: TransformFuncSync = ({ value }) => (value === null ? undefined : value)

export const removeNullValues = (
  values: Values,
  type: ObjectType,
  allowEmpty = false,
): Values =>
  transformValuesSync({
    values,
    type,
    transformFunc: removeNullValuesTransformFunc,
    strict: false,
    allowEmpty,
  }) ?? {}

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
      createServiceIDs({ entry, serviceIdFields: [serviceIdField], typeID: typeElemId }),
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
  nestedPath,
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
  const entryData = transformValuesSync({
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
    nestedPaths: parent && shouldNestFiles(
      transformationDefaultConfig,
      transformationConfigByType[parent.elemID.typeName]
    ) ? nestedPath : undefined,
  })
  if (transformationConfigByType[type.elemID.name]?.standaloneFields !== undefined
    && shouldNestFiles(transformationDefaultConfig, transformationConfigByType[type.elemID.name])) {
    // if there are standalone fields and they should be nested, we nest the instance in its own folder.
    filePath.push(filePath[filePath.length - 1])
  }

  return new InstanceElement(
    type.isSettings ? ElemID.CONFIG_NAME : naclName,
    type,
    entryData !== undefined ? removeNullValues(entryData, type) : {},
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
