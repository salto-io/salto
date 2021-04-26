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

import { CORE_ANNOTATIONS, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { PLUGIN_IMPLEMENTATION_TYPES, SCRIPT_TYPES } from '../types'
import NetsuiteClient from '../client/client'
import { ServiceUrlSetter } from './types'
import { areQueryResultsValid } from './validation'
import { SUPPORTED_TYPES } from '../changes_detector/changes_detectors/script'

const log = logger(module)


const getScriptIdToInternalId = async (client: NetsuiteClient): Promise<Record<string, number>> => {
  const results = await client.runSuiteQL('SELECT id, scriptid FROM script')
  if (!areQueryResultsValid(results)) {
    throw new Error('Got invalid results from scripts query')
  }

  return Object.fromEntries(results.map(({ scriptid, id }) => [scriptid, parseInt(id, 10)]))
}

const generateUrl = (element: InstanceElement, scriptIdToInternalId: Record<string, number>):
  string | undefined => {
  const id = scriptIdToInternalId[element.value.scriptid]
  if (id === undefined) {
    log.warn(`Did not find the internal id of ${element.elemID.getFullName()}`)
    return undefined
  }

  if (SCRIPT_TYPES.includes(element.type.elemID.name)) {
    return `app/common/scripting/script.nl?id=${id}`
  }
  if (PLUGIN_IMPLEMENTATION_TYPES.includes(element.type.elemID.name)) {
    return `app/common/scripting/plugin.nl?id=${id}`
  }
  return `app/common/scripting/plugintype.nl?scripttype=PLUGINTYPE&id=${id}`
}

const setServiceUrl: ServiceUrlSetter = async (elements, client) => {
  const relevantElements = elements
    .filter(isInstanceElement)
    .filter(element => SUPPORTED_TYPES.includes(element.type.elemID.name))

  if (relevantElements.length === 0) {
    return
  }

  const scriptIdToInternalId = await getScriptIdToInternalId(client)

  relevantElements.forEach(element => {
    const url = generateUrl(element, scriptIdToInternalId)
    if (url !== undefined) {
      element.annotations[CORE_ANNOTATIONS.SERVICE_URL] = new URL(url, client.url).href
    }
  })
}

export default setServiceUrl
