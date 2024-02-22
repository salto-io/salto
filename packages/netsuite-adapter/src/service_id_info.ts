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
import { values } from '@salto-io/lowerdash'
import { ElemID, Element } from '@salto-io/adapter-api'
import { WALK_NEXT_STEP, walkOnElement } from '@salto-io/adapter-utils'
import { SCRIPT_ID } from './constants'
import { ServiceIdRecords } from './elements_source_index/types'

const CAPTURED_SERVICE_ID = 'serviceId'
const CAPTURED_TYPE = 'type'
const CAPTURED_APPID = 'appid'
const CAPTURED_BUNDLEID = 'bundleid'

const TYPE_REGEX = `type=(?<${CAPTURED_TYPE}>[a-z_]+), `
const APPID_REGEX = `appid=(?<${CAPTURED_APPID}>[a-z_\\.]+), `
const BUNDLEID_REGEX = `bundleid=(?<${CAPTURED_BUNDLEID}>\\d+), `
const SERVICE_ID_REGEX = `${SCRIPT_ID}=(?<${CAPTURED_SERVICE_ID}>[a-z0-9_]+(\\.[a-z0-9_]+)*)`

// e.g. '[scriptid=customworkflow1]' & '[scriptid=customworkflow1.workflowstate17.workflowaction33]'
//  & '[type=customsegment, scriptid=cseg1]'
const scriptIdReferenceRegex = new RegExp(
  `\\[(${BUNDLEID_REGEX})?(${APPID_REGEX})?(${TYPE_REGEX})?${SERVICE_ID_REGEX}]`,
  'g',
)
// e.g. '[/Templates/filename.html]' & '[/SuiteScripts/script.js]'
const pathReferenceRegex = new RegExp(`^\\[(?<${CAPTURED_SERVICE_ID}>\\/.+)]$`)

export type ServiceIdInfo = {
  serviceId: string
  serviceIdType: 'path' | 'scriptid'
  type?: string
  appid?: string
  bundleid?: string
  isFullMatch: boolean
}

const isRegExpFullMatch = (regExpMatches: Array<RegExpExecArray | null>): boolean =>
  regExpMatches.length === 1 && regExpMatches[0] !== null && regExpMatches[0][0] === regExpMatches[0].input

/**
 * This method tries to capture the serviceId from Netsuite references format. For example:
 * '[scriptid=customworkflow1]' => 'customworkflow1'
 * '[/SuiteScripts/script.js]' => '/SuiteScripts/script.js'
 * 'Some string' => undefined
 */
export const captureServiceIdInfo = (value: string): ServiceIdInfo[] => {
  const pathRefMatches = value.match(pathReferenceRegex)?.groups
  if (pathRefMatches !== undefined) {
    return [
      {
        serviceId: pathRefMatches[CAPTURED_SERVICE_ID],
        serviceIdType: 'path',
        isFullMatch: true,
      },
    ]
  }

  const regexMatches = [scriptIdReferenceRegex.exec(value)]
  while (regexMatches[regexMatches.length - 1]) {
    regexMatches.push(scriptIdReferenceRegex.exec(value))
  }
  const scriptIdRefMatches = regexMatches.slice(0, -1)
  const isFullMatch = isRegExpFullMatch(scriptIdRefMatches)

  return scriptIdRefMatches
    .map(match => match?.groups)
    .filter(values.isDefined)
    .map(serviceIdRef => ({
      serviceId: serviceIdRef[CAPTURED_SERVICE_ID],
      serviceIdType: 'scriptid',
      type: serviceIdRef[CAPTURED_TYPE],
      appid: serviceIdRef[CAPTURED_APPID],
      bundleid: serviceIdRef[CAPTURED_BUNDLEID],
      isFullMatch,
    }))
}

export const getServiceIdsToElemIds = (element: Element): ServiceIdRecords => {
  const serviceIdsToElemIds: ServiceIdRecords = {}
  const parentElemIdFullNameToServiceId: Record<string, string> = {}

  const getClosestParentServiceId = (elemID: ElemID): string | undefined => {
    const parentElemId = elemID.createParentID()
    if (parentElemId.isTopLevel()) {
      return parentElemIdFullNameToServiceId[parentElemId.getFullName()]
    }
    if (parentElemIdFullNameToServiceId[parentElemId.getFullName()] !== undefined) {
      return parentElemIdFullNameToServiceId[parentElemId.getFullName()]
    }
    return getClosestParentServiceId(parentElemId)
  }

  walkOnElement({
    element,
    func: ({ value, path }) => {
      if (path.name === SCRIPT_ID && typeof value === 'string') {
        const parentServiceId = getClosestParentServiceId(path)
        const resolvedServiceId = parentServiceId === undefined ? value : `${parentServiceId}.${value}`
        parentElemIdFullNameToServiceId[path.createParentID().getFullName()] = resolvedServiceId
        serviceIdsToElemIds[resolvedServiceId] = { elemID: path, serviceID: value }
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })

  return serviceIdsToElemIds
}
