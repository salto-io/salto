/*
*                      Copyright 2020 Salto Labs Ltd.
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
  ElemID, Field, InstanceElement, isPrimitiveType, ObjectType, PrimitiveType,
  PrimitiveTypes, Values, isObjectType, isPrimitiveValue, StaticFile, ElemIdGetter,
  ADAPTER, OBJECT_SERVICE_ID, OBJECT_NAME, toServiceIdsString, ServiceIds, isInstanceElement,
} from '@salto-io/adapter-api'
import { MapKeyFunc, mapKeysRecursive, TransformFunc, transformValues, GetLookupNameFunc, naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import {
  ADDRESS_FORM, ENTRY_FORM, TRANSACTION_FORM, IS_ATTRIBUTE, NETSUITE, RECORDS_PATH,
  SCRIPT_ID, ADDITIONAL_FILE_SUFFIX, FILE, FILE_CABINET_PATH, PATH, FILE_CABINET_PATH_SEPARATOR,
} from './constants'
import {
  ATTRIBUTE_PREFIX, CDATA_TAG_NAME, CustomizationInfo, TemplateCustomTypeInfo,
  isTemplateCustomTypeInfo, isFileCustomizationInfo, FileCustomizationInfo,
  FolderCustomizationInfo, isFolderCustomizationInfo, CustomTypeInfo,
} from './client/client'
import { fieldTypes } from './types/field_types'
import { customTypes, fileCabinetTypes, isCustomType, isFileCabinetType } from './types'

const { awu } = collections.asynciterable

const XML_TRUE_VALUE = 'T'
const XML_FALSE_VALUE = 'F'

// FileCabinet instance path might start with '.' and we can't have NaCLs with that prefix as we
// don't load hidden files to the workspace in the core.
const removeDotPrefix = (name: string): string => name.replace(/^\.+/, '_')

export const createInstanceElement = async (customizationInfo: CustomizationInfo, type: ObjectType,
  getElemIdFunc?: ElemIdGetter): Promise<InstanceElement> => {
  const getInstanceName = (transformedValues: Values): string => {
    if (!isCustomType(type.elemID) && !isFileCabinetType(type.elemID)) {
      throw new Error(`Failed to getInstanceName for unknown type: ${type.elemID.name}`)
    }
    const serviceIdFieldName = isCustomType(type.elemID) ? SCRIPT_ID : PATH
    const serviceIds: ServiceIds = {
      [ADAPTER]: NETSUITE,
      [serviceIdFieldName]: transformedValues[serviceIdFieldName],
      [OBJECT_SERVICE_ID]: toServiceIdsString({
        [ADAPTER]: NETSUITE,
        [OBJECT_NAME]: type.elemID.getFullName(),
      }),
    }
    const desiredName = naclCase(transformedValues[serviceIdFieldName]
      .replace(new RegExp(`^${FILE_CABINET_PATH_SEPARATOR}`), ''))
    return getElemIdFunc ? getElemIdFunc(NETSUITE, serviceIds, desiredName).name : desiredName
  }

  const getInstancePath = (instanceName: string): string[] =>
    (isFolderCustomizationInfo(customizationInfo) || isFileCustomizationInfo(customizationInfo)
      ? [NETSUITE, FILE_CABINET_PATH, ...customizationInfo.path.map(removeDotPrefix)]
      : [NETSUITE, RECORDS_PATH, type.elemID.name, instanceName])

  const transformPrimitive: TransformFunc = async ({ value, field }) => {
    const fieldType = await field?.getType()
    if (!isPrimitiveType(fieldType) || !isPrimitiveValue(value)) {
      return value
    }

    // We sometimes get empty strings that we want to filter out
    if (value === '') {
      return undefined
    }

    switch (fieldType.primitive) {
      case PrimitiveTypes.NUMBER:
        return Number(value)
      case PrimitiveTypes.BOOLEAN:
        return value === XML_TRUE_VALUE
      case PrimitiveTypes.UNKNOWN:
        return value
      default:
        return String(value)
    }
  }

  const transformAttributeKey: MapKeyFunc = ({ key }) =>
    (key.startsWith(ATTRIBUTE_PREFIX) ? key.slice(ATTRIBUTE_PREFIX.length) : key)

  const valuesWithTransformedAttrs = mapKeysRecursive(customizationInfo.values,
    transformAttributeKey)

  const fileContentField = await awu(Object.values(type.fields))
    .find(async f => {
      const fType = await f.getType()
      return isPrimitiveType(fType) && fType.isEqual(fieldTypes.fileContent)
    })

  if (isFolderCustomizationInfo(customizationInfo) || isFileCustomizationInfo(customizationInfo)) {
    valuesWithTransformedAttrs[PATH] = FILE_CABINET_PATH_SEPARATOR
      + customizationInfo.path.join(FILE_CABINET_PATH_SEPARATOR)
    if (isFileCustomizationInfo(customizationInfo)) {
      valuesWithTransformedAttrs[(fileContentField as Field).name] = new StaticFile({
        filepath: `${NETSUITE}/${FILE_CABINET_PATH}/${customizationInfo.path.join('/')}`,
        content: customizationInfo.fileContent,
      })
    }
  }

  const instanceName = getInstanceName(valuesWithTransformedAttrs)
  const instanceFileName = pathNaclCase(instanceName)
  if (fileContentField && isTemplateCustomTypeInfo(customizationInfo)) {
    valuesWithTransformedAttrs[fileContentField.name] = new StaticFile({
      filepath: `${NETSUITE}/${type.elemID.name}/${instanceFileName}.${customizationInfo.fileExtension}`,
      content: customizationInfo.fileContent,
    })
  }

  const transformedValues = await transformValues({
    values: valuesWithTransformedAttrs,
    type,
    transformFunc: transformPrimitive,
  }) as Values
  return new InstanceElement(
    instanceName,
    type,
    transformedValues,
    getInstancePath(instanceFileName)
  )
}

export const restoreAttributes = async (values: Values, type: ObjectType, instancePath: ElemID):
  Promise<Values> => {
  const allAttributesPaths = new Set<string>()
  const createPathSetCallback: TransformFunc = ({ value, field, path }) => {
    if (path && field && field.annotations[IS_ATTRIBUTE]) {
      allAttributesPaths.add(path.getFullName())
    }
    return value
  }

  await transformValues({
    values,
    type,
    transformFunc: createPathSetCallback,
    pathID: instancePath,
    strict: false,
  })

  const restoreAttributeFunc: MapKeyFunc = ({ key, pathID }) => {
    if (pathID && allAttributesPaths.has(pathID.getFullName())) {
      return ATTRIBUTE_PREFIX + key
    }
    return key
  }

  return mapKeysRecursive(values, restoreAttributeFunc, instancePath)
}

const sortValuesBasedOnType = async (
  typeName: string, values: Values, instancePath: ElemID
): Promise<Values> => {
  // we use customTypes[typeName] and not instance.type since it preserves fields order
  const topLevelType = customTypes[typeName]

  const sortValues: TransformFunc = async ({ field, value, path }) => {
    const type = await field?.getType()
      ?? (path && path.isEqual(instancePath) ? topLevelType : undefined)
    if (isObjectType(type) && _.isPlainObject(value)) {
      const fieldsOrder = Object.keys(type.fields)
      return _.fromPairs(fieldsOrder
        .map(fieldName => [fieldName, value[fieldName]])
        .filter(([_fieldName, val]) => !_.isUndefined(val)))
    }
    return value
  }

  return (await transformValues(
    { type: topLevelType, values, transformFunc: sortValues, pathID: instancePath, strict: true }
  )) ?? {}
}

// According to https://{account_id}.app.netsuite.com/app/help/helpcenter.nl?fid=section_1497980303.html
// there are types that their instances XMLs should be sent in a predefined order
const shouldSortValues = (typeName: string): boolean =>
  [ADDRESS_FORM, ENTRY_FORM, TRANSACTION_FORM].includes(typeName)

export const toCustomizationInfo = async (
  instance: InstanceElement
): Promise<CustomizationInfo> => {
  const transformPrimitive: TransformFunc = async ({ value, field }) => {
    const fieldType = await field?.getType()
    if (!isPrimitiveType(fieldType)) {
      return value
    }
    if (fieldType.primitive === PrimitiveTypes.BOOLEAN) {
      return value ? XML_TRUE_VALUE : XML_FALSE_VALUE
    }
    if (fieldType.isEqual(fieldTypes.cdata as PrimitiveType)) {
      return { [CDATA_TAG_NAME]: value }
    }
    if (fieldType.isEqual(fieldTypes.fileContent as PrimitiveType)) {
      return value
    }
    return String(value)
  }
  const instanceType = await instance.getType()
  const transformedValues = (await transformValues({
    values: instance.value,
    type: instanceType,
    transformFunc: transformPrimitive,
  })) ?? {}

  const typeName = instance.refType.elemID.name

  const sortedValues = shouldSortValues(typeName)
    ? await sortValuesBasedOnType(typeName, transformedValues, instance.elemID)
    : transformedValues

  const values = await restoreAttributes(sortedValues, instanceType, instance.elemID)

  const fileContentField = await awu(Object.values(instanceType.fields))
    .find(async f => {
      const fType = await f.getType()
      return isPrimitiveType(fType) && fType.isEqual(fieldTypes.fileContent)
    })

  if (isFileCabinetType(instance.refType.elemID)) {
    const path = values[PATH].split(FILE_CABINET_PATH_SEPARATOR).slice(1)
    delete values[PATH]
    if (instanceType.elemID.isEqual(fileCabinetTypes[FILE].elemID)) {
      const contentFieldName = (fileContentField as Field).name
      const fileContent = values[contentFieldName]
      delete values[contentFieldName]
      return { typeName, values, fileContent, path } as FileCustomizationInfo
    }
    return { typeName, values, path } as FolderCustomizationInfo
  }

  const scriptId = instance.value[SCRIPT_ID]
  // Template Custom Type
  if (!_.isUndefined(fileContentField) && !_.isUndefined(values[fileContentField.name])
    && isCustomType(instance.refType.elemID)) {
    const fileContent = values[fileContentField.name]
    delete values[fileContentField.name]
    return {
      typeName,
      values,
      scriptId,
      fileContent,
      fileExtension: fileContentField.annotations[ADDITIONAL_FILE_SUFFIX],
    } as TemplateCustomTypeInfo
  }
  return { typeName, values, scriptId } as CustomTypeInfo
}

export const serviceId = (instance: InstanceElement): string =>
  instance.value[isCustomType(instance.refType.elemID) ? SCRIPT_ID : PATH]

const getScriptIdParts = (topLevelParent: InstanceElement, elemId: ElemID): string[] => {
  if (elemId.isTopLevel()) {
    return [topLevelParent.value[SCRIPT_ID]]
  }
  const relativePath = elemId.createTopLevelParentID().path
  const value = _.get(topLevelParent.value, relativePath)
  if (_.has(value, SCRIPT_ID)) {
    return [...getScriptIdParts(topLevelParent, elemId.createParentID()), value[SCRIPT_ID]]
  }
  return getScriptIdParts(topLevelParent, elemId.createParentID())
}

export const getLookUpName: GetLookupNameFunc = ({ ref }) => {
  const { elemID, value, topLevelParent } = ref
  if (!isInstanceElement(topLevelParent)) {
    return value
  }
  if (isFileCabinetType(topLevelParent.refType.elemID) && elemID.name === PATH) {
    return `[${value}]`
  }
  if (isCustomType(topLevelParent.refType.elemID) && elemID.name === SCRIPT_ID) {
    return `[${SCRIPT_ID}=${getScriptIdParts(topLevelParent, elemID).join('.')}]`
  }
  return value
}
