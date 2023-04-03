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
import { Element, isInstanceElement, ElemID, ReferenceExpression, CORE_ANNOTATIONS, ReadOnlyElementsSource, isObjectType, getChangeData, InstanceElement } from '@salto-io/adapter-api'
import { extendGeneratedDependencies, resolveValues, transformElement, TransformFunc } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { collections, values } from '@salto-io/lowerdash'
import osPath from 'path'
import { SCRIPT_ID, PATH, FILE_CABINET_PATH_SEPARATOR } from '../constants'
import { FilterCreator, FilterWith } from '../filter'
import { isCustomRecordType, isStandardType, isFileCabinetType, isFileInstance, isFileCabinetInstance } from '../types'
import { LazyElementsSourceIndexes, ServiceIdRecords } from '../elements_source_index/types'
import { captureServiceIdInfo, ServiceIdInfo } from '../service_id_info'
import { isSdfCreateOrUpdateGroupId } from '../group_changes'
import { getLookUpName } from '../transformer'
import { getGroupItemFromRegex } from '../client/utils'
import { getContent } from '../suiteapp_file_cabinet'

const { awu } = collections.asynciterable
const { isDefined } = values
const NETSUITE_MODULE_PREFIX = 'N/'
const OPTIONAL_REFS = 'optionalReferences'
// matches strings in single/double quotes (paths and scriptids) where the apostrophes aren't a part of a word
// e.g: 'custrecord1' "./someFolder/someScript.js"
const semanticReferenceRegex = new RegExp(`("|')(?<${OPTIONAL_REFS}>.*?)\\1`, 'gm')
// matches lines which start with '*' than a string with '@N' prefix
// followed by a space and another string , e.g: "* @NAmdConfig ./utils/ToastDalConfig.json"'
const nsConfigRegex = new RegExp(`\\*\\s@N\\w+\\s+(?<${OPTIONAL_REFS}>.*)`, 'gm')
const pathPrefixRegex = new RegExp(`^${FILE_CABINET_PATH_SEPARATOR}|^\\.${FILE_CABINET_PATH_SEPARATOR}|^\\.\\.${FILE_CABINET_PATH_SEPARATOR}`, 'm')

const getServiceIdsToElemIds = async (
  element: Element,
  elementsSource?: ReadOnlyElementsSource
): Promise<ServiceIdRecords> => {
  const serviceIdsToElemIds: ServiceIdRecords = {}
  const parentElemIdFullNameToServiceId: Record<string, string> = {}

  const getClosestParentServiceId = (elemID: ElemID): string | undefined => {
    const parentElemId = elemID.createParentID()
    if (parentElemId.isTopLevel()) {
      return parentElemIdFullNameToServiceId[parentElemId.getFullName()]
    }
    if (Object.keys(parentElemIdFullNameToServiceId).includes(parentElemId.getFullName())) {
      return parentElemIdFullNameToServiceId[parentElemId.getFullName()]
    }
    return getClosestParentServiceId(parentElemId)
  }

  const addFullServiceIdsCallback: TransformFunc = ({ value, path }) => {
    if (path?.name === SCRIPT_ID) {
      const parentServiceId = getClosestParentServiceId(path)
      const resolvedServiceId = _.isUndefined(parentServiceId) ? value : `${parentServiceId}.${value}`
      parentElemIdFullNameToServiceId[path.createParentID().getFullName()] = resolvedServiceId
      serviceIdsToElemIds[resolvedServiceId] = { elemID: path, serviceID: value }
    }
    return value
  }

  await transformElement({
    element,
    transformFunc: addFullServiceIdsCallback,
    strict: false,
    elementsSource,
  })
  return serviceIdsToElemIds
}

const shouldExtractToGenereatedDependency = (serviceIdInfoRecord: ServiceIdInfo): boolean =>
  serviceIdInfoRecord.appid !== undefined
  || serviceIdInfoRecord.bundleid !== undefined
  || !serviceIdInfoRecord.isFullMatch

export const getElementServiceIdRecords = async (
  element: Element,
  elementsSource?: ReadOnlyElementsSource
): Promise<ServiceIdRecords> => {
  if (isInstanceElement(element)) {
    if (isStandardType(element.refType)) {
      return getServiceIdsToElemIds(element, elementsSource)
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
    return getServiceIdsToElemIds(element, elementsSource)
  }
  return {}
}

const generateServiceIdToElemID = async (
  elements: Element[],
): Promise<ServiceIdRecords> => awu(elements)
  .map(elem => getElementServiceIdRecords(elem))
  .reduce<ServiceIdRecords>((acc, records) => Object.assign(acc, records), {})

const resolveRelativePath = (absolutePath: string, relativePath: string): string =>
  osPath.resolve(osPath.dirname(absolutePath), relativePath)

const getServiceElemIDsFromPaths = (
  foundReferences: string[],
  serviceIdToElemID: ServiceIdRecords,
  element: InstanceElement,
): ElemID[] =>
  foundReferences
    .flatMap(ref => {
      if (pathPrefixRegex.test(ref)) {
        const absolutePath = resolveRelativePath(element.value[PATH], ref)
        return [absolutePath].concat(
          osPath.extname(absolutePath) === '' && osPath.extname(element.value[PATH]) !== ''
            ? [absolutePath.concat(osPath.extname(element.value[PATH]))]
            : []
        )
      }
      return [ref]
    })
    .map(ref => {
      const serviceIdRecord = serviceIdToElemID[ref]
      if (_.isPlainObject(serviceIdRecord)) {
        return serviceIdRecord.elemID
      }
      return undefined
    })
    .filter(isDefined)


const getSuiteScriptReferences = async (
  element: InstanceElement,
  serviceIdToElemID: ServiceIdRecords,
): Promise<ElemID[]> => {
  const content = (await getContent(element.value.content)).toString()

  const nsConfigReferences = getGroupItemFromRegex(content, nsConfigRegex, OPTIONAL_REFS)
  const semanticReferences = getGroupItemFromRegex(content, semanticReferenceRegex, OPTIONAL_REFS)
    .filter(path => !path.startsWith(NETSUITE_MODULE_PREFIX))
    .concat(nsConfigReferences)

  return getServiceElemIDsFromPaths(
    semanticReferences,
    serviceIdToElemID,
    element
  )
}

const replaceReferenceValues = async (
  element: Element,
  serviceIdToElemID: ServiceIdRecords,
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
        if (!shouldExtractToGenereatedDependency(serviceIdInfoRecord)) {
          returnValue = new ReferenceExpression(elemID.createBaseID().parent)
          return
        }
        dependenciesToAdd.push(elemID.createBaseID().parent)
        return
      }
      if (!shouldExtractToGenereatedDependency(serviceIdInfoRecord)) {
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

  const suiteScriptReferences = isFileCabinetInstance(element) && isFileInstance(element)
    ? await getSuiteScriptReferences(element, serviceIdToElemID)
    : []

  extendGeneratedDependencies(
    newElement,
    dependenciesToAdd.concat(suiteScriptReferences)
      .map(elemID => ({ reference: new ReferenceExpression(elemID) }))
  )

  return newElement
}

const createElementsSourceServiceIdToElemID = async (
  elementsSourceIndex: LazyElementsSourceIndexes,
  isPartial: boolean,
): Promise<ServiceIdRecords> => (
  isPartial
    ? (await elementsSourceIndex.getIndexes()).serviceIdRecordsIndex
    : {}
)

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

const filterCreator: FilterCreator = ({
  elementsSourceIndex,
  isPartial,
  changesGroupId,
}): FilterWith<'onFetch' | 'preDeploy'> => ({
  name: 'replaceElementReferences',
  onFetch: async elements => {
    const serviceIdToElemID = Object.assign(
      await generateServiceIdToElemID(elements),
      await createElementsSourceServiceIdToElemID(elementsSourceIndex, isPartial)
    )
    await awu(elements).filter(element => isInstanceElement(element) || (
      isObjectType(element) && isCustomRecordType(element)
    )).forEach(async element => {
      const newElement = await replaceReferenceValues(
        element,
        serviceIdToElemID
      )
      applyValuesAndAnnotationsToElement(element, newElement)
    })
  },
  preDeploy: async changes => {
    if (!changesGroupId || !isSdfCreateOrUpdateGroupId(changesGroupId)) {
      return
    }
    await awu(changes).map(getChangeData).forEach(async element => {
      const newElement = await resolveValues(element, getLookUpName)
      applyValuesAndAnnotationsToElement(element, newElement)
    })
  },
})

export default filterCreator
