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
import {
  Element, isInstanceElement, ElemID, ReferenceExpression, InstanceElement, CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { transformElement, TransformFunc } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { values as lowerdashValues, collections } from '@salto-io/lowerdash'
import { SCRIPT_ID, PATH } from '../constants'
import { serviceId } from '../transformer'
import { FilterCreator, FilterWith } from '../filter'
import { isCustomType, typesElementSourceWrapper } from '../types'
import { LazyElementsSourceIndexes } from '../elements_source_index/types'

const { awu } = collections.asynciterable
const { makeArray } = collections.array

const CAPTURED_SERVICE_ID = 'serviceId'
const CAPTURED_TYPE = 'type'
// e.g. '[scriptid=customworkflow1]' & '[scriptid=customworkflow1.workflowstate17.workflowaction33]'
//  & '[type=customsegment, scriptid=cseg1]'
const scriptIdReferenceRegex = new RegExp(`\\[(type=(?<${CAPTURED_TYPE}>[a-z_]+), )?${SCRIPT_ID}=(?<${CAPTURED_SERVICE_ID}>[a-z0-9_]+(\\.[a-z0-9_]+)*)]`, 'g')
// e.g. '[/Templates/filename.html]' & '[/SuiteScripts/script.js]'
const pathReferenceRegex = new RegExp(`^\\[(?<${CAPTURED_SERVICE_ID}>\\/.+)]$`)

type ServiceIdInfo = {
  [CAPTURED_SERVICE_ID]: string
  [CAPTURED_TYPE]?: string
  isFullMatch: boolean
}

const isRegExpFullMatch = (regExpMatches: Array<RegExpExecArray | null>): boolean => (
  regExpMatches.length === 1
  && regExpMatches[0] !== null
  && regExpMatches[0][0] === regExpMatches[0].input
)

const addDependencies = (instance: InstanceElement, deps: Array<ElemID>): void => {
  const dependenciesList = _.uniqBy(
    makeArray(instance.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES])
      .concat(deps.map(dep => ({ reference: new ReferenceExpression(dep) }))),
    ref => ref.reference.elemID.getFullName()
  )
  if (dependenciesList.length > 0) {
    instance.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES] = dependenciesList
  }
}

/**
 * This method tries to capture the serviceId from Netsuite references format. For example:
 * '[scriptid=customworkflow1]' => 'customworkflow1'
 * '[/SuiteScripts/script.js]' => '/SuiteScripts/script.js'
 * 'Some string' => undefined
 */
const captureServiceIdInfo = (value: string): ServiceIdInfo[] => {
  const pathRefMatches = value.match(pathReferenceRegex)?.groups
  if (pathRefMatches !== undefined) {
    return [
      { [CAPTURED_SERVICE_ID]: pathRefMatches[CAPTURED_SERVICE_ID],
        isFullMatch: true }]
  }

  const regexMatches = [scriptIdReferenceRegex.exec(value)]
  while (regexMatches[regexMatches.length - 1]) {
    regexMatches.push(scriptIdReferenceRegex.exec(value))
  }
  const scriptIdRefMatches = regexMatches.slice(0, -1)
  const isFullMatch = isRegExpFullMatch(scriptIdRefMatches)

  return scriptIdRefMatches.map(match => match?.groups)
    .filter(lowerdashValues.isDefined)
    .map(serviceIdRef => ({
      [CAPTURED_SERVICE_ID]: serviceIdRef[CAPTURED_SERVICE_ID],
      [CAPTURED_TYPE]: serviceIdRef[CAPTURED_TYPE],
      isFullMatch,
    }))
}

const customTypeServiceIdsToElemIds = async (
  instance: InstanceElement,
): Promise<Record<string, ElemID>> => {
  const serviceIdsToElemIds: Record<string, ElemID> = {}
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

  const addFullServiceIdsCallback: TransformFunc = ({ value, path, field }) => {
    if (field?.name === SCRIPT_ID && !_.isUndefined(path)) {
      const parentServiceId = getClosestParentServiceId(path)
      const resolvedServiceId = _.isUndefined(parentServiceId) ? value : `${parentServiceId}.${value}`
      parentElemIdFullNameToServiceId[path.createParentID().getFullName()] = resolvedServiceId
      serviceIdsToElemIds[resolvedServiceId] = path
    }
    return value
  }

  await transformElement({
    element: instance,
    transformFunc: addFullServiceIdsCallback,
    strict: true,
    elementsSource: typesElementSourceWrapper(),
  })
  return serviceIdsToElemIds
}

export const getInstanceServiceIdRecords = async (
  instance: InstanceElement,
): Promise<Record<string, ElemID>> => (
  isCustomType(instance.refType.elemID)
    ? customTypeServiceIdsToElemIds(instance)
    : { [serviceId(instance)]: instance.elemID.createNestedID(PATH) }
)

const generateServiceIdToElemID = async (
  elements: Element[],
): Promise<Record<string, ElemID>> =>
  _.assign(
    {},
    ...await awu(elements).filter(isInstanceElement)
      .map(getInstanceServiceIdRecords).toArray()
  )

const replaceReferenceValues = async (
  instance: InstanceElement,
  fetchedElementsServiceIdToElemID: Record<string, ElemID>,
  elementsSourceServiceIdToElemID: Record<string, ElemID>,
): Promise<InstanceElement> => {
  const dependenciesToAdd: Array<ElemID> = []
  const replacePrimitive: TransformFunc = ({ path, value }) => {
    if (!_.isString(value)) {
      return value
    }
    const serviceIdInfo = captureServiceIdInfo(value)
    let returnValue: ReferenceExpression | string = value
    serviceIdInfo.forEach(serviceIdInfoRecord => {
      const elemID = fetchedElementsServiceIdToElemID[serviceIdInfoRecord[CAPTURED_SERVICE_ID]]
      ?? elementsSourceServiceIdToElemID[serviceIdInfoRecord[CAPTURED_SERVICE_ID]]

      const type = serviceIdInfoRecord[CAPTURED_TYPE]
      if (_.isUndefined(elemID) || (type && type !== elemID.typeName)) {
        return
      }

      if (path?.isAttrID() && path.createParentID().name === CORE_ANNOTATIONS.PARENT) {
        if (serviceIdInfoRecord.isFullMatch) {
          returnValue = new ReferenceExpression(elemID.createBaseID().parent)
          return
        }
        dependenciesToAdd.push(elemID.createBaseID().parent)
        return
      }
      if (serviceIdInfoRecord.isFullMatch) {
        returnValue = new ReferenceExpression(elemID)
        return
      }
      dependenciesToAdd.push(elemID)
    })

    return returnValue
  }

  const newInstance = await transformElement({
    element: instance,
    transformFunc: replacePrimitive,
    strict: false,
  })
  addDependencies(newInstance, dependenciesToAdd)

  return newInstance
}

const createElementsSourceServiceIdToElemID = async (
  elementsSourceIndex: LazyElementsSourceIndexes,
  isPartial: boolean,
): Promise<Record<string, ElemID>> => {
  if (!isPartial) {
    return {}
  }

  return _((await elementsSourceIndex.getIndexes()).serviceIdsIndex)
    .mapValues(val => val.elemID)
    .pickBy(lowerdashValues.isDefined)
    .value()
}

const filterCreator: FilterCreator = ({
  elementsSourceIndex,
  isPartial,
}): FilterWith<'onFetch'> => ({
  onFetch: async elements => {
    const fetchedElementsServiceIdToElemID = await generateServiceIdToElemID(elements)
    const elementsSourceServiceIdToElemID = await createElementsSourceServiceIdToElemID(
      elementsSourceIndex,
      isPartial
    )
    await awu(elements).filter(isInstanceElement).forEach(async instance => {
      const newInstance = await replaceReferenceValues(
        instance,
        fetchedElementsServiceIdToElemID,
        elementsSourceServiceIdToElemID
      )
      instance.value = newInstance.value
      instance.annotations = newInstance.annotations
    })
  },
})

export default filterCreator
