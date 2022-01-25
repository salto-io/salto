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

import { CORE_ANNOTATIONS, InstanceElement } from '@salto-io/adapter-api'
import { promises } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { ServiceUrlSetter } from './types'
import { isFileCabinetInstance, isFileInstance } from '../types'
import NetsuiteClient from '../client/client'

const log = logger(module)


const generateUrl = async (element: InstanceElement, client: NetsuiteClient):
  Promise<string | undefined> => {
  const id = await client.getPathInternalId(element.value.path)
  if (id === undefined) {
    log.warn(`Did not find the internal id of ${element.elemID.getFullName()}`)
    return undefined
  }

  return isFileInstance(element)
    ? `app/common/media/mediaitem.nl?id=${id}`
    : `app/common/media/mediaitemfolder.nl?id=${id}`
}

const setServiceUrl: ServiceUrlSetter = async (elements, client) => {
  const relevantElements = elements.filter(isFileCabinetInstance)

  // We use series here and not Promise.all since getPathInternalId is not concurrency safe
  // and there isn't much advantage in running it in parallel
  await promises.array.series(relevantElements.map(element => async () => {
    const url = await generateUrl(element, client)
    if (url !== undefined) {
      element.annotations[CORE_ANNOTATIONS.SERVICE_URL] = new URL(url, client.url).href
    }
  }))
}

export default setServiceUrl
