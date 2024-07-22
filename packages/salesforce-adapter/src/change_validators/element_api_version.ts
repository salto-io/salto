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
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import {
  ChangeValidator,
  ElemID,
  getChangeData,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import {
  FLOW_METADATA_TYPE,
  ORGANIZATION_API_VERSION,
  ORGANIZATION_SETTINGS,
  SALESFORCE,
} from '../constants'
import { LATEST_SUPPORTED_API_VERSION_FIELD } from '../filters/organization_settings'
import { isInstanceOfTypeSync } from '../filters/utils'

const log = logger(module)

const VERSIONED_TYPES = [FLOW_METADATA_TYPE]

const getLatestSupportedApiVersion = async (
  elementsSource?: ReadOnlyElementsSource,
): Promise<number | undefined> => {
  if (elementsSource === undefined) {
    return undefined
  }

  const orgSettings = await elementsSource.get(
    new ElemID(SALESFORCE, ORGANIZATION_SETTINGS, 'instance'),
  )
  let latestApiVersion = orgSettings?.value[LATEST_SUPPORTED_API_VERSION_FIELD]
  if (latestApiVersion === undefined) {
    // TODO (SALTO-5978): Remove once we enable the optional feature.
    const orgApiVersion = await elementsSource.get(
      new ElemID(SALESFORCE, ORGANIZATION_API_VERSION, 'instance'),
    )
    latestApiVersion = orgApiVersion?.value[LATEST_SUPPORTED_API_VERSION_FIELD]
  }

  if (latestApiVersion === undefined) {
    log.debug('Latest API version not found.')
    return undefined
  }

  if (!_.isNumber(latestApiVersion)) {
    log.error(`Got an invalid latest API version: ${latestApiVersion}.`)
    return undefined
  }

  return latestApiVersion
}

const elementApiVersionValidator: ChangeValidator = async (
  changes,
  elementsSource,
) => {
  const latestApiVersion = await getLatestSupportedApiVersion(elementsSource)
  if (latestApiVersion === undefined) {
    return []
  }

  return changes
    .map(getChangeData)
    .filter(isInstanceOfTypeSync(...VERSIONED_TYPES))
    .filter(
      (instance) =>
        _.isNumber(instance.value.apiVersion) &&
        instance.value.apiVersion > latestApiVersion,
    )
    .map((instance) => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Unsupported API version',
      detailedMessage: `Element API version set to ${instance.value.apiVersion}, the maximum supported version is ${latestApiVersion}. You can change the element's API version to one that is supported.`,
    }))
}

export default elementApiVersionValidator
