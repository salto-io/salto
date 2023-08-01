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

import { isInstanceElement,
  CORE_ANNOTATIONS,
  Element,
  InstanceElement,
  Change,
  isInstanceChange,
  isAdditionChange,
  getChangeData } from '@salto-io/adapter-api'
import { filters } from '@salto-io/adapter-components'
import { getParent } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import {
  APP_USER_SCHEMA_TYPE_NAME,
  USER_SCHEMA_TYPE_NAME,
} from '../constants'
import { getAdminUrl } from '../client/admin'

const log = logger(module)
const { addUrlToInstance } = filters

const SUPPORTED_TYPES = new Set([USER_SCHEMA_TYPE_NAME, APP_USER_SCHEMA_TYPE_NAME])

const createSuffixUrL = (instance: InstanceElement): string => {
  const parent = getParent(instance).value.id
  if (instance.elemID.typeName === USER_SCHEMA_TYPE_NAME) {
    return `/admin/universaldirectory#okta/${parent}`
  }
  return `/api/v1/meta/schemas/apps/${parent}/default`
}

const createServiceUrl = (instance: InstanceElement, baseUrl: string): void => {
  try {
    const suffixUrl = createSuffixUrL(instance)
    instance.annotations[CORE_ANNOTATIONS.SERVICE_URL] = (new URL(suffixUrl, baseUrl)).href
  } catch (error) {
    log.warn(`Failed to create serviceUrl for ${instance.elemID.getFullName()}. Error: ${error.message}}`)
  }
}

const serviceUrlFilter: FilterCreator = ({ client, config }) => ({
  name: 'serviceUrlFilter',
  onFetch: async (elements: Element[]) => {
    const baseUrl = getAdminUrl(client.baseUrl)
    if (baseUrl === undefined) {
      log.warn('Failed to run serviceUrlFilter, because baseUrl could not be found')
      return
    }
    elements
      .filter(isInstanceElement)
      .forEach(instance => {
        if (SUPPORTED_TYPES.has(instance.elemID.typeName)) {
          createServiceUrl(instance, baseUrl)
          return
        }
        addUrlToInstance(instance, baseUrl, config)
      })
  },
  onDeploy: async (changes: Change<InstanceElement>[]) => {
    const baseUrl = getAdminUrl(client.baseUrl)
    if (baseUrl === undefined) {
      log.warn('Failed to run serviceUrlFilter, because baseUrl could not be found')
      return
    }
    const relevantChanges = changes.filter(isInstanceChange).filter(isAdditionChange)
    relevantChanges
      .map(getChangeData)
      .forEach(instance => {
        if (SUPPORTED_TYPES.has(instance.elemID.typeName)) {
          createServiceUrl(instance, baseUrl)
          return
        }
        addUrlToInstance(instance, baseUrl, config)
      })
  },
})

export default serviceUrlFilter
