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
import { DEFAULT_API_DEFINITIONS } from '../api_config'
import { ProductSettings } from './product_settings'

const replaceRestVersion = (url: string): string => url.replace('/rest/api/3/', '/rest/api/2/')

const wrapConnection: ProductSettings['wrapConnection'] = connection => ({
  get: (url, config) => connection.get(replaceRestVersion(url), config),
  post: (url, data, config) => connection.post(replaceRestVersion(url), data, config),
  put: (url, data, config) => connection.put(replaceRestVersion(url), data, config),
  delete: (url, config) => connection.delete(replaceRestVersion(url), config),
  patch: (url, data, config) => connection.patch(replaceRestVersion(url), data, config),
})

export const dataCenterSettings: ProductSettings = {
  defaultApiDefinitions: DEFAULT_API_DEFINITIONS,
  wrapConnection,
  type: 'dataCenter',
}
