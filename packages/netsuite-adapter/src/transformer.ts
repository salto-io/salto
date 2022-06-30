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
import {
  ElemID, Field, InstanceElement, isPrimitiveType, ObjectType,
  PrimitiveTypes, Values, isObjectType, isPrimitiveValue, StaticFile, ElemIdGetter,
  OBJECT_SERVICE_ID, OBJECT_NAME, toServiceIdsString, ServiceIds,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { MapKeyFunc, mapKeysRecursive, TransformFunc, transformValues, GetLookupNameFunc, naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import {
  ADDRESS_FORM, ENTRY_FORM, TRANSACTION_FORM, IS_ATTRIBUTE, NETSUITE, RECORDS_PATH,
  SCRIPT_ID, ADDITIONAL_FILE_SUFFIX, FILE, FILE_CABINET_PATH, PATH, FILE_CABINET_PATH_SEPARATOR,
  LAST_FETCH_TIME,
  APPLICATION_ID,
  SETTINGS_PATH,
} from './constants'
import { fieldTypes } from './types/field_types'
import { isSDFConfigType, isCustomType, isFileCabinetType } from './types'
import { isFileCustomizationInfo, isFolderCustomizationInfo, isTemplateCustomTypeInfo } from './client/utils'
import { CustomizationInfo, CustomTypeInfo, FileCustomizationInfo, FolderCustomizationInfo, TemplateCustomTypeInfo } from './client/types'
import { ATTRIBUTE_PREFIX, CDATA_TAG_NAME } from './client/constants'

const { awu } = collections.asynciterable

const XML_TRUE_VALUE = 'T'
const XML_FALSE_VALUE = 'F'
const toXmlBoolean = (value: boolean): string => (value ? XML_TRUE_VALUE : XML_FALSE_VALUE)

// FileCabinet instance path might start with '.' and we can't have NaCLs with that prefix as we
// don't load hidden files to the workspace in the core.
const removeDotPrefix = (name: string): string => name.replace(/^\.+/, '_')

export const getServiceId = (instance: InstanceElement): string =>
  instance.value[isCustomType(instance.refType) ? SCRIPT_ID : PATH]

export const createInstanceElement = async (
  customizationInfo: CustomizationInfo,
  type: ObjectType,
  getElemIdFunc?: ElemIdGetter,
  fetchTime?: Date,
  serverTimeInstance?: InstanceElement,
): Promise<InstanceElement> => {
  const getInstanceName = (transformedValues: Values): string => {
    if (isSDFConfigType(type)) {
      return ElemID.CONFIG_NAME
    }
    if (!isCustomType(type) && !isFileCabinetType(type)) {
      throw new Error(`Failed to getInstanceName for unknown type: ${type.elemID.name}`)
    }
    const serviceIdFieldName = isCustomType(type) ? SCRIPT_ID : PATH
    const serviceIds: ServiceIds = {
      [serviceIdFieldName]: transformedValues[serviceIdFieldName],
      [OBJECT_SERVICE_ID]: toServiceIdsString({
        [OBJECT_NAME]: type.elemID.getFullName(),
      }),
    }
    const desiredName = naclCase(transformedValues[serviceIdFieldName]
      .replace(new RegExp(`^${FILE_CABINET_PATH_SEPARATOR}`), ''))
    return getElemIdFunc ? getElemIdFunc(NETSUITE, serviceIds, desiredName).name : desiredName
  }

  const getInstancePath = (instanceName: string): string[] => {
    if (isFileCustomizationInfo(customizationInfo)) {
      return [NETSUITE, FILE_CABINET_PATH, ...customizationInfo.path.map(removeDotPrefix)]
    }
    if (isFolderCustomizationInfo(customizationInfo)) {
      const origFolderPathParts = customizationInfo.path.map(removeDotPrefix)
      const folderName = origFolderPathParts[origFolderPathParts.length - 1]
      // We want folder instances to sit inside their own folder,
      // e.g. "/FileCabinet/SuiteScripts/MyFolder/MyFolder.nacl"
      return [NETSUITE, FILE_CABINET_PATH, ...origFolderPathParts, folderName]
    }
    if (isSDFConfigType(type)) {
      return [NETSUITE, SETTINGS_PATH, type.elemID.name]
    }
    return [NETSUITE, RECORDS_PATH, type.elemID.name, instanceName]
  }

  const transformPrimitive: TransformFunc = async ({ value, field }) => {
    const fieldType = await field?.getType()
    if (value === '') {
      // We sometimes get empty strings that we want to filter out
      return undefined
    }
    if (!isPrimitiveType(fieldType) || !isPrimitiveValue(value)) {
      if (value === XML_TRUE_VALUE) return true
      if (value === XML_FALSE_VALUE) return false
      return value
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
    if (isFileCustomizationInfo(customizationInfo) && customizationInfo.fileContent !== undefined) {
      valuesWithTransformedAttrs[(fileContentField as Field).name] = new StaticFile({
        filepath: `${NETSUITE}/${FILE_CABINET_PATH}/${customizationInfo.path.map(removeDotPrefix).join('/')}`,
        content: customizationInfo.fileContent,
      })
    }
  }

  const instanceName = getInstanceName(valuesWithTransformedAttrs)
  const instanceFileName = pathNaclCase(instanceName)
  if (fileContentField && isTemplateCustomTypeInfo(customizationInfo)
    && customizationInfo.fileContent !== undefined) {
    valuesWithTransformedAttrs[fileContentField.name] = new StaticFile({
      filepath: `${NETSUITE}/${type.elemID.name}/${instanceFileName}.${customizationInfo.fileExtension}`,
      content: customizationInfo.fileContent,
    })
  }
  const instance = new InstanceElement(
    instanceName,
    type,
    await transformValues({
      values: valuesWithTransformedAttrs,
      type,
      transformFunc: transformPrimitive,
      strict: false,
    }) as Values,
    getInstancePath(instanceFileName),
  )
  if (fetchTime !== undefined && serverTimeInstance !== undefined) {
    serverTimeInstance.value.instancesFetchTime[getServiceId(instance)] = fetchTime.toJSON()
  }
  return instance
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

// According to https://{account_id}.app.netsuite.com/app/help/helpcenter.nl?fid=section_1497980303.html
// there are types that their instances XMLs should be sent in a predefined order
const TYPES_TO_SORT = [ADDRESS_FORM, ENTRY_FORM, TRANSACTION_FORM]

const sortValuesBasedOnType = async (
  topLevelType: ObjectType, values: Values, instancePath: ElemID
): Promise<Values> => {
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
    { type: topLevelType, values, transformFunc: sortValues, pathID: instancePath, strict: false }
  )) ?? {}
}

export const toCustomizationInfo = async (
  instance: InstanceElement
): Promise<CustomizationInfo> => {
  const transformPrimitive: TransformFunc = async ({ value, field }) => {
    if (_.isBoolean(value)) {
      return toXmlBoolean(value)
    }
    if (!isPrimitiveValue(value) && !Buffer.isBuffer(value)) {
      return value
    }
    const fieldType = await field?.getType()
    if (fieldType?.elemID.isEqual(fieldTypes.cdata.elemID)) {
      return { [CDATA_TAG_NAME]: value }
    }
    if (fieldType?.elemID.isEqual(fieldTypes.fileContent.elemID)) {
      return value
    }
    return String(value)
  }
  const instanceType = await instance.getType()
  const transformedValues = (await transformValues({
    values: instance.value,
    type: instanceType,
    transformFunc: transformPrimitive,
    strict: false,
  })) ?? {}

  const typeName = instance.refType.elemID.name
  const sortedValues = TYPES_TO_SORT.includes(typeName)
    ? await sortValuesBasedOnType(await instance.getType(), transformedValues, instance.elemID)
    : transformedValues

  const values = await restoreAttributes(sortedValues, instanceType, instance.elemID)

  if (isSDFConfigType(instance.refType)) {
    return { typeName, values }
  }

  const fileContentField = await awu(Object.values(instanceType.fields))
    .find(async f => {
      const fType = await f.getType()
      return isPrimitiveType(fType) && fType.isEqual(fieldTypes.fileContent)
    })

  if (isFileCabinetType(instance.refType)) {
    const path = values[PATH].split(FILE_CABINET_PATH_SEPARATOR).slice(1)
    delete values[PATH]
    if (instanceType.elemID.isEqual(new ElemID(NETSUITE, FILE))) {
      const contentFieldName = (fileContentField as Field).name
      const fileContent = values[contentFieldName]
      delete values[contentFieldName]
      return { typeName, values, fileContent, path } as FileCustomizationInfo
    }
    return { typeName, values, path } as FolderCustomizationInfo
  }

  delete values[LAST_FETCH_TIME]
  delete values[APPLICATION_ID]

  const scriptId = instance.value[SCRIPT_ID]
  // Template Custom Type
  if (!_.isUndefined(fileContentField) && !_.isUndefined(values[fileContentField.name])
    && isCustomType(instance.refType)) {
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
  if (isFileCabinetType(topLevelParent.refType) && elemID.name === PATH) {
    return `[${value}]`
  }
  if (isCustomType(topLevelParent.refType) && elemID.name === SCRIPT_ID) {
    return `[${SCRIPT_ID}=${getScriptIdParts(topLevelParent, elemID).join('.')}]`
  }
  return value
}
