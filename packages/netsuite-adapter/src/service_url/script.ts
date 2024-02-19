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
import { PLUGIN_IMPLEMENTATION_TYPES, SCRIPT_TYPES } from '../types'
import { ServiceUrlSetter } from './types'
import { SUPPORTED_TYPES } from '../changes_detector/changes_detectors/script'
import { setElementsUrls } from './elements_urls'

const generateUrl = (id: number, element: InstanceElement): string | undefined => {
  if (SCRIPT_TYPES.includes(element.refType.elemID.name)) {
    return `app/common/scripting/script.nl?id=${id}`
  }
  if (PLUGIN_IMPLEMENTATION_TYPES.includes(element.refType.elemID.name)) {
    return `app/common/scripting/plugin.nl?id=${id}`
  }
  return `app/common/scripting/plugintype.nl?scripttype=PLUGINTYPE&id=${id}`
}

const setServiceUrl: ServiceUrlSetter = (elements, client) => {
  setElementsUrls({
    elements: elements.filter(isInstanceElement),
    client,
    filter: element => SUPPORTED_TYPES.includes(element.refType.elemID.name),
    generateUrl,
  })
}

export default setServiceUrl
