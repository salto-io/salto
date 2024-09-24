/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Element,
  isInstanceElement,
  ElemID,
  ReferenceExpression,
  CORE_ANNOTATIONS,
  ReadOnlyElementsSource,
  isObjectType,
  getChangeData,
  InstanceElement,
  ObjectType,
} from '@salto-io/adapter-api'
import { extendGeneratedDependencies, transformElement, TransformFunc } from '@salto-io/adapter-utils'
import { resolveValues } from '@salto-io/adapter-components'
import _ from 'lodash'
import { collections, values } from '@salto-io/lowerdash'
import osPath from 'path'
import { constants as bufferConstants } from 'buffer'
import { logger } from '@salto-io/logging'
import { SCRIPT_ID, PATH, FILE_CABINET_PATH_SEPARATOR } from '../constants'
import { LocalFilterCreator } from '../filter'
import {
  isCustomRecordType,
  isStandardType,
  isFileCabinetType,
  isFileInstance,
  isFileCabinetInstance,
  isCustomFieldName,
} from '../types'
import { ElemServiceID, LazyElementsSourceIndexes, ServiceIdRecords } from '../elements_source_index/types'
import { captureServiceIdInfo, getServiceIdsToElemIds, ServiceIdInfo } from '../service_id_info'
import { isSdfCreateOrUpdateGroupId } from '../group_changes'
import { getLookUpName } from '../transformer'
import { getGroupItemFromRegex } from '../client/utils'
import { getContent } from '../client/suiteapp_client/suiteapp_file_cabinet'
import { NetsuiteConfig } from '../config/types'

const { awu } = collections.asynciterable
const { isDefined } = values
const log = logger(module)
const NETSUITE_MODULE_PREFIX = 'N/'
const OPTIONAL_REFS = 'optionalReferences'
const SUITE_SCRIPT_FILE_EXTENSIONS = ['.js', '.cjs', '.mjs', '.json', '.ts']

// matches strings in single/double quotes (paths and scriptids) where the apostrophes aren't a part of a word
// e.g: 'custrecord1' "./someFolder/someScript.js"
const semanticReferenceRegex = new RegExp(`("|')(?<${OPTIONAL_REFS}>.*?)\\1`, 'gm')
// matches lines which start with '*' than a string with '@N' prefix
// followed by a space and another string , e.g: "* @NAmdConfig ./utils/ToastDalConfig.json"'
const nsConfigRegex = new RegExp(`\\*\\s@N\\w+\\s+(?<${OPTIONAL_REFS}>.*)`, 'gm')
const pathPrefixRegex = new RegExp(
  `^${FILE_CABINET_PATH_SEPARATOR}|^\\.${FILE_CABINET_PATH_SEPARATOR}|^\\.\\.${FILE_CABINET_PATH_SEPARATOR}`,
  'm',
)
// matches object keys (e.g `key: value`)
const mappedReferenceRegex = new RegExp(`\\b(?<${OPTIONAL_REFS}>\\w+)\\s*:\\s*\\S`, 'gm')
// matches comments in js files
// \\/\\*[\\s\\S]*?\\*\\/ - matches multiline comments by matching the first '/*' and the last '*/' and any character including newlines
// ^\\s*\\/\\/.* - matches single line comments that start with '//'
// (?<=[^:])\\/\\/.* - This prevents matching URLs that contain // by checking they are not preceded by a colon.
const jsCommentsRegex = new RegExp('\\/\\*[\\s\\S]*?\\*\\/|^\\s*\\/\\/.*|(?<=[^:])\\/\\/.*', 'gm')

const shouldExtractToGeneratedDependency = (serviceIdInfoRecord: ServiceIdInfo): boolean =>
  serviceIdInfoRecord.appid !== undefined ||
  serviceIdInfoRecord.bundleid !== undefined ||
  !serviceIdInfoRecord.isFullMatch

const getReferencesWithRegex = (filePath: string, content: string): string[] =>
  log.timeDebug(
    () => {
      const contentWithoutComments = content.replace(jsCommentsRegex, '')
      const objectKeyReferences = getGroupItemFromRegex(contentWithoutComments, mappedReferenceRegex, OPTIONAL_REFS)
      const semanticReferences = getGroupItemFromRegex(
        contentWithoutComments,
        semanticReferenceRegex,
        OPTIONAL_REFS,
      ).filter(path => !path.startsWith(NETSUITE_MODULE_PREFIX))
      return semanticReferences.concat(objectKeyReferences)
    },
    'getting references using regex from %s',
    filePath,
  )

export const getElementServiceIdRecords = async (
  element: Element,
  elementsSource?: ReadOnlyElementsSource,
): Promise<ServiceIdRecords> => {
  if (element.annotations[CORE_ANNOTATIONS.HIDDEN]) {
    return {}
  }
  if (isInstanceElement(element)) {
    if (isStandardType(element.refType)) {
      return getServiceIdsToElemIds(element)
    }
    if (isFileCabinetType(element.refType)) {
      const path = element.value[PATH]
      return {
        [path]: {
          elemID: element.elemID.createNestedID(PATH),
          serviceID: path,
        },
      }
    }
    const type = await element.getType(elementsSource)
    if (isCustomRecordType(type)) {
      return {
        [`${type.annotations[SCRIPT_ID]}.${element.value[SCRIPT_ID]}`]: {
          elemID: element.elemID.createNestedID(SCRIPT_ID),
          serviceID: element.value[SCRIPT_ID],
        },
      }
    }
  }
  if (isObjectType(element) && isCustomRecordType(element)) {
    return getServiceIdsToElemIds(element)
  }
  return {}
}

const generateServiceIdToElemID = async (elements: Element[]): Promise<ServiceIdRecords> =>
  awu(elements)
    .map(elem => getElementServiceIdRecords(elem))
    .reduce<ServiceIdRecords>((acc, records) => Object.assign(acc, records), {})

const resolveRelativePath = (absolutePath: string, relativePath: string): string =>
  osPath.resolve(osPath.dirname(absolutePath), relativePath)

const getServiceElemIDsFromPaths = (
  foundReferences: string[],
  serviceIdToElemID: ServiceIdRecords,
  customRecordFieldsToServiceIds: ServiceIdRecords,
  filePath: string,
): ElemID[] =>
  foundReferences
    .flatMap(ref => {
      const absolutePath = pathPrefixRegex.test(ref)
        ? resolveRelativePath(filePath, ref)
        : FILE_CABINET_PATH_SEPARATOR.concat(ref)
      return [ref, absolutePath].concat(
        osPath.extname(absolutePath) === '' && osPath.extname(filePath) !== ''
          ? [absolutePath.concat(osPath.extname(filePath))]
          : [],
      )
    })
    .map(ref => {
      const serviceIdRecord = serviceIdToElemID[ref]
      if (_.isPlainObject(serviceIdRecord)) {
        return serviceIdRecord.elemID
      }
      if (_.isPlainObject(customRecordFieldsToServiceIds[ref])) {
        return customRecordFieldsToServiceIds[ref].elemID
      }
      return undefined
    })
    .filter(isDefined)

const hasValidExtension = (path: string, config: NetsuiteConfig): boolean => {
  const validExtensions = SUITE_SCRIPT_FILE_EXTENSIONS.concat(config.fetch?.findReferencesInFilesWithExtension ?? [])
  return validExtensions.some(ext => path.toLowerCase().endsWith(ext))
}

const getAndLogReferencesDiff = ({
  filePath,
  newReferences,
  existingReferences,
  serviceIdToElemID,
  customRecordFieldsToServiceIds,
}: {
  filePath: string
  newReferences: string[]
  existingReferences: string[]
  serviceIdToElemID: ServiceIdRecords
  customRecordFieldsToServiceIds: ServiceIdRecords
}): void => {
  const newFoundReferences = _.difference(newReferences, existingReferences)
  const removedReferences = _.difference(existingReferences, newReferences)
  const newReferencesElemIDs = getServiceElemIDsFromPaths(
    newFoundReferences,
    serviceIdToElemID,
    customRecordFieldsToServiceIds,
    filePath,
  )
  const removedReferencesElemIDs = getServiceElemIDsFromPaths(
    removedReferences,
    serviceIdToElemID,
    customRecordFieldsToServiceIds,
    filePath,
  )
  if (newReferencesElemIDs.length > 0 || removedReferencesElemIDs.length > 0) {
    log.info(
      'Found %d new references: %o and removed %d references: %o in file %s.',
      newReferencesElemIDs.length,
      newReferencesElemIDs,
      removedReferencesElemIDs.length,
      removedReferencesElemIDs,
      filePath,
    )
  }
}

const calculateNewReferencesInSuiteScripts = ({
  filePath,
  content,
  existingReferences,
  serviceIdToElemID,
  customRecordFieldsToServiceIds,
}: {
  filePath: string
  content: string
  existingReferences: string[]
  serviceIdToElemID: ServiceIdRecords
  customRecordFieldsToServiceIds: ServiceIdRecords
}): void => {
  try {
    const newReferences = getReferencesWithRegex(filePath, content)
    getAndLogReferencesDiff({
      filePath,
      newReferences,
      existingReferences,
      serviceIdToElemID,
      customRecordFieldsToServiceIds,
    })
  } catch (e) {
    log.error('Failed extracting references from file %s with error: %o', filePath, e)
  }
}

const getSuiteScriptReferences = async (
  element: InstanceElement,
  serviceIdToElemID: ServiceIdRecords,
  customRecordFieldsToServiceIds: ServiceIdRecords,
  config: NetsuiteConfig,
  skippedFileExtensions: Set<string>,
): Promise<ElemID[]> => {
  const filePath = element.value[PATH]
  const fileContent = await getContent(element.value.content)

  if (fileContent.length > bufferConstants.MAX_STRING_LENGTH) {
    log.warn('skip parsing file with size larger than MAX_STRING_LENGTH: %o', {
      fileSize: fileContent.length,
      MAX_STRING_LENGTH: bufferConstants.MAX_STRING_LENGTH,
    })
    return []
  }

  const content = fileContent.toString()

  const nsConfigReferences = getGroupItemFromRegex(content, nsConfigRegex, OPTIONAL_REFS)
  const semanticReferences = getGroupItemFromRegex(content, semanticReferenceRegex, OPTIONAL_REFS).filter(
    path => !path.startsWith(NETSUITE_MODULE_PREFIX),
  )

  const foundReferences = getServiceElemIDsFromPaths(
    semanticReferences.concat(nsConfigReferences),
    serviceIdToElemID,
    customRecordFieldsToServiceIds,
    filePath,
  )

  if (!hasValidExtension(filePath, config)) {
    skippedFileExtensions.add(osPath.extname(filePath))
    if (foundReferences.length > 0) {
      log.info(
        'Ignoring file with unsupported extension %s and %d references will be removed: %o',
        filePath,
        foundReferences.length,
        foundReferences,
      )
    }
  } else if (config.fetch.calculateNewReferencesInSuiteScripts) {
    calculateNewReferencesInSuiteScripts({
      filePath,
      content,
      serviceIdToElemID,
      customRecordFieldsToServiceIds,
      existingReferences: semanticReferences,
    })
  }

  return foundReferences
}

const replaceReferenceValues = async (
  element: Element,
  serviceIdToElemID: ServiceIdRecords,
  customRecordFieldsToServiceIds: ServiceIdRecords,
  config: NetsuiteConfig,
  skippedFileExtensions: Set<string>,
): Promise<Element> => {
  const dependenciesToAdd: Array<ElemID> = []
  const replacePrimitive: TransformFunc = ({ path, value }) => {
    if (!_.isString(value)) {
      return value
    }
    const serviceIdInfo = captureServiceIdInfo(value)
    let returnValue: ReferenceExpression | string = value
    serviceIdInfo.forEach(serviceIdInfoRecord => {
      const { serviceId, type } = serviceIdInfoRecord
      const serviceIdRecord = serviceIdToElemID[serviceId]

      if (serviceIdRecord === undefined) {
        return
      }

      const { elemID, serviceID } = serviceIdRecord
      if (type && type !== elemID.typeName) {
        dependenciesToAdd.push(elemID)
        return
      }

      if (path?.isAttrID() && path.createParentID().name === CORE_ANNOTATIONS.PARENT) {
        if (!shouldExtractToGeneratedDependency(serviceIdInfoRecord)) {
          returnValue = new ReferenceExpression(elemID.createBaseID().parent)
          return
        }
        dependenciesToAdd.push(elemID.createBaseID().parent)
        return
      }
      if (!shouldExtractToGeneratedDependency(serviceIdInfoRecord)) {
        returnValue = new ReferenceExpression(elemID, serviceID)
        return
      }
      dependenciesToAdd.push(elemID)
    })

    return returnValue
  }

  const newElement = await transformElement({
    element,
    transformFunc: replacePrimitive,
    strict: false,
  })

  const suiteScriptReferences =
    isFileCabinetInstance(element) && isFileInstance(element)
      ? await getSuiteScriptReferences(
          element,
          serviceIdToElemID,
          customRecordFieldsToServiceIds,
          config,
          skippedFileExtensions,
        )
      : []

  extendGeneratedDependencies(
    newElement,
    dependenciesToAdd.concat(suiteScriptReferences).map(elemID => ({ reference: new ReferenceExpression(elemID) })),
  )

  return newElement
}

const createElementsSourceServiceIdToElemID = async (
  elementsSourceIndex: LazyElementsSourceIndexes,
  isPartial: boolean,
): Promise<ServiceIdRecords> => ({
  ...(isPartial ? (await elementsSourceIndex.getIndexes()).serviceIdRecordsIndex : {}),
})

const applyValuesAndAnnotationsToElement = (element: Element, newElement: Element): void => {
  if (isInstanceElement(element) && isInstanceElement(newElement)) {
    element.value = newElement.value
  }
  if (isObjectType(element) && isObjectType(newElement)) {
    Object.entries(newElement.fields).forEach(([fieldName, field]) => {
      if (element.fields[fieldName]) {
        element.fields[fieldName].annotations = field.annotations
      }
    })
  }
  element.annotations = newElement.annotations
}

export const extractCustomRecordFields = (customRecordType: ObjectType): ElemServiceID[] =>
  Object.values(customRecordType.fields)
    .filter(field => isCustomFieldName(field.name))
    .filter(field => {
      if (field.annotations[SCRIPT_ID] === undefined) {
        log.warn('custom field %s is missing a scriptid annotation', field.elemID.getFullName())
        return false
      }
      return true
    })
    .map(field => ({ serviceID: field.annotations[SCRIPT_ID], elemID: field.elemID.createNestedID(SCRIPT_ID) }))

const createCustomRecordFieldsToElemID = (elements: Element[]): ServiceIdRecords =>
  _.keyBy(elements.filter(isObjectType).filter(isCustomRecordType).flatMap(extractCustomRecordFields), 'serviceID')

const createElementsSourceCustomRecordFieldsToElemID = async (
  elementsSourceIndex: LazyElementsSourceIndexes,
  isPartial: boolean,
): Promise<ServiceIdRecords> =>
  isPartial ? (await elementsSourceIndex.getIndexes()).customRecordFieldsServiceIdRecordsIndex : {}

const filterCreator: LocalFilterCreator = ({ elementsSourceIndex, isPartial, changesGroupId, config }) => ({
  name: 'replaceElementReferences',
  onFetch: async elements => {
    const serviceIdToElemID = Object.assign(
      await createElementsSourceServiceIdToElemID(elementsSourceIndex, isPartial),
      await generateServiceIdToElemID(elements),
    )
    const customRecordFieldsToServiceIds = Object.assign(
      createCustomRecordFieldsToElemID(elements),
      await createElementsSourceCustomRecordFieldsToElemID(elementsSourceIndex, isPartial),
    )
    const skippedFileExtensions = new Set<string>()
    await awu(elements)
      .filter(element => isInstanceElement(element) || (isObjectType(element) && isCustomRecordType(element)))
      .forEach(async element => {
        const newElement = await replaceReferenceValues(
          element,
          serviceIdToElemID,
          customRecordFieldsToServiceIds,
          config,
          skippedFileExtensions,
        )
        applyValuesAndAnnotationsToElement(element, newElement)
      })
    if (skippedFileExtensions.size > 0) {
      log.info('Ignored files with unsupported extensions: %o', Array.from(skippedFileExtensions))
    }
  },
  preDeploy: async changes => {
    if (!changesGroupId || !isSdfCreateOrUpdateGroupId(changesGroupId)) {
      return
    }
    await awu(changes)
      .map(getChangeData)
      .forEach(async element => {
        const newElement = await resolveValues(element, getLookUpName)
        applyValuesAndAnnotationsToElement(element, newElement)
      })
  },
})

export default filterCreator
