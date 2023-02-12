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
import { ActionName, BuiltinTypes, Change, CORE_ANNOTATIONS, ElemID, Field, getChangeData, InstanceElement, isInstanceChange, isInstanceElement, isModificationChange, isRemovalOrModificationChange, ListType, ModificationChange, ObjectType, ReadOnlyElementsSource, RemovalChange, Values } from '@salto-io/adapter-api'
import { elements as elementUtils, client as clientUtils, config as configUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { applyFunctionToChangeData, resolveValues, safeJsonStringify } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { handleDeploymentError } from '../deployment/deployment_error_handling'
import { getLookUpName } from '../reference_mapping'
import { findObject } from '../utils'
import { FilterCreator } from '../filter'
import { ISSUE_TYPE_NAME, JIRA, STATUS_TYPE_NAME } from '../constants'
import { defaultDeployChange, deployChanges } from '../deployment/standard_deployment'
import JiraClient from '../client/client'
import { JiraConfig } from '../config/config'

const { awu } = collections.asynciterable

const WORKFLOW_SCHEME_TYPE = 'WorkflowScheme'
const WORKFLOW_SCHEME_ITEM_TYPE = 'WorkflowSchemeItem'

export const MAX_TASK_CHECKS = 60
const TASK_CHECK_INTERVAL_MILLI = 1000

const log = logger(module)

class PublishDraftError extends Error {
  constructor(message: string) {
    super(message)
  }
}

class InvalidResponseError extends PublishDraftError {
  constructor() {
    super('Failed to publish workflow scheme draft due to invalid response')
  }
}

class TooManyRetriesError extends PublishDraftError {
  constructor() {
    super('Failed to publish workflow scheme draft after too many retries')
  }
}

const shouldThrowError = (error: Error): boolean =>
  error instanceof PublishDraftError

function validateTaskResponse(
  response: clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>
): asserts response is clientUtils.Response<clientUtils.ResponseValue & { self: string }> {
  if (Array.isArray(response.data) || !_.isString(response.data.self)) {
    log.warn(`Received unexpected response from when attempted to publish workflow scheme: ${safeJsonStringify(response.data, undefined, 2)}`)
    throw new InvalidResponseError()
  }
}

const waitForWorkflowSchemePublish = async (
  taskResponse: clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>,
  client: JiraClient,
  checksLeft: number,
): Promise<void> => {
  validateTaskResponse(taskResponse)

  if (taskResponse.data.result !== undefined) {
    if (taskResponse.data.status !== 'COMPLETE') {
      log.warn(`Failed to publish workflow scheme draft: ${safeJsonStringify(taskResponse.data, undefined, 2)}`)
      throw new Error('Failed to publish workflow scheme draft')
    }
    return
  }

  if (checksLeft === 0) {
    log.warn(`Publish draft operation did not finish, last response: ${safeJsonStringify(taskResponse.data, undefined, 2)}`)
    throw new TooManyRetriesError()
  }

  await new Promise(resolve => {
    setTimeout(resolve, TASK_CHECK_INTERVAL_MILLI)
  })

  await waitForWorkflowSchemePublish(
    await client.getSinglePage({ url: taskResponse.data.self }),
    client,
    checksLeft - 1,
  )
}

const publishDraft = async (
  change: Change<InstanceElement>,
  client: JiraClient,
  statusMigrations?: Values[]
): Promise<void> => {
  const response = await client.post({
    url: `/rest/api/3/workflowscheme/${getChangeData(change).value.id}/draft/publish`,
    data: statusMigrations !== undefined
      ? {
        statusMappings: statusMigrations,
      }
      : {},
  })

  await waitForWorkflowSchemePublish(response, client, MAX_TASK_CHECKS)
}

export const updateSchemeId = async (
  change: ModificationChange<InstanceElement> | RemovalChange<InstanceElement>,
  client: JiraClient,
  paginator: clientUtils.Paginator,
  config: JiraConfig,
): Promise<void> => {
  const instance = getChangeData(change)
  const response = await client.getSinglePage({
    url: `/rest/api/3/workflowscheme/${instance.value.id}`,
  })
  if (response.status === 200
    && !Array.isArray(response.data)
    && response.data.name === instance.value.name) {
    return
  }

  const id = (await awu(paginator(
    config.apiDefinitions.types.WorkflowSchemes.request as configUtils.FetchRequestConfig,
    page => collections.array.makeArray(page.values) as clientUtils.ResponseValue[]
  )).flat().find(scheme => scheme.name === instance.value.name))?.id

  if (id !== undefined) {
    instance.value.id = id
  } else {
    log.warn(`Failed to find workflow scheme with name ${instance.value.name} after deploy`)
  }
}

export const preDeployWorkflowScheme = async (
  instance: InstanceElement,
  action: ActionName,
  elementsSource?: ReadOnlyElementsSource
): Promise<void> => {
  const resolvedInstance = await resolveValues(instance, getLookUpName, elementsSource)
  instance.value.issueTypeMappings = _(resolvedInstance.value.items ?? [])
    .keyBy(mapping => mapping.issueType)
    .mapValues(mapping => mapping.workflow)
    .value()

  if (action === 'modify') {
    instance.value.updateDraftIfNeeded = true
  }
}

const replaceIDsWithNames = ({
  messages,
  IDs,
  IDToInstance,
}:{
  messages: string[]
  IDs: string[]
  IDToInstance: Record<string, InstanceElement>
}): string[] =>
  messages
    .map(msg => _.reduce(IDs, (m, id) =>
      m.replace(id, IDToInstance[id] !== undefined ? IDToInstance[id].elemID.name : `ID ${id}`), msg))
    .map(msg => msg.replace(new RegExp(' ID'), ' name'))

const createMappingFromID = async (elementsSource: ReadOnlyElementsSource, typeName: string)
  :Promise<Record<string, InstanceElement>> =>
  awu(await elementsSource.list())
    .filter(id => id.typeName === typeName && id.idType === 'instance')
    .map(id => elementsSource.get(id))
    .keyBy(inst => inst.value.id)

const reformatIssueID = (
  messages: string[],
  IDToInstance:Record<string, InstanceElement>,
): string[] => {
  // for example catch the id in the parentheses: 'Issue type with ID <10008> is missing ...'
  const IDs = messages.flatMap((message: string) => message.match(new RegExp('Issue type with ID (\\d+).*'))?.[1] ?? [])
  return replaceIDsWithNames({ messages, IDs, IDToInstance })
}

const reformatStatusesID = (
  messages: string[],
  IDToInstance:Record<string, InstanceElement>
): string[] => {
  // for example catch the ids in the parentheses: '...statuses with IDs <10018,3,4,10165,10005>.'
  const IDs = messages.flatMap((message: string) => message.match(new RegExp('.*statuses? with IDs? (\\d+(?:,\\d+)*)'))?.[1] ?? [])
  return replaceIDsWithNames({ messages, IDs: IDs.flatMap(m => m.split(',')), IDToInstance })
}

const reformatMigrationErrorMessages = async (errorMessages: string[],
  elementsSource: ReadOnlyElementsSource) : Promise<string[]> => {
  const [relevantMessages, otherMessages] = _.partition(errorMessages, (message: string) => message.includes('is missing the mappings required for statuses'))
  const idsToInstance = {
    [ISSUE_TYPE_NAME]: await createMappingFromID(elementsSource, ISSUE_TYPE_NAME),
    [STATUS_TYPE_NAME]: await createMappingFromID(elementsSource, STATUS_TYPE_NAME),
  }
  const newMessages = reformatStatusesID(
    reformatIssueID(relevantMessages, idsToInstance[ISSUE_TYPE_NAME]),
    idsToInstance[STATUS_TYPE_NAME]
  )
  return newMessages.concat(otherMessages)
}

export const deployWorkflowScheme = async (
  change: Change<InstanceElement>,
  client: JiraClient,
  paginator: clientUtils.Paginator,
  config: JiraConfig,
  elementsSource: ReadOnlyElementsSource
): Promise<void> => {
  const instance = getChangeData(change)

  if (isRemovalOrModificationChange(change)) {
    // For some reason sometime the id is changed after publishing the draft
    await updateSchemeId(change, client, paginator, config)
  }

  const { statusMigrations } = (await resolveValues(instance, getLookUpName, elementsSource)).value
  delete instance.value.statusMigrations

  const response = await defaultDeployChange({
    change,
    client,
    apiDefinitions: config.apiDefinitions,
    fieldsToIgnore: ['items'],
    elementsSource,
  })

  if (isModificationChange(change) && !Array.isArray(response) && response?.draft) {
    try {
      await publishDraft(change, client, statusMigrations)
    } catch (err) {
      if (shouldThrowError(err)) {
        throw err
      }
      try {
        err.message = 'Failed to publish draft with error: '
        err.response.data.errorMessages = await reformatMigrationErrorMessages(
          err.response.data.errorMessages, elementsSource
        )
        handleDeploymentError(err)
        log.warn(`failed to publish draft for workflow scheme ${getChangeData(change).elemID.name}, error: ${err.message}`)
      } catch (error) {
        log.warn(`failed to reformat the workflow scheme ${getChangeData(change).elemID.getFullName()} migration error `)
      }
    }
  }
}

const filter: FilterCreator = ({ config, client, paginator, elementsSource }) => ({
  name: 'workflowSchemeFilter',
  onFetch: async elements => {
    const workflowSchemeType = findObject(elements, WORKFLOW_SCHEME_TYPE)
    if (workflowSchemeType !== undefined) {
      const workflowSchemeItemType = new ObjectType({
        elemID: new ElemID(JIRA, WORKFLOW_SCHEME_ITEM_TYPE),
        fields: {
          issueType: {
            refType: BuiltinTypes.STRING,
            annotations: {
              [CORE_ANNOTATIONS.CREATABLE]: true,
              [CORE_ANNOTATIONS.UPDATABLE]: true,
            },
          },
          workflow: {
            refType: BuiltinTypes.STRING,
            annotations: {
              [CORE_ANNOTATIONS.CREATABLE]: true,
              [CORE_ANNOTATIONS.UPDATABLE]: true,
            },
          },
        },
        path: [JIRA, elementUtils.TYPES_PATH, WORKFLOW_SCHEME_ITEM_TYPE],
      })

      workflowSchemeType.fields.items = new Field(
        workflowSchemeType,
        'items',
        new ListType(workflowSchemeItemType),
        {
          [CORE_ANNOTATIONS.CREATABLE]: true,
          [CORE_ANNOTATIONS.UPDATABLE]: true,
        }
      )

      if (workflowSchemeType.fields.issueTypeMappings !== undefined) {
        delete workflowSchemeType.fields.issueTypeMappings
      }

      const statusMigrationType = new ObjectType({
        elemID: new ElemID(JIRA, 'StatusMigration'),
        fields: {
          issueTypeId: {
            refType: BuiltinTypes.STRING,
            annotations: { [CORE_ANNOTATIONS.UPDATABLE]: true },
          },
          statusId: {
            refType: BuiltinTypes.STRING,
            annotations: { [CORE_ANNOTATIONS.UPDATABLE]: true },
          },
          newStatusId: {
            refType: BuiltinTypes.STRING,
            annotations: { [CORE_ANNOTATIONS.UPDATABLE]: true },
          },
        },
        path: [JIRA, elementUtils.TYPES_PATH, 'StatusMigration'],
      })

      workflowSchemeType.fields.statusMigrations = new Field(
        workflowSchemeType,
        'statusMigrations',
        new ListType(statusMigrationType),
        {
          [CORE_ANNOTATIONS.UPDATABLE]: true,
        }
      )

      elements.push(workflowSchemeItemType, statusMigrationType)
    }

    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === WORKFLOW_SCHEME_TYPE)
      .filter(instance => instance.value.issueTypeMappings !== undefined)
      .forEach(instance => {
        instance.value.items = Object.entries(instance.value.issueTypeMappings
          .additionalProperties ?? {}).map(([issueType, workflow]) => ({ workflow, issueType }))
        delete instance.value.issueTypeMappings
      })
  },

  preDeploy: async changes => (
    awu(changes)
      .filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.typeName === WORKFLOW_SCHEME_TYPE)
      .forEach(change => applyFunctionToChangeData<Change<InstanceElement>>(
        change,
        async instance => {
          await preDeployWorkflowScheme(instance, change.action)
          return instance
        },
      ))
  ),

  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && getChangeData(change).elemID.typeName === WORKFLOW_SCHEME_TYPE
    )


    const deployResult = await deployChanges(
      relevantChanges
        .filter(isInstanceChange),
      async change => deployWorkflowScheme(change, client, paginator, config, elementsSource),
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },

  onDeploy: async changes => (
    awu(changes)
      .filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.typeName === WORKFLOW_SCHEME_TYPE)
      .forEach(change => applyFunctionToChangeData<Change<InstanceElement>>(
        change,
        async instance => {
          delete instance.value.issueTypeMappings
          if (isModificationChange(change)) {
            delete instance.value.updateDraftIfNeeded
          }
          return instance
        }
      ))
  ),
})

export default filter
