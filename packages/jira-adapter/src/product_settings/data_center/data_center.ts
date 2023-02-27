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
import { config as configUtils } from '@salto-io/adapter-components'
import { DEFAULT_API_DEFINITIONS, JiraApiConfig } from '../../config/api_config'
import { DC_ADDITIONAL_TYPE_NAME_OVERRIDES, DC_DEFAULT_API_DEFINITIONS } from './api_config'
import { ProductSettings } from '../product_settings'
import { addTypeNameOverrides } from '../utils'

type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch'

type UrlPattern = {
  httpMethods: HttpMethod[]
  url: string
}

const CLOUD_REST_PREFIX = '/rest/api/3/'
const DATA_REST_CENTER_PREFIX = '/rest/api/2/'
const PLUGIN_REST_PREFIX = '/rest/salto/1.0/'


// A list to describe the endpoints we implemented with the plugin
// to know when to use the plugin prefix
const PLUGIN_URL_PATTERNS: UrlPattern[] = [
  {
    httpMethods: ['get'],
    url: '/rest/api/3/workflowscheme',
  },
  {
    httpMethods: ['get'],
    url: '/rest/api/3/workflowscheme/project.+',
  },
  {
    httpMethods: ['put'],
    url: '/rest/api/3/workflowscheme/project',
  },
  {
    httpMethods: ['post'],
    url: '/rest/api/3/workflowscheme/.+/draft/publish',
  },
  {
    httpMethods: ['get'],
    url: '/rest/api/3/statuses/search',
  },
  {
    httpMethods: ['get'],
    url: '/rest/api/3/filter/search',
  },
  {
    httpMethods: ['post'],
    url: '/rest/api/3/filter',
  },
  {
    httpMethods: ['put'],
    url: '/rest/api/3/filter/.*',
  },
  {
    httpMethods: ['post', 'put'],
    url: '/rest/api/3/statuses',
  },
  {
    httpMethods: ['delete'],
    url: '/rest/api/3/statuses.*',
  },
  {
    httpMethods: ['get', 'post'],
    url: '/rest/api/3/screens',
  },
  {
    httpMethods: ['get'],
    url: '/rest/api/3/workflow/search',
  },
  {
    httpMethods: ['post'],
    url: '/rest/api/3/workflow',
  },
  {
    httpMethods: ['delete'],
    url: '/rest/api/3/workflow/\\d+',
  },
  {
    httpMethods: ['put', 'delete'],
    url: '/rest/api/3/screens/\\d+',
  },
  {
    httpMethods: ['get', 'post'],
    url: '/rest/api/3/screenscheme',
  },
  {
    httpMethods: ['put', 'delete'],
    url: '/rest/api/3/screenscheme/\\d+',
  },
  {
    httpMethods: ['get', 'post', 'put'],
    url: '/rest/api/3/events',
  },
  {
    httpMethods: ['delete'],
    url: '/rest/api/3/events.*',
  },
  {
    httpMethods: ['get'],
    url: '/rest/api/3/field/search',
  },
  {
    httpMethods: ['put', 'delete'],
    url: '/rest/api/3/field/.*',
  },
  {
    httpMethods: ['get', 'post'],
    url: '/rest/api/3/field/.*/context',
  },
  {
    httpMethods: ['put', 'delete'],
    url: '/rest/api/3/field/.*/context/\\d+',
  },
  {
    httpMethods: ['put'],
    url: '/rest/api/3/field/.*/context/\\d+/issuetype',
  },
  {
    httpMethods: ['post'],
    url: '/rest/api/3/field/.*/context/\\d+/issuetype/remove',
  },
  {
    httpMethods: ['put'],
    url: '/rest/api/3/field/.*/context/\\d+/project',
  },
  {
    httpMethods: ['post'],
    url: '/rest/api/3/field/.*/context/\\d+/project/remove',
  },
  {
    httpMethods: ['post', 'put'],
    url: '/rest/api/3/field/.*/context/\\d+/option',
  },
  {
    httpMethods: ['delete'],
    url: '/rest/api/3/field/.*/context/\\d+/option/\\d+',
  },
  {
    httpMethods: ['put'],
    url: '/rest/api/3/field/.*/context/\\d+/option/move',
  },
  {
    httpMethods: ['get'],
    url: '/rest/api/3/field/.*/context/issuetypemapping',
  },
  {
    httpMethods: ['get'],
    url: '/rest/api/3/field/.*/context/projectmapping',
  },
  {
    httpMethods: ['get'],
    url: '/rest/api/3/field/.*/context/.*/option',
  },
  {
    httpMethods: ['get'],
    url: '/rest/api/3/issuesecurityschemes/.*/members.*',
  },
  {
    httpMethods: ['get', 'post'],
    url: '/rest/api/3/issuetypescreenscheme',
  },
  {
    httpMethods: ['put', 'delete'],
    url: '/rest/api/3/issuetypescreenscheme/\\d+',
  },
  {
    httpMethods: ['put'],
    url: '/rest/api/3/issuetypescreenscheme/\\d+/mapping',
  },
  {
    httpMethods: ['put'],
    url: '/rest/api/3/issuetypescreenscheme/\\d+/mapping/default',
  },
  {
    httpMethods: ['post'],
    url: '/rest/api/3/issuetypescreenscheme/\\d+/mapping/remove',
  },
  {
    httpMethods: ['get'],
    url: '/rest/api/3/issuetypescreenscheme/mapping.+',
  },
  {
    httpMethods: ['get'],
    url: '/rest/api/3/issuetypescreenscheme/project.+',
  },
  {
    httpMethods: ['put'],
    url: '/rest/api/3/issuetypescreenscheme/project',
  },
  {
    httpMethods: ['get', 'post'],
    url: '/rest/api/3/fieldconfigurationscheme',
  },
  {
    httpMethods: ['put', 'delete'],
    url: '/rest/api/3/fieldconfigurationscheme/\\d+',
  },
  {
    httpMethods: ['get'],
    url: '/rest/api/3/fieldconfigurationscheme/mapping.+',
  },
  {
    httpMethods: ['put'],
    url: '/rest/api/3/fieldconfigurationscheme/\\d+/mapping',
  },
  {
    httpMethods: ['post'],
    url: '/rest/api/3/fieldconfigurationscheme/\\d+/mapping/delete',
  },
  {
    httpMethods: ['get'],
    url: '/rest/api/3/fieldconfigurationscheme/project.+',
  },
  {
    httpMethods: ['put'],
    url: '/rest/api/3/fieldconfigurationscheme/project',
  },
  {
    httpMethods: ['get', 'post'],
    url: '/rest/api/3/fieldconfiguration',
  },
  {
    httpMethods: ['put', 'delete'],
    url: '/rest/api/3/fieldconfiguration/\\d+',
  },
  {
    httpMethods: ['get', 'put'],
    url: '/rest/api/3/fieldconfiguration/\\d+/fields',
  },
  {
    httpMethods: ['get'],
    url: '/rest/api/3/dashboard/search',
  },
  {
    httpMethods: ['post'],
    url: '/rest/api/3/dashboard',
  },
  {
    httpMethods: ['put', 'delete'],
    url: '/rest/api/3/dashboard/\\d+',
  },
  {
    httpMethods: ['get', 'post'],
    url: '/rest/api/3/dashboard/\\d+/gadget',
  },
  {
    httpMethods: ['put', 'delete'],
    url: '/rest/api/3/dashboard/\\d+/gadget/\\d+',
  },
  {
    httpMethods: ['put'],
    url: '/rest/api/3/dashboard/.+/items/.+/properties/.+',
  },
  {
    httpMethods: ['post'],
    url: '/rest/api/3/priority',
  },
  {
    httpMethods: ['put'],
    url: '/rest/api/3/priority/.+',
  },
  {
    httpMethods: ['get'],
    url: '/rest/api/3/group/bulk',
  },
  {
    httpMethods: ['get', 'post'],
    url: '/rest/api/3/issuetypescheme',
  },
  {
    httpMethods: ['put', 'delete'],
    url: '/rest/api/3/issuetypescheme/\\d+',
  },
  {
    httpMethods: ['get'],
    url: '/rest/api/3/issuetypescheme/mapping.+',
  },
  {
    httpMethods: ['get'],
    url: '/rest/api/3/issuetypescheme/project.+',
  },
  {
    httpMethods: ['post'],
    url: '/rest/api/3/notificationscheme',
  },
  {
    httpMethods: ['put', 'delete'],
    url: '/rest/api/3/notificationscheme/.+',
  },
  {
    httpMethods: ['post'],
    url: '/rest/api/3/resolution',
  },
  {
    httpMethods: ['put'],
    url: '/rest/api/3/resolution/.*',
  },
  {
    httpMethods: ['put'],
    url: '/rest/api/3/issuetypescheme/project',
  },
  {
    httpMethods: ['put'],
    url: '/rest/api/3/issuetypescheme/.+/issuetype',
  },
  {
    httpMethods: ['delete'],
    url: '/rest/api/3/issuetypescheme/.+/issuetype/.+',
  },
  {
    httpMethods: ['put'],
    url: '/rest/api/3/issuetypescheme/.+/issuetype/move',
  },
  {
    httpMethods: ['post', 'put'],
    url: '/rest/api/3/issuesecurityschemes',
  },
  {
    httpMethods: ['delete'],
    url: '/rest/api/3/issuesecurityschemes/.+',
  },
  {
    httpMethods: ['post', 'put'],
    url: '/rest/api/3/securitylevel.+',
  },
  {
    httpMethods: ['delete'],
    url: '/rest/api/3/securitylevel/.+',
  },
  {
    httpMethods: ['get', 'put'],
    url: '/rest/api/3/field/.+/context/defaultValue',
  },
]

const replaceRestVersion = (url: string): string => url.replace(
  CLOUD_REST_PREFIX,
  DATA_REST_CENTER_PREFIX,
)

const createRegex = (patternUrl: string): RegExp => new RegExp(`^${patternUrl}/?$`)

const replaceToPluginUrl = (url: string, httpMethod: HttpMethod): string | undefined => (
  PLUGIN_URL_PATTERNS.some(({ httpMethods, url: patternUrl }) =>
    httpMethods.includes(httpMethod) && createRegex(patternUrl).test(url))
    ? url.replace(CLOUD_REST_PREFIX, PLUGIN_REST_PREFIX)
    : undefined
)

const replaceUrl = (url: string, httpMethods: HttpMethod): string =>
  replaceToPluginUrl(url, httpMethods) ?? replaceRestVersion(url)

const wrapConnection: ProductSettings['wrapConnection'] = connection => ({
  get: (url, config) => connection.get(replaceUrl(url, 'get'), config),
  post: (url, data, config) => connection.post(replaceUrl(url, 'post'), data, config),
  put: (url, data, config) => connection.put(replaceUrl(url, 'put'), data, config),
  delete: (url, config) => connection.delete(replaceUrl(url, 'delete'), config),
  patch: (url, data, config) => connection.patch(replaceUrl(url, 'patch'), data, config),
})

export const DATA_CENTER_SETTINGS: ProductSettings = {
  defaultApiDefinitions: configUtils.mergeWithDefaultConfig(
    addTypeNameOverrides(DEFAULT_API_DEFINITIONS, DC_ADDITIONAL_TYPE_NAME_OVERRIDES),
    DC_DEFAULT_API_DEFINITIONS,
  ) as JiraApiConfig,
  wrapConnection,
  type: 'dataCenter',
}
