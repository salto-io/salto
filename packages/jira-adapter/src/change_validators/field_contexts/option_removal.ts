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
  isRemovalChange,
  isRemovalOrModificationChange,
  SeverityLevel,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { createSchemeGuard, getParent } from '@salto-io/adapter-utils'
import Joi from 'joi'
import { values } from '@salto-io/lowerdash'
import JiraClient from '../../client/client'
import { getContextAndFieldIds } from '../../common/fields'
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
const MAX_OPTIONS_IN_ERROR_MESSAGE = 10

type OptionInfo = {
  optionId: string
  optionElemID: ElemID
  optionValue: string
  contextId: string
  fieldId: string
  fieldName: string
  parentFullName: string
  parentOptionValue?: string
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

type FieldIssue = {
  id: string // optionId
  child?: {
    id: string // cascading optionId
  }
}

type SearchIssues = {
  id: string // issueId
  fields: Record<
    string, // fieldId
    FieldIssue | FieldIssue[] // multiple select list returns an array of FieldIssue
  >
}[]

type SearchIssuesResponse = {
  issues: SearchIssues
  nextPageToken?: string
}

const FIELD_ISSUE_SCHEME = Joi.object({
  id: Joi.string().required(),
  child: Joi.object({
    id: Joi.string().required(),
  }).unknown(true),
})
  .required()
  .unknown(true)

const SEARCH_ISSUES_RESPONSE_SCHEME = Joi.object({
  issues: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required(),
        fields: Joi.object()
          .pattern(
            Joi.string().required(),
            Joi.alternatives(Joi.array().items(FIELD_ISSUE_SCHEME), FIELD_ISSUE_SCHEME).required(),
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

const getOptionInfos = (optionInstances: InstanceElement[]): OptionInfo[] =>
  optionInstances
    .filter(optionInstance => isFieldContextOption(optionInstance.value))
    .map(optionInstance => {
      const { contextId, fieldId, fieldName } = getContextAndFieldIds(optionInstance)
      const optionParent = getParent(optionInstance)
      return {
        optionId: optionInstance.value.id,
        optionElemID: optionInstance.elemID,
        optionValue: optionInstance.value.value,
        contextId,
        fieldId,
        fieldName,
        parentFullName: optionParent.elemID.getFullName(),
        parentOptionValue:
          optionParent.elemID.typeName === FIELD_CONTEXT_OPTION_TYPE_NAME ? optionParent.value.value : undefined,
      }
    })
    .filter(isDefined)

// the options are of the same field
const getJqlForOptionsUsage = (fieldId: string, optionIds: string[]): string =>
  // cf[<fieldId>] in (<optionId1>,<optionId2>,...)
  `cf[${removeCustomFieldPrefix(fieldId)}] in (${optionIds.join(',')})`

const getOptionIdsFromSearchIssues = (searchIssues: SearchIssues): string[] =>
  searchIssues.flatMap(issue =>
    Object.values(issue.fields).flatMap(options => {
      if (Array.isArray(options)) {
        // multiple select list
        return options.map(option => option.id)
      }
      if (options.child !== undefined) {
        // cascading select list
        return [options.id, options.child.id]
      }
      // single select list
      return [options.id]
    }),
  )

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
      queryParams: {
        jql,
        fields: fieldId,
        ...(nextPageToken !== undefined ? { nextPageToken } : {}),
      },
    })
    if (!isSearchIssuesResponse(response.data)) {
      break
    }
    if (nextPageToken !== undefined && nextPageToken === response.data.nextPageToken) {
      log.error('Jira search API returned the same nextPageToken, continuing with the current result')
      break
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
  return getOptionIdsFromSearchIssues(result)
}

const collectActiveOptionsIds = async (
  fieldIdToOptionsInfo: _.Dictionary<OptionInfo[]>,
  client: JiraClient,
): Promise<Set<string>> => {
  try {
    return new Set(
      (
        await Promise.all(
          _.flatMap(fieldIdToOptionsInfo, (optionsInfo, fieldId) =>
            _.chunk(
              optionsInfo.map(optionInfo => optionInfo.optionId),
              OPTIONS_CHUNK_SIZE,
            ).map(optionIdsChunk => getActiveOptionsIds({ client, fieldId, optionIds: optionIdsChunk })),
          ),
        )
      )
        .flat()
        .filter(isDefined),
    )
  } catch (e) {
    log.error('Failed to collect active options ids with error: %o', e)
    return new Set()
  }
}

const optionMigrationLink = (fieldOptionContext: OptionInfo, baseUrl: string): string =>
  `${baseUrl}/secure/admin/EditCustomFieldOptions!remove.jspa?fieldConfigId=${fieldOptionContext.contextId}&selectedValue=${fieldOptionContext.optionId}`

const getOrderDetailedMessage = (options: OptionInfo[]): string => {
  const optionList = options.map(optionInfo => optionInfo.optionValue).join(', ')
  if (options.length > MAX_OPTIONS_IN_ERROR_MESSAGE) {
    log.info(
      'removing options from detailed message because there are over %d options. The options that removed are: %o',
      MAX_OPTIONS_IN_ERROR_MESSAGE,
      optionList,
    )
    return 'This order cannot be deployed because it depends on removing some options that are still in use by existing issues.'
  }
  return `This order cannot be deployed because it depends on removing the options ${optionList}, that are still in use by existing issues.`
}

const getFieldContextOrderErrors = (
  activeOptionRemovals: OptionInfo[],
  changes: readonly Change<ChangeDataType>[],
): ChangeError[] => {
  const relevantOrderInstances = changes
    .filter(isRemovalOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === OPTIONS_ORDER_TYPE_NAME)

  const orderByParentFullName = _.keyBy(relevantOrderInstances, orderInstance =>
    getParent(orderInstance).elemID.getFullName(),
  )
  const activeOptionsGroupedByParentFullName = _.groupBy(activeOptionRemovals, optionInfo => optionInfo.parentFullName)
  return _.map(activeOptionsGroupedByParentFullName, (options, parentFullName) => {
    const orderInstance = orderByParentFullName[parentFullName]
    if (orderInstance === undefined) {
      log.warn('No order found with parent %s, skipping', parentFullName)
    }
    return {
      elemID: orderInstance.elemID,
      severity: 'Error' as SeverityLevel,
      message: "This order is not referencing all it's options",
      detailedMessage: getOrderDetailedMessage(options),
    }
  })
}

const getOptionFullValue = (optionInfo: OptionInfo): string =>
  optionInfo.parentOptionValue === undefined
    ? optionInfo.optionValue
    : `${optionInfo.parentOptionValue}-${optionInfo.optionValue}`

const getFieldContextOptionErrors = (activeOptionRemovals: OptionInfo[], baseUrl: string): ChangeError[] =>
  activeOptionRemovals.map(optionInfo => ({
    elemID: optionInfo.optionElemID,
    severity: 'Error' as SeverityLevel,
    message: 'Cannot remove field context option as it is still in use by existing issues',
    detailedMessage: `The option "${getOptionFullValue(optionInfo)}" in the field "${optionInfo.fieldName}" is currently assigned to some issues. Please migrate these issues to a different option using the Jira UI via ${optionMigrationLink(optionInfo, baseUrl)} and then refresh your deployment.`,
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

    const optionInfos = getOptionInfos(optionInstancesToRemove).filter(
      optionInfo =>
        // filter out options removal when their context is removed as well
        !removalContextIds.has(optionInfo.contextId),
    )

    if (optionInfos.length === 0) {
      return []
    }

    const fieldIdToOptionsInfo = _.groupBy(optionInfos, optionInfo => optionInfo.fieldId)
    const activeOptionsIds = await collectActiveOptionsIds(fieldIdToOptionsInfo, client)
    const activeOptionsInfos = optionInfos.filter(optionInfo => activeOptionsIds.has(optionInfo.optionId))

    if (activeOptionsInfos.length === 0) {
      return []
    }

    return getOptionAndOrderChangeErrors({
      activeOptionsInfos,
      changes,
      baseUrl: client.baseUrl,
    })
  }
