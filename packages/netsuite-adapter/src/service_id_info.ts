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
import { values } from '@salto-io/lowerdash'
import { SCRIPT_ID } from './constants'

export const CAPTURED_SERVICE_ID = 'serviceId'
export const CAPTURED_TYPE = 'type'
export const CAPTURED_APPID = 'appid'
export const CAPTURED_BUNDLEID = 'bundleid'

const TYPE_REGEX = `type=(?<${CAPTURED_TYPE}>[a-z_]+), `
const APPID_REGEX = `appid=(?<${CAPTURED_APPID}>[a-z_\\.]+), `
const BUNDLEID_REGEX = `bundleid=(?<${CAPTURED_BUNDLEID}>\\d+), `
const SERVICE_ID_REGEX = `${SCRIPT_ID}=(?<${CAPTURED_SERVICE_ID}>[a-z0-9_]+(\\.[a-z0-9_]+)*)`

// e.g. '[scriptid=customworkflow1]' & '[scriptid=customworkflow1.workflowstate17.workflowaction33]'
//  & '[type=customsegment, scriptid=cseg1]'
const scriptIdReferenceRegex = new RegExp(`\\[(${BUNDLEID_REGEX})?(${APPID_REGEX})?(${TYPE_REGEX})?${SERVICE_ID_REGEX}]`, 'g')
// e.g. '[/Templates/filename.html]' & '[/SuiteScripts/script.js]'
const pathReferenceRegex = new RegExp(`^\\[(?<${CAPTURED_SERVICE_ID}>\\/.+)]$`)

export type ServiceIdInfo = {
  [CAPTURED_SERVICE_ID]: string
  [CAPTURED_TYPE]?: string
  [CAPTURED_APPID]?: string
  [CAPTURED_BUNDLEID]?: string
  isFullMatch: boolean
}

const isRegExpFullMatch = (regExpMatches: Array<RegExpExecArray | null>): boolean => (
  regExpMatches.length === 1
  && regExpMatches[0] !== null
  && regExpMatches[0][0] === regExpMatches[0].input
)

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
    .filter(values.isDefined)
    .map(serviceIdRef => ({
      [CAPTURED_SERVICE_ID]: serviceIdRef[CAPTURED_SERVICE_ID],
      [CAPTURED_TYPE]: serviceIdRef[CAPTURED_TYPE],
      [CAPTURED_APPID]: serviceIdRef[CAPTURED_APPID],
      [CAPTURED_BUNDLEID]: serviceIdRef[CAPTURED_BUNDLEID],
      isFullMatch,
    }))
}
