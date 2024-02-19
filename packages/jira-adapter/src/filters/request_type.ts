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

import Joi from 'joi'
import {
  AdditionChange,
  Change,
  InstanceElement,
  ModificationChange,
  ReferenceExpression,
  getChangeData,
  isAdditionChange,
  isAdditionOrModificationChange,
  isEqualValues,
  isInstanceChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { createSchemeGuard, getParent, isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'
import { ISSUE_VIEW_TYPE, REQUEST_FORM_TYPE, REQUEST_TYPE_NAME } from '../constants'
import { deployChanges, defaultDeployChange } from '../deployment/standard_deployment'
import JiraClient from '../client/client'
import { LayoutConfigItem } from './layouts/layout_types'
import {
  LayoutTypeName,
  getLayoutResponse,
  isIssueLayoutResponse,
  LAYOUT_TYPE_NAME_TO_DETAILS,
} from './layouts/layout_service_operations'

const { isDefined } = lowerDashValues
const log = logger(module)
const { replaceInstanceTypeForDeploy } = elementUtils.ducktype

type statusType = {
  id: ReferenceExpression
  custom: string
}
const STATUS_TYPE = Joi.object({
  id: Joi.any().required(),
  custom: Joi.string().allow('').required(),
})
type workflowStatusesType = statusType[]
const WORKFLOW_STATUS_TYPE = Joi.array().items(STATUS_TYPE)
const isWorkFlowStatuses = createSchemeGuard<workflowStatusesType>(WORKFLOW_STATUS_TYPE)

const FIELDS_TO_IGNORE = ['issueView', 'requestForm', 'workflowStatuses', 'avatarId', 'groupIds']

const deployWorkflowStatuses = async (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  client: JiraClient,
): Promise<void> => {
  if (
    isAdditionChange(change) ||
    (isModificationChange(change) &&
      !isEqualValues(change.data.before.value.workflowStatuses, change.data.after.value.workflowStatuses))
  ) {
    const instance = getChangeData(change)
    const parent = getParent(instance)
    if (!isWorkFlowStatuses(instance.value.workflowStatuses)) {
      throw new Error('Failed to deploy request type workflow statuses due to bad workflow statuses')
    }
    const workflowStatuses = instance.value.workflowStatuses.map(status => ({
      id: status.id?.value.value.id,
      original: status.id?.value.value.name,
      custom: status.custom,
    }))
    await client.post({
      url: `/rest/servicedesk/1/servicedesk-data/${parent.value.key}/request-type/${instance.value.id}/workflow`,
      data: workflowStatuses,
    })
  }
}

const isRequestTypeDetailsChange = (change: ModificationChange<InstanceElement>, fieldName: string): boolean =>
  fieldName === 'requestForm' &&
  ['name', 'description', 'helpText'].some(
    additionalFieldName =>
      change.data.before.value[additionalFieldName] !== change.data.after.value[additionalFieldName],
  )

const deployRequestTypeLayout = async (
  change: Change<InstanceElement>,
  client: JiraClient,
  typeName: LayoutTypeName,
): Promise<void> => {
  const requestType = getChangeData(change)
  const { fieldName } = LAYOUT_TYPE_NAME_TO_DETAILS[typeName]
  if (
    !isAdditionChange(change) &&
    (!isModificationChange(change) ||
      (isEqualValues(change.data.before.value[fieldName], change.data.after.value[fieldName]) &&
        !isRequestTypeDetailsChange(change, fieldName)))
  ) {
    return undefined
  }
  const layout = requestType.value[fieldName]
  const items = layout.issueLayoutConfig.items
    .map((item: LayoutConfigItem) => {
      if (!isResolvedReferenceExpression(item.key)) {
        log.error(
          `Failed to deploy request type: ${requestType.elemID.getFullName()}'s ${fieldName} due to bad reference expression`,
        )
        throw new Error(`Failed to deploy requestType ${fieldName} due to a bad item key: ${item.key}`)
      }
      const key = item.key.value.value.id
      return {
        type: item.type,
        sectionType: item.sectionType.toLowerCase(),
        key,
        data: {
          name: item.key.value.value.name,
          type:
            item.key.value.value.type ??
            item.key.value.value.schema?.system ??
            item.key.value.value.name.toLowerCase?.(),
          ...item.data,
        },
      }
    })
    .filter(isDefined)

  const data = {
    projectId: getParent(requestType).value.id,
    extraDefinerId: requestType.value.id,
    issueLayoutType: LAYOUT_TYPE_NAME_TO_DETAILS[typeName].layoutType,
    owners: [
      {
        type: 'REQUEST_TYPE',
        data: {
          id: requestType.value.id,
          name: requestType.value.name,
          description: requestType.value.description,
          avatarId: requestType.value.avatarId,
          instructions: requestType.value.helpText,
        },
      },
    ],
    issueLayoutConfig: {
      items,
    },
  }
  if (isAdditionChange(change)) {
    const variables = {
      projectId: getParent(requestType).value.id,
      extraDefinerId: requestType.value.id,
      layoutType: LAYOUT_TYPE_NAME_TO_DETAILS[typeName].layoutType,
    }
    const response = await getLayoutResponse({ variables, client, typeName })
    if (!isIssueLayoutResponse(response.data)) {
      log.error(
        `Failed to deploy requestType's ${LAYOUT_TYPE_NAME_TO_DETAILS[typeName].fieldName} due to bad response from jira service`,
      )
      throw new Error(
        `Failed to deploy requestType's ${LAYOUT_TYPE_NAME_TO_DETAILS[typeName].fieldName} due to bad response from jira service`,
      )
    }
    layout.id = response.data.issueLayoutConfiguration.issueLayoutResult.id
  }
  const url = `/rest/internal/1.0/issueLayouts/${layout.id}`
  await client.put({ url, data })
  return undefined
}

/*
 * Deploy requestType filter. Using it because it needs to be deployed
 * through different API calls.
 */
const filter: FilterCreator = ({ config, client }) => ({
  name: 'requestTypeFilter',
  deploy: async (changes: Change<InstanceElement>[]) => {
    const { jsmApiDefinitions } = config
    if (!config.fetch.enableJSM || jsmApiDefinitions === undefined) {
      return {
        deployResult: { appliedChanges: [], errors: [] },
        leftoverChanges: changes,
      }
    }
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === REQUEST_TYPE_NAME && isInstanceChange(change),
    )
    const typeFixedChanges = relevantChanges.map(change => ({
      action: change.action,
      data: _.mapValues(change.data, (instance: InstanceElement) =>
        replaceInstanceTypeForDeploy({
          instance,
          config: jsmApiDefinitions,
        }),
      ),
    })) as Change<InstanceElement>[]

    const deployResult = await deployChanges(typeFixedChanges, async change => {
      if (isAdditionOrModificationChange(change)) {
        if (isAdditionChange(change)) {
          await defaultDeployChange({
            change,
            client,
            apiDefinitions: jsmApiDefinitions,
            fieldsToIgnore: FIELDS_TO_IGNORE,
          })
        }
        await deployRequestTypeLayout(change, client, REQUEST_FORM_TYPE)
        await deployRequestTypeLayout(change, client, ISSUE_VIEW_TYPE)
        await deployWorkflowStatuses(change, client)
      } else {
        await defaultDeployChange({
          change,
          client,
          apiDefinitions: jsmApiDefinitions,
          fieldsToIgnore: FIELDS_TO_IGNORE,
        })
      }
    })
    return { deployResult, leftoverChanges }
  },
})
export default filter
