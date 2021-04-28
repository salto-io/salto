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
import { setInstancesUrls } from './instances_urls'
import { ServiceUrlSetter } from './types'

const setServiceUrl: ServiceUrlSetter = async (elements, client) =>
  setInstancesUrls(
    elements,
    client,
    element => ['customrecordtype', 'customsegment'].includes(element.type.elemID.name),
    'SELECT internalid AS id, scriptid FROM customrecordtype',
    id => `app/common/custom/custrecord.nl?id=${id}`,
    element => (element.type.elemID.name === 'customsegment' ? `customrecord_${element.value.scriptid}` : element.value.scriptid)
  )

export default setServiceUrl
