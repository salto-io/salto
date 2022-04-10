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
import { Element, InstanceElement, isInstanceElement, ObjectType } from '@salto-io/adapter-api'
import { createSchemeGuard, naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import Joi from 'joi'
import { elements as elementUtils, config as configUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { findObject } from '../../utils'
import { FilterCreator } from '../../filter'
import { JIRA, STATUS_TYPE_NAME } from '../../constants'
import { JiraConfig } from '../../config'


const log = logger(module)

type Status = {
  id: string
  name: string
  description?: string
}

const EXPECTED_RESULTS_SCHEME = Joi.array().items(Joi.object({
  id: Joi.string(),
  name: Joi.string(),
  description: Joi.string().allow('').optional(),
}).unknown(true)).required()

const isStatusesResponse = createSchemeGuard<Status[]>(EXPECTED_RESULTS_SCHEME, 'Received an invalid response from statuses private API')

const createStatusInstance = (
  statusValues: Status,
  statusType: ObjectType,
  config: JiraConfig
): InstanceElement => {
  const { idFields } = configUtils.getConfigWithDefault(
    config.apiDefinitions.types[statusType.elemID.typeName].transformation,
    config.apiDefinitions.typeDefaults.transformation
  )
  const statusName = naclCase(elementUtils.getInstanceName(statusValues, idFields)
    ?? statusValues.id)

  return new InstanceElement(
    statusName,
    statusType,
    // iconURL seems to always be empty
    _.omit(statusValues, 'iconURL'),
    [
      JIRA,
      elementUtils.RECORDS_PATH,
      STATUS_TYPE_NAME,
      pathNaclCase(statusName),
    ],
  )
}

/**
 * The public API for getting all the statuses returns only
 * the statuses that are used in active workflows so we fetch
 * the missing statuses using private API
 */
const filter: FilterCreator = ({ client, config }) => ({
  onFetch: async (elements: Element[]) => {
    if (!config.client.usePrivateAPI) {
      log.debug('Skipping missing statuses filter because private API is not enabled')
      return
    }

    const statusType = findObject(elements, STATUS_TYPE_NAME)
    if (statusType === undefined) {
      return
    }

    const existingIds = new Set(elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === STATUS_TYPE_NAME)
      .map(instance => instance.value.id))


    try {
      const response = await client.getPrivate({
        url: '/rest/workflowDesigner/1.0/statuses',
      })
      const statusesValues = response.data

      if (!isStatusesResponse(statusesValues)) {
        return
      }


      const missingStatuses = statusesValues
        .filter(status => !existingIds.has(status.id))
        .map(statusValues => createStatusInstance(statusValues, statusType, config))

      elements.push(...missingStatuses)
    } catch (err) {
      log.error(`Received an error when using statuses private API: ${err.message}`)
    }
  },
})

export default filter
