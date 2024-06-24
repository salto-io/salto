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

import { InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { FIELD_TYPES } from '../types'
import { ServiceUrlSetter } from './types'
import { setElementsUrls } from './elements_urls'

const log = logger(module)

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

const generateUrl = (id: number, element: InstanceElement): string | undefined => {
  const url = TYPE_TO_URL[element.refType.elemID.name]?.(id)
  if (url === undefined) {
    log.warn(`Got unknown type in custom_field service url setter: ${element.elemID.getFullName()}`)
  }
  return url
}

const setServiceUrl: ServiceUrlSetter = (elements, client) => {
  setElementsUrls({
    elements: elements.filter(isInstanceElement),
    client,
    filter: element => FIELD_TYPES.includes(element.refType.elemID.name),
    generateUrl,
  })
}

export default setServiceUrl
