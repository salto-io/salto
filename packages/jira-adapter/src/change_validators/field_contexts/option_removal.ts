/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
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
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import Joi from 'joi'
import { values } from '@salto-io/lowerdash'
import JiraClient from '../../client/client'
import { getContextAndFieldIds, getContextParent } from '../../common/fields'
import { JiraConfig } from '../../config/config'
import { FIELD_CONTEXT_OPTION_TYPE_NAME, OPTIONS_ORDER_TYPE_NAME } from '../../filters/fields/constants'
import { removeCustomFieldPrefix } from '../../filters/jql/template_expression_generator'

const log = logger(module)
const { isDefined } = values

type FieldOptionContext = {
  optionId: string
  optionElemID: ElemID
  optionValue: string
  contextId: string
  fieldId: string
  fieldName: string
  isActive?: boolean
}

type SearchIssuesResponse = {
  issues: {
    id: string
  }[]
}

const SEARCH_ISSUES_RESPONSE_SCHEME = Joi.object({
  issues: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required(),
      })
        .unknown(true)
        .required(),
    )
    .required(),
})
  .unknown(true)
  .required()

const isSearchIssuesResponse = createSchemeGuard<SearchIssuesResponse>(
  SEARCH_ISSUES_RESPONSE_SCHEME,
  'Received an invalid search issues response',
)

const getOptionNameToFieldOptionContext = (
  optionChanges: Change<InstanceElement>[],
): Record<string, FieldOptionContext> => {
  const optionNameToFieldOptionContext: Record<string, FieldOptionContext> = {}
  optionChanges.forEach(optionChange => {
    const optionInstance = getChangeData(optionChange)
    const { contextId, fieldId, fieldName } = getContextAndFieldIds(optionChange)
    optionNameToFieldOptionContext[optionInstance.elemID.getFullName()] = {
      optionId: optionInstance.value.id,
      optionElemID: optionInstance.elemID,
      optionValue: optionInstance.value.value,
      contextId,
      fieldId: removeCustomFieldPrefix(fieldId),
      fieldName,
    }
  })
  return optionNameToFieldOptionContext
}

const getJqlForOptionUsage = (fieldOptionContext: FieldOptionContext): string =>
  `cf[${fieldOptionContext.fieldId}] = ${fieldOptionContext.optionId}`

const isActiveOption = async (
  client: JiraClient,
  fieldOptionContext: FieldOptionContext,
): Promise<boolean | undefined> => {
  const jql = getJqlForOptionUsage(fieldOptionContext)
  const response = await client.getPrivate({
    url: 'rest/api/3/search/jql',
    queryParams: {
      jql,
    },
  })
  if (!isSearchIssuesResponse(response.data)) {
    return undefined
  }
  return response.data.issues.length > 0
}

const optionMigrationLink = (client: JiraClient, fieldOptionContext: FieldOptionContext): string =>
  `${client.baseUrl}/secure/admin/EditCustomFieldOptions!remove.jspa?fieldConfigId=${fieldOptionContext.contextId}&selectedValue=${fieldOptionContext.optionId}`

const getFiledContextOrderErrors = (
  activeOptionRemovals: FieldOptionContext[],
  contextIdToOrder: Record<string, InstanceElement>,
): ChangeError[] =>
  activeOptionRemovals
    .map(fieldOptionContext => ({
      fieldOptionContext,
      fieldContextOptionsOrder: contextIdToOrder[fieldOptionContext.contextId],
    }))
    .filter(({ fieldContextOptionsOrder }) => fieldContextOptionsOrder !== undefined)
    .map(({ fieldOptionContext, fieldContextOptionsOrder }) => ({
      elemID: fieldContextOptionsOrder.elemID,
      severity: 'Error' as SeverityLevel,
      message: "This order is not referencing all it's options",
      detailedMessage: `This order cannot be deployed because it depends on removing the option '${fieldOptionContext.optionValue}', which cannot be deployed because it is still in use by existing issues.`,
    }))

const getFieldContextOptionErrors = (activeOptionRemovals: FieldOptionContext[], client: JiraClient): ChangeError[] =>
  activeOptionRemovals.map(fieldOptionContext => ({
    elemID: fieldOptionContext.optionElemID,
    severity: 'Error' as SeverityLevel,
    message: 'Cannot remove field context option as it is in use by issues',
    detailedMessage: `The option "${fieldOptionContext.optionValue}" of field "${fieldOptionContext.fieldName}" is in use by issues. Please migrate the issues to another option in Jira UI via ${optionMigrationLink(client, fieldOptionContext)}, and then refresh the deployment.`,
  }))

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
    const optionRemovalChanges = changes
      .filter(isInstanceChange)
      .filter(isRemovalChange)
      .filter(change => change.data.before.elemID.typeName === FIELD_CONTEXT_OPTION_TYPE_NAME)
    if (_.isEmpty(optionRemovalChanges)) {
      return []
    }

    const optionNameToFieldOptionContext = getOptionNameToFieldOptionContext(optionRemovalChanges)
    const activeOptionRemovals = (
      await Promise.all(
        optionRemovalChanges.map(getChangeData).map(async option => {
          const fieldOptionContext = optionNameToFieldOptionContext[option.elemID.getFullName()]
          if (fieldOptionContext === undefined) {
            log.error('Failed to find field option context for option removal')
            return undefined
          }
          fieldOptionContext.isActive = await isActiveOption(client, fieldOptionContext)
          return fieldOptionContext
        }),
      )
    )
      .filter(isDefined)
      .filter(option => option.isActive)

    if (_.isEmpty(activeOptionRemovals)) {
      return []
    }

    const relevantOrderInstances = changes
      .filter(isModificationChange)
      .filter(change => change.data.before.elemID.typeName === OPTIONS_ORDER_TYPE_NAME)
      .map(getChangeData)
      .filter(isInstanceElement)

    const contextIdToOrder = _.keyBy(relevantOrderInstances, change => getContextParent(change).value.id) as Record<
      string,
      InstanceElement
    >
    const orderChangeErrors = getFiledContextOrderErrors(activeOptionRemovals, contextIdToOrder)
    const optionRemovalErrors = getFieldContextOptionErrors(activeOptionRemovals, client)

    return optionRemovalErrors.concat(orderChangeErrors)
  }
