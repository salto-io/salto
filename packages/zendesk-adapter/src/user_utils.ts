/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import Joi from 'joi'
import { logger } from '@salto-io/logging'
import { client as clientUtils, definitions } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { createSchemeGuard, ERROR_MESSAGES } from '@salto-io/adapter-utils'
import { SaltoError, Values } from '@salto-io/adapter-api'
import ZendeskClient from './client/client'
import { ValueReplacer, replaceConditionsAndActionsCreator, fieldReplacer } from './replacers_utils'
import { CURSOR_BASED_PAGINATION_FIELD, DEFAULT_QUERY_PARAMS } from './config'

const log = logger(module)
const { toArrayAsync } = collections.asynciterable
const { makeArray } = collections.array

const MISSING_DEPLOY_CONFIG_USER =
  'User provided in defaultMissingUserFallback does not exist in the target environment'
// system options that do not contain a specific user value
export const VALID_USER_VALUES = [
  'current_user',
  'all_agents',
  'requester_id',
  'assignee_id',
  'requester_and_ccs',
  'agent',
  'end_user',
  '',
  '__NULL__',
]
export const MISSING_USERS_DOC_LINK =
  'https://help.salto.io/en/articles/6955302-element-references-users-which-don-t-exist-in-target-environment-zendesk'
export const MISSING_USERS_ERROR_MSG = "Instance references users which don't exist in target environment"

export type User = {
  id: number
  name: string
  email: string
  role: string
  custom_role_id?: number | null
  locale: string
}

type CurrentUserResponse = {
  user: User
}

const EXPECTED_USER_SCHEMA = Joi.object({
  id: Joi.number().required(),
  name: Joi.string().required(),
  email: Joi.string().required(),
  role: Joi.string(),
  custom_role_id: Joi.number().allow(null),
  locale: Joi.string().required(),
}).unknown(true)

const EXPECTED_USERS_SCHEMA = Joi.array().items(EXPECTED_USER_SCHEMA).required()

const CURRENT_USER_RESPONSE_SCHEME = Joi.object({
  user: EXPECTED_USER_SCHEMA,
}).required()

export const isCurrentUserResponse = createSchemeGuard<CurrentUserResponse>(
  CURRENT_USER_RESPONSE_SCHEME,
  'Received an invalid current user response',
)

const areUsers = (values: unknown): values is User[] => {
  const { error } = EXPECTED_USERS_SCHEMA.validate(values)
  if (error !== undefined) {
    log.warn(`Received an invalid response for the users values: ${error.message}`)
    return false
  }
  return true
}

const replaceRestrictionImpl = (values: Values, mapping?: Record<string, string>): string[] => {
  const restrictionRelativePath = ['restriction', 'id']
  const id = _.get(values, restrictionRelativePath)
  if (values.restriction?.type !== 'User' || id === undefined) {
    return []
  }
  if (mapping !== undefined) {
    const newValue = Object.prototype.hasOwnProperty.call(mapping, id) ? mapping[id] : undefined
    if (newValue !== undefined) {
      values.restriction.id = newValue
    }
  }
  return restrictionRelativePath
}

const replaceRestriction: ValueReplacer = (instance, mapping) => {
  const relativePath = replaceRestrictionImpl(instance.value, mapping)
  return _.isEmpty(relativePath) ? [] : [instance.elemID.createNestedID(...relativePath)]
}

const workspaceReplacer: ValueReplacer = (instance, mapping) => {
  const selectedMacros = instance.value.selected_macros
  return (selectedMacros ?? []).flatMap((macro: Values, index: number) => {
    const relativePath = replaceRestrictionImpl(macro, mapping)
    return _.isEmpty(relativePath)
      ? []
      : [instance.elemID.createNestedID('selected_macros', index.toString(), ...relativePath)]
  })
}

const mergeUserReplacers =
  (replacers: ValueReplacer[]): ValueReplacer =>
  (instance, mapping) =>
    replacers.flatMap(replacer => replacer(instance, mapping))

const DEFAULT_REPLACER_PARAMS_FOR_ACTIONS = [
  { fieldName: ['actions'], fieldsToReplace: [{ name: 'assignee_id' }, { name: 'follower' }] },
]
const DEFAULT_REPLACER_PARAMS_FOR_CONDITIONS = [
  { fieldName: ['conditions', 'all'], fieldsToReplace: [{ name: 'assignee_id' }, { name: 'requester_id' }] },
  { fieldName: ['conditions', 'any'], fieldsToReplace: [{ name: 'assignee_id' }, { name: 'requester_id' }] },
]

export const TYPE_NAME_TO_REPLACER: Record<string, ValueReplacer> = {
  automation: replaceConditionsAndActionsCreator([
    ...[
      {
        fieldName: ['actions'],
        fieldsToReplace: [
          { name: 'assignee_id' },
          { name: 'follower' },
          { name: 'notification_user', valuePath: ['value', '0'] },
        ],
      },
    ],
    ...DEFAULT_REPLACER_PARAMS_FOR_CONDITIONS,
  ]),
  macro: mergeUserReplacers([
    replaceConditionsAndActionsCreator(DEFAULT_REPLACER_PARAMS_FOR_ACTIONS),
    replaceRestriction,
  ]),
  routing_attribute_value: replaceConditionsAndActionsCreator([
    { fieldName: ['conditions', 'all'], fieldsToReplace: [{ name: 'requester_id' }] },
    { fieldName: ['conditions', 'any'], fieldsToReplace: [{ name: 'requester_id' }] },
  ]),
  sla_policy: replaceConditionsAndActionsCreator(
    [
      { fieldName: ['filter', 'all'], fieldsToReplace: [{ name: 'assignee_id' }, { name: 'requester_id' }] },
      { fieldName: ['filter', 'any'], fieldsToReplace: [{ name: 'assignee_id' }, { name: 'requester_id' }] },
    ],
    true,
  ),
  trigger: replaceConditionsAndActionsCreator([
    ...[
      {
        fieldName: ['actions'],
        fieldsToReplace: [
          { name: 'assignee_id' },
          { name: 'follower' },
          { name: 'notification_user', valuePath: ['value', '0'] },
          { name: 'notification_sms_user', valuePath: ['value', '0'] },
        ],
      },
    ],
    ...[
      {
        fieldName: ['conditions', 'all'],
        fieldsToReplace: [{ name: 'assignee_id' }, { name: 'requester_id' }, { name: 'role' }],
      },
      {
        fieldName: ['conditions', 'any'],
        fieldsToReplace: [{ name: 'assignee_id' }, { name: 'requester_id' }, { name: 'role' }],
      },
    ],
  ]),
  view: mergeUserReplacers([
    replaceConditionsAndActionsCreator(DEFAULT_REPLACER_PARAMS_FOR_CONDITIONS),
    replaceRestriction,
  ]),
  workspace: mergeUserReplacers([
    replaceConditionsAndActionsCreator([
      { fieldName: ['conditions', 'all'], fieldsToReplace: [{ name: 'assignee_id' }] },
      { fieldName: ['conditions', 'any'], fieldsToReplace: [{ name: 'assignee_id' }] },
    ]),
    workspaceReplacer,
  ]),
  ticket_field: replaceConditionsAndActionsCreator([
    { fieldName: ['relationship_filter', 'all'], fieldsToReplace: [{ name: 'assignee_id' }, { name: 'requester_id' }] },
    { fieldName: ['relationship_filter', 'any'], fieldsToReplace: [{ name: 'assignee_id' }, { name: 'requester_id' }] },
  ]),
  oauth_token: fieldReplacer(['user_id']),
  user_segment: fieldReplacer(['added_user_ids']),
  article: fieldReplacer(['author_id']),
  section_translation: fieldReplacer(['created_by_id', 'updated_by_id']),
  category_translation: fieldReplacer(['created_by_id', 'updated_by_id']),
  article_translation: fieldReplacer(['created_by_id', 'updated_by_id']),
}

const getUsersNoCache = async (paginator: clientUtils.Paginator): Promise<{ users: User[]; errors?: SaltoError[] }> => {
  const paginationArgs = {
    url: '/api/v2/users',
    paginationField: CURSOR_BASED_PAGINATION_FIELD,
    queryParams: {
      role: ['admin', 'agent'],
      ...DEFAULT_QUERY_PARAMS,
    },
  }
  try {
    const users = (
      await toArrayAsync(paginator(paginationArgs, page => makeArray(page) as clientUtils.ResponseValue[]))
    )
      .flat()
      .flatMap(response => response.users)
    if (!areUsers(users)) {
      return { users: [] }
    }
    return { users }
  } catch (e) {
    if (e.response?.status === 403 || e.response?.status === 401) {
      const message =
        "Salto could not access the users resource. Elements from that type were not fetched. Please make sure that this type is enabled in your service, and that the supplied user credentials have sufficient permissions to access this data. You can also exclude this data from Salto's fetches by changing the environment configuration. Learn more at https://help.salto.io/en/articles/6947061-salto-could-not-access-the-resource"
      const newError: SaltoError = {
        message: ERROR_MESSAGES.OTHER_ISSUES,
        detailedMessage: message,
        severity: 'Warning',
      }
      return { users: [], errors: [newError] }
    }
    throw e
  }
}

/*
 * Fetch all users with admin and agent roles.
 * Results are cached after the initial call to improve performance.
 *
 */
const getUsersFunc = (): ((
  paginator: clientUtils.Paginator,
  runQuery: boolean | undefined,
) => Promise<{ users: User[]; errors?: SaltoError[] }>) => {
  let calculatedUsersPromise: Promise<{ users: User[]; errors?: SaltoError[] }>

  const getUsers = async (
    paginator: clientUtils.Paginator,
    runQuery: boolean | undefined,
  ): Promise<{ users: User[]; errors?: SaltoError[] }> => {
    if (calculatedUsersPromise === undefined) {
      if (runQuery === false) {
        calculatedUsersPromise = Promise.resolve({ users: [], errors: [] })
      } else {
        calculatedUsersPromise = getUsersNoCache(paginator)
      }
    }
    return calculatedUsersPromise
  }

  return getUsers
}

export const getUsers = getUsersFunc()

/**
 * Get user fallback value that will replace missing users values
 * based on the user's deploy config
 */
export const getUserFallbackValue = async ({
  defaultMissingUserFallback,
  existingUsers,
  client,
  shouldResolveUserIDs,
}: {
  defaultMissingUserFallback: string
  existingUsers: Set<string>
  client: ZendeskClient
  shouldResolveUserIDs?: boolean
}): Promise<string | number | undefined> => {
  if (defaultMissingUserFallback === definitions.DEPLOYER_FALLBACK_VALUE) {
    try {
      const response = (
        await client.get({
          url: '/api/v2/users/me',
        })
      ).data
      if (isCurrentUserResponse(response)) {
        return shouldResolveUserIDs === false ? response.user.id : response.user.email
      }
      log.error("Received invalid response from endpoint '/api/v2/users/me'")
    } catch (e) {
      log.error('Attempt to get current user details has failed with error: %o', e)
    }
    return undefined
  }
  if (!existingUsers.has(defaultMissingUserFallback)) {
    log.error(MISSING_DEPLOY_CONFIG_USER)
    return undefined
  }
  return defaultMissingUserFallback
}

const getIdByEmailFunc = (): ((
  paginator: clientUtils.Paginator,
  runQuery: boolean | undefined,
) => Promise<Record<string, string>>) => {
  let idToEmail: Record<string, string>

  const getIdByEmail = async (
    paginator: clientUtils.Paginator,
    runQuery: boolean | undefined,
  ): Promise<Record<string, string>> => {
    if (idToEmail !== undefined) {
      return idToEmail
    }
    const { users } = await getUsers(paginator, runQuery)
    if (_.isEmpty(users)) {
      idToEmail = {}
      return {}
    }
    idToEmail = Object.fromEntries(users.map(user => [user.id.toString(), user.email])) as Record<string, string>
    return idToEmail
  }
  return getIdByEmail
}

export const getIdByEmail = getIdByEmailFunc()

const getIdByNameFunc = (): ((
  paginator: clientUtils.Paginator,
  runQuery: boolean | undefined,
) => Promise<Record<string, string>>) => {
  let idToName: Record<string, string>

  const getIdByName = async (
    paginator: clientUtils.Paginator,
    runQuery: boolean | undefined,
  ): Promise<Record<string, string>> => {
    if (idToName !== undefined) {
      return idToName
    }
    const { users } = await getUsers(paginator, runQuery)
    if (_.isEmpty(users)) {
      idToName = {}
      return {}
    }
    idToName = Object.fromEntries(users.map(user => [user.id.toString(), user.name])) as Record<string, string>
    return idToName
  }
  return getIdByName
}

export const getIdByName = getIdByNameFunc()
