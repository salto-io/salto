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
import { DEFAULT_API_DEFINITIONS } from '../config/api_config'
import { ProductSettings } from './product_settings'

type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch'

type UrlPattern = {
  httpMethod: HttpMethod
  url: RegExp
}

const CLOUD_REST_PREFIX = '/rest/api/3/'

const PLUGIN_URL_PATTERNS: UrlPattern[] = [
  {
    httpMethod: 'get',
    url: new RegExp('/rest/api/3/workflowscheme'),
  },
  {
    httpMethod: 'post',
    url: new RegExp('/rest/api/3/workflowscheme/.+/draft/publish'),
  },
]


const replaceRestVersion = (url: string): string => url.replace(CLOUD_REST_PREFIX, '/rest/api/2/')

const replaceToPluginUrl = (url: string, httpMethod: HttpMethod): string | undefined => (
  PLUGIN_URL_PATTERNS.some(({ httpMethod: patternHttpMethod, url: patternUrl }) =>
    patternHttpMethod === httpMethod && patternUrl.test(url))
    ? url.replace(CLOUD_REST_PREFIX, '/rest/salto/1.0/')
    : undefined
)

const replaceUrl = (url: string, httpMethod: HttpMethod): string =>
  replaceToPluginUrl(url, httpMethod) ?? replaceRestVersion(url)

const wrapConnection: ProductSettings['wrapConnection'] = connection => ({
  get: (url, config) => connection.get(replaceUrl(url, 'get'), config),
  post: (url, data, config) => connection.post(replaceUrl(url, 'post'), data, config),
  put: (url, data, config) => connection.put(replaceUrl(url, 'put'), data, config),
  delete: (url, config) => connection.delete(replaceUrl(url, 'delete'), config),
  patch: (url, data, config) => connection.patch(replaceUrl(url, 'patch'), data, config),
})

export const dataCenterSettings: ProductSettings = {
  defaultApiDefinitions: DEFAULT_API_DEFINITIONS,
  wrapConnection,
  type: 'dataCenter',
}
