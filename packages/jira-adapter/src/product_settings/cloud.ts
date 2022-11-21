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
import _ from 'lodash'
import { config } from '@salto-io/adapter-components'
import { DEFAULT_API_DEFINITIONS, JiraApiConfig } from '../config/api_config'
import { ProductSettings } from './product_settings'
import { addTypeNameOverrides } from './utils'


const CLOUD_DEFAULT_API_DEFINITIONS: Partial<JiraApiConfig> = {
  types: {
    Priorities: {
      request: {
        url: '/rest/api/3/priority/search',
        paginationField: 'startAt',
      },
    },
  },
}
const CLOUD_ADDITIONAL_TYPE_NAME_OVERRIDES = [
  {
    originalName: 'PageBeanPriority',
    newName: 'Priorities',
  },
]

export const CLOUD_SETTINGS: ProductSettings = {
  defaultApiDefinitions: config.mergeWithDefaultConfig(
    addTypeNameOverrides(DEFAULT_API_DEFINITIONS, CLOUD_ADDITIONAL_TYPE_NAME_OVERRIDES),
    CLOUD_DEFAULT_API_DEFINITIONS,
  ) as JiraApiConfig,
  wrapConnection: _.identity,
  type: 'cloud',
}
