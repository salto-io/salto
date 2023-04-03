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
import { isInstanceElement, isObjectType } from '@salto-io/adapter-api'
import { CUSTOM_SEGMENT } from '../constants'
import { isCustomRecordType } from '../types'
import { setElementsUrls } from './elements_urls'
import { ServiceUrlSetter } from './types'

const setServiceUrl: ServiceUrlSetter = async (elements, client) => {
  setElementsUrls({
    elements,
    client,
    filter: element => (
      isObjectType(element) && isCustomRecordType(element)
    ) || (
      isInstanceElement(element) && element.elemID.typeName === CUSTOM_SEGMENT
    ),
    generateUrl: id => `app/common/custom/custrecord.nl?id=${id}`,
  })
}

export default setServiceUrl
