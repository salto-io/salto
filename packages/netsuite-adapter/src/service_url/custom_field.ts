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
import { FIELD_TYPES } from '../types'
import NetsuiteClient from '../client/client'
import { ServiceUrlSetter } from './types'
import { areQueryResultsValid } from './validation'

const TYPE_TO_URL: Record<string, (id: number) => string> = {
  crmcustomfield: id => `app/common/custom/eventcustfield.nl?id=${id}`,
  entitycustomfield: id => `app/common/custom/entitycustfield.nl?id=${id}`,
  itemcustomfield: id => `app/common/custom/itemcustfield.nl?id=${id}`,
  itemnumbercustomfield: id => `app/common/custom/itemnumbercustfield.nl?id=${id}`,
  itemoptioncustomfield: id => `app/common/custom/itemoption.nl?id=${id}`,
  othercustomfield: id => `app/common/custom/othercustfield.nl?id=${id}`,
  transactionbodycustomfield: id => `app/common/custom/bodycustfield.nl?id=${id}`,
  transactioncolumncustomfield: id => `app/common/custom/columncustfield.nl?id=${id}`,
}

const getScriptIdToInternalId = async (client: NetsuiteClient): Promise<Record<string, number>> => {
  const results = await client.runSuiteQL('SELECT internalid AS id, scriptid FROM customfield')
  if (!areQueryResultsValid(results)) {
    throw new Error('Got invalid results from custom fields query')
  }

  return Object.fromEntries(
    results.map(({ scriptid, id }) => [scriptid.toLowerCase(), parseInt(id, 10)])
  )
}

const generateUrl = (element: InstanceElement, scriptIdToInternalId: Record<string, number>):
  string | undefined => {
  const id = scriptIdToInternalId[element.value.scriptid]
  if (id === undefined) {
    return undefined
  }

  return TYPE_TO_URL[element.type.elemID.name]?.(id)
}

const setServiceUrl: ServiceUrlSetter = async (elements, client) => {
  const relevantElements = elements
    .filter(isInstanceElement)
    .filter(element => FIELD_TYPES.includes(element.type.elemID.name))

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
