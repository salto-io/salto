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
import { ElemIdGetter, InstanceElement, ObjectType, Values } from '@salto-io/adapter-api'
import { createSchemeGuard, naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import Joi from 'joi'
import { JIRA, AUTOMATION_LABEL_TYPE } from '../../../constants'
import JiraClient from '../../../client/client'
import { FilterCreator } from '../../../filter'
import { getCloudId } from '../cloud_id'
import { createAutomationLabelType } from './types'
import { LABELS_POST_RESPONSE_SCHEME, LabelsResponse } from './label_deployment'

const log = logger(module)

export const LABELS_GET_RESPONSE_SCHEME = Joi.array().items(
  LABELS_POST_RESPONSE_SCHEME
)

export const isLabelsGetResponse = createSchemeGuard<LabelsResponse[]>(LABELS_GET_RESPONSE_SCHEME, 'Failed to get automation labels, received invalid response')


const createInstance = (
  values: Values,
  type: ObjectType,
  getElemIdFunc?: ElemIdGetter,
): InstanceElement => {
  const serviceIds = elementUtils.createServiceIds(values, 'id', type.elemID)

  const defaultName = naclCase(values.name)

  const instanceName = getElemIdFunc && serviceIds
    ? getElemIdFunc(JIRA, serviceIds, defaultName).name
    : defaultName

  return new InstanceElement(
    instanceName,
    type,
    values,
    [JIRA, elementUtils.RECORDS_PATH, AUTOMATION_LABEL_TYPE, pathNaclCase(instanceName)],
  )
}

export const getAutomationLabels = async (
  client: JiraClient,
): Promise<LabelsResponse[]> => {
  const url = client.isDataCenter
    ? '/rest/cb-automation/latest/rule-label'
    : `/gateway/api/automation/internal-api/jira/${await getCloudId(client)}/pro/rest/GLOBAL/rule-labels`

  const response = await client.getSinglePage({ url })

  if (!isLabelsGetResponse(response.data)) {
    throw new Error('Failed to get automation labels, received invalid response')
  }
  return response.data
}

/**
 * Fetching automation labels from Jira using internal API endpoint.
 * We first use `/resources` endpoint to get the cloud id of the account.
 * Using the cloud id, we create the url to query the automation labels with
 */
export const filter: FilterCreator = ({ client, getElemIdFunc, config, fetchQuery }) => ({
  name: 'automationLabelFetchFilter',
  onFetch: async elements => {
    if (!fetchQuery.isTypeMatch(AUTOMATION_LABEL_TYPE)) {
      return
    }

    if (!config.client.usePrivateAPI) {
      log.debug('Skipping label automation fetch filter because private API is not enabled')
      return
    }

    const automationLabels = await getAutomationLabels(client)

    const automationLabelType = createAutomationLabelType()
    automationLabels.forEach(automationLabel => elements.push(
      createInstance(automationLabel, automationLabelType, getElemIdFunc),
    ))
    elements.push(automationLabelType)
  },
})

export default filter
