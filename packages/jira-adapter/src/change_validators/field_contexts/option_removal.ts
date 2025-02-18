/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  ChangeDataType,
  ChangeError,
  ChangeValidator,
  ElemID,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isInstanceElement,
  isModificationChange,
  isRemovalChange,
  SeverityLevel,
  Values,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import Joi from 'joi'
import { values } from '@salto-io/lowerdash'
import JiraClient from '../../client/client'
import { getContextAndFieldIds, getContextParent } from '../../common/fields'
import { JiraConfig } from '../../config/config'
import {
  FIELD_CONTEXT_OPTION_TYPE_NAME,
  FIELD_CONTEXT_TYPE_NAME,
  OPTIONS_ORDER_TYPE_NAME,
} from '../../filters/fields/constants'
import { removeCustomFieldPrefix } from '../../filters/jql/template_expression_generator'

const log = logger(module)
const { isDefined } = values

// We search for active options using the jql "cf[<fieldId>] in (<optionId1>,<optionId2>,...)"
// the jql length is limited, therefore we use chunks
const OPTIONS_CHUNK_SIZE = 500
const MAX_ITERATIONS = 100

type OptionInfo = {
  optionId: string
  optionElemID: ElemID
  optionValue: string
  contextId: string
  fieldId: string
  fieldName: string
}

type CustomFieldContextOption = {
  id: string
  value: string
}

const CUSTOM_FIELD_CONTEXT_OPTION_SCHEME = Joi.object({
  id: Joi.string().required(),
  value: Joi.string().required(),
})
  .required()
  .unknown(true)

const isFieldContextOption = createSchemeGuard<CustomFieldContextOption>(
  CUSTOM_FIELD_CONTEXT_OPTION_SCHEME,
  'Received an invalid field context option',
)

type SearchIssues = {
  id: string // issueId
  fields: Record<
    string, // fieldId
    {
      id: string // optionId
    }[]
  >
}[]

type SearchIssuesResponse = {
  issues: SearchIssues
  nextPageToken?: string
}

const SEARCH_ISSUES_RESPONSE_SCHEME = Joi.object({
  issues: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required(),
        fields: Joi.object()
          .pattern(
            Joi.string().required(),
            Joi.array().items(
              Joi.object({
                id: Joi.string().required(),
              })
                .unknown(true)
                .required(),
            ),
          )
          .required()
          .unknown(true),
      })
        .unknown(true)
        .required(),
    )
    .required(),
  nextPageToken: Joi.string(),
})
  .unknown(true)
  .required()

const isSearchIssuesResponse = createSchemeGuard<SearchIssuesResponse>(
  SEARCH_ISSUES_RESPONSE_SCHEME,
  'Received an invalid search issues response',
)

const getOptionNameToInfo = (optionInstances: InstanceElement[]): Record<string, OptionInfo> =>
  Object.fromEntries(
    optionInstances
      .map(optionInstance => {
        if (!isFieldContextOption(optionInstance.value)) {
          return undefined
        }
        const { contextId, fieldId, fieldName } = getContextAndFieldIds(optionInstance)
        return [
          optionInstance.elemID.getFullName(),
          {
            optionId: optionInstance.value.id,
            optionElemID: optionInstance.elemID,
            optionValue: optionInstance.value.value,
            contextId,
            fieldId,
            fieldName,
          },
        ]
      })
      .filter(isDefined),
  )

// the options are of the same field
const getJqlForOptionsUsage = (fieldId: string, optionIds: string[]): string =>
  // cf[<fieldId>] in (<optionId1>,<optionId2>,...)
  `cf[${removeCustomFieldPrefix(fieldId)}] in (${optionIds.join(',')})`

const issueSearchQueryParams = ({
  jql,
  fields,
  nextPageToken,
}: {
  jql: string
  fields: string
  nextPageToken: string | undefined
}): Values =>
  nextPageToken !== undefined
    ? {
        jql,
        fields,
        nextPageToken,
      }
    : {
        jql,
        fields,
      }

const getActiveOptionsIds = async ({
  client,
  fieldId,
  optionIds,
}: {
  client: JiraClient
  fieldId: string
  optionIds: string[]
}): Promise<string[] | undefined> => {
  const jql = getJqlForOptionsUsage(fieldId, optionIds)
  let nextPageToken: string | undefined
  let currentIteration = 0
  const result: SearchIssues = []

  do {
    // eslint-disable-next-line no-await-in-loop
    const response = await client.get({
      url: 'rest/api/3/search/jql',
      queryParams: issueSearchQueryParams({
        jql,
        fields: fieldId,
        nextPageToken,
      }),
    })
    if (!isSearchIssuesResponse(response.data)) {
      return undefined
    }
    if (nextPageToken !== undefined && nextPageToken === response.data.nextPageToken) {
      throw new Error('Jira search API returned the same nextPageToken, aborting')
    }
    nextPageToken = response.data.nextPageToken
    result.push(...response.data.issues)
    currentIteration += 1
    if (currentIteration === MAX_ITERATIONS) {
      log.error(
        'Reached the maximum number of iterations while collecting active options ids, continuing with the current result',
      )
      break
    }
  } while (nextPageToken !== undefined)
  return result.flatMap(issue => Object.values(issue.fields).flatMap(options => options.map(option => option.id)))
}

const collectActiveOptionsIds = async (
  fieldIdToOptionsInfo: _.Dictionary<OptionInfo[]>,
  client: JiraClient,
): Promise<string[]> =>
  (
    await Promise.all(
      Object.entries(fieldIdToOptionsInfo).flatMap(([fieldId, optionsInfo]) =>
        _.chunk(
          optionsInfo.map(optionInfo => optionInfo.optionId),
          OPTIONS_CHUNK_SIZE,
        ).map(optionIdsChunk => getActiveOptionsIds({ client, fieldId, optionIds: optionIdsChunk })),
      ),
    )
  )
    .flat()
    .filter(isDefined)

const optionMigrationLink = (fieldOptionContext: OptionInfo, baseUrl: string): string =>
  `${baseUrl}/secure/admin/EditCustomFieldOptions!remove.jspa?fieldConfigId=${fieldOptionContext.contextId}&selectedValue=${fieldOptionContext.optionId}`

const getFieldContextOrderErrors = (
  activeOptionRemovals: OptionInfo[],
  changes: readonly Change<ChangeDataType>[],
): ChangeError[] => {
  const relevantOrderInstances = changes
    .filter(isModificationChange)
    .filter(change => change.data.before.elemID.typeName === OPTIONS_ORDER_TYPE_NAME)
    .map(getChangeData)
    .filter(isInstanceElement)

  const contextIdToOrder = _.keyBy(relevantOrderInstances, change => getContextParent(change).value.id as string)
  const contextIdToActiveOptions = _.groupBy(activeOptionRemovals, optionInfo => optionInfo.contextId)
  return Object.entries(contextIdToActiveOptions).map(([contextId, options]) => {
    const orderInstance = contextIdToOrder[contextId]
    if (orderInstance === undefined) {
      log.warn('No order found for context %s, skipping', contextId)
    }
    const detailedMessage =
      options.length > 10
        ? 'This order cannot be deployed because it depends on removing some options, which cannot be removed since they are still in use by existing issues.'
        : `This order cannot be deployed because it depends on removing the options ${options.map(optionInfo => optionInfo.optionValue).join(', ')}, which are still in use by existing issues.`
    return {
      elemID: orderInstance.elemID,
      severity: 'Error' as SeverityLevel,
      message: "This order is not referencing all it's options",
      detailedMessage,
    }
  })
}

const getFieldContextOptionErrors = (activeOptionRemovals: OptionInfo[], baseUrl: string): ChangeError[] =>
  activeOptionRemovals.map(optionInfo => ({
    elemID: optionInfo.optionElemID,
    severity: 'Error' as SeverityLevel,
    message: 'Cannot remove field context option as it is in use by issues',
    detailedMessage: `The option "${optionInfo.optionValue}" in the field "${optionInfo.fieldName}" is currently assigned to some issues. Please migrate these issues to a different option using the Jira UI via ${optionMigrationLink(optionInfo, baseUrl)} and then refresh your deployment.`,
  }))

const getOptionAndOrderChangeErrors = ({
  activeOptionsInfos,
  changes,
  baseUrl,
}: {
  activeOptionsInfos: OptionInfo[]
  changes: readonly Change<ChangeDataType>[]
  baseUrl: string
}): ChangeError[] => {
  const orderChangeErrors = getFieldContextOrderErrors(activeOptionsInfos, changes)
  const optionRemovalErrors = getFieldContextOptionErrors(activeOptionsInfos, baseUrl)
  return optionRemovalErrors.concat(orderChangeErrors)
}

/**
 * Validates whether any issues are using the context option that is being removed.
 * If these issues exist, the validator returns an error on the relevant `fieldContextOption`
 * and `fieldContextOrder` changes, prompting the user to migrate the issues in the Jira UI.
 */
export const fieldContextOptionRemovalValidator: (config: JiraConfig, client: JiraClient) => ChangeValidator =
  (config, client) => async changes => {
    if (!config.fetch.splitFieldContextOptions) {
      return []
    }

    const removalContextIds = new Set(
      changes
        .filter(isInstanceChange)
        .filter(isRemovalChange)
        .map(getChangeData)
        .filter(instance => instance.elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
        .map(instance => instance.value.id),
    )

    const optionInstancesToRemove = changes
      .filter(isInstanceChange)
      .filter(isRemovalChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === FIELD_CONTEXT_OPTION_TYPE_NAME)

    const optionNameToInfo = _.pickBy(
      getOptionNameToInfo(optionInstancesToRemove),
      optionInfo =>
        // filter out options removal when their context is removed as well
        !removalContextIds.has(optionInfo.contextId),
    )

    if (_.isEmpty(optionNameToInfo)) {
      return []
    }
    const fieldIdToOptionsInfo = _.groupBy(Object.values(optionNameToInfo), optionInfo => optionInfo.fieldId)

    let activeOptionsIds: Set<string>
    try {
      activeOptionsIds = new Set(await collectActiveOptionsIds(fieldIdToOptionsInfo, client))
    } catch (e) {
      log.error('Failed to collect active options ids with error: %o', e)
      return []
    }

    const activeOptionsInfos = Object.values(optionNameToInfo).filter(optionInfo =>
      activeOptionsIds.has(optionInfo.optionId),
    )

    if (activeOptionsInfos.length === 0) {
      return []
    }

    return getOptionAndOrderChangeErrors({
      activeOptionsInfos,
      changes,
      baseUrl: client.baseUrl,
    })
  }
