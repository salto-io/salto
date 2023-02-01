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
import { CORE_ANNOTATIONS, getChangeData, InstanceElement, isAdditionChange, isInstanceChange, isModificationChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { createSchemeGuard, resolveValues } from '@salto-io/adapter-utils'
import Joi from 'joi'
import { addAnnotationRecursively, findObject } from '../../../utils'
import { AUTOMATION_LABEL_TYPE } from '../../../constants'
import { FilterCreator } from '../../../filter'
import { deployChanges } from '../../../deployment/standard_deployment'
import JiraClient from '../../../client/client'
import { getLookUpName } from '../../../reference_mapping'
import { getCloudId } from '../cloud_id'

const log = logger(module)

export type LabelsResponse = {
  id: number
  name: string
  color: string
}

export const LABELS_POST_RESPONSE_SCHEME = Joi.object({
  id: Joi.number().required(),
  name: Joi.string().allow('').required(),
  color: Joi.string().allow('').required(),
}).unknown(true)

export const isLabelsPostResponse = createSchemeGuard<LabelsResponse>(LABELS_POST_RESPONSE_SCHEME, 'Received an invalid page response')


const updateAutomationLabel = async (
  instance: InstanceElement,
  client: JiraClient,
): Promise<void> => {
  const resolvedInstance = await resolveValues(instance, getLookUpName)

  const data = {
    ...resolvedInstance.value,
  }

  const url = client.isDataCenter
    ? `/rest/cb-automation/latest/rule-label/${instance.value.id}`
    : `/gateway/api/automation/internal-api/jira/${await getCloudId(client)}/pro/rest/GLOBAL/rule-labels/${instance.value.id}`

  await client.put({ url, data })
}

const createAutomationLabel = async (
  instance: InstanceElement,
  client: JiraClient,
): Promise<void> => {
  const resolvedInstance = await resolveValues(instance, getLookUpName)

  const data = {
    ...resolvedInstance.value,
  }

  const url = client.isDataCenter
    ? '/rest/cb-automation/latest/rule-label'
    : `/gateway/api/automation/internal-api/jira/${await getCloudId(client)}/pro/rest/GLOBAL/rule-labels`

  const response = await client.post({ url, data })
  if (!isLabelsPostResponse(response.data)) {
    throw new Error(`Received an invalid automation label response when attempting to add automation label: ${instance.elemID.getFullName()}`)
  }
  instance.value.id = response.data.id
}

const filter: FilterCreator = ({ client, config }) => ({
  name: 'automationLabelDeployFilter',
  onFetch: async elements => {
    if (!config.client.usePrivateAPI) {
      log.debug('Skipping automation label deployment filter because private API is not enabled')
      return
    }

    const automationLabelType = findObject(elements, AUTOMATION_LABEL_TYPE)
    if (automationLabelType === undefined) {
      return
    }

    await addAnnotationRecursively(automationLabelType, CORE_ANNOTATIONS.CREATABLE)
    await addAnnotationRecursively(automationLabelType, CORE_ANNOTATIONS.UPDATABLE)
    automationLabelType.annotations[CORE_ANNOTATIONS.CREATABLE] = true
    automationLabelType.annotations[CORE_ANNOTATIONS.UPDATABLE] = true
  },

  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && getChangeData(change).elemID.typeName === AUTOMATION_LABEL_TYPE
    )

    const deployResult = await deployChanges(
      relevantChanges.filter(isInstanceChange),
      async change => {
        if (isAdditionChange(change)) {
          await createAutomationLabel(getChangeData(change), client)
        } else if (isModificationChange(change)) {
          await updateAutomationLabel(getChangeData(change), client)
        }
      }
    )
    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
