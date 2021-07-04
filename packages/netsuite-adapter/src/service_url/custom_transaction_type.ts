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
  setInstancesUrls({
    elements,
    client,
    filter: element => element.refType.elemID.name === 'customtransactiontype',
    query: 'SELECT id, scriptid FROM customtransactiontype ORDER BY id ASC',
    generateUrl: id => `app/common/custom/customtransaction.nl?id=${id}`,
  })

export default setServiceUrl
