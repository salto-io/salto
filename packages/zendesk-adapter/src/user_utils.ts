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
import _ from 'lodash'
import Joi from 'joi'
import { logger } from '@salto-io/logging'
import { client as clientUtils } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { Values } from '@salto-io/adapter-api'
import { ValueReplacer, replaceConditionsAndActionsCreator, fieldReplacer } from './replacers_utils'

const log = logger(module)
const { toArrayAsync } = collections.asynciterable
const { makeArray } = collections.array

export type User = {
  id: number
  email: string
  role: string
  // eslint-disable-next-line camelcase
  custom_role_id: number
}

const EXPECTED_USER_SCHEMA = Joi.array().items(Joi.object({
  id: Joi.number().required(),
  email: Joi.string().required(),
  role: Joi.string(),
  custom_role_id: Joi.number(),
}).unknown(true)).required()

const areUsers = (values: unknown): values is User[] => {
  const { error } = EXPECTED_USER_SCHEMA.validate(values)
  if (error !== undefined) {
    log.warn(`Received an invalid response for the users values: ${error.message}`)
    return false
  }
  return true
}

const replaceRestrictionImpl = (values: Values, mapping?: Record<string, string>): string[] => {
  const restrictionRelativePath = ['restriction', 'id']
  const id = _.get(values, restrictionRelativePath)
  if ((values.restriction?.type !== 'User') || id === undefined) {
    return []
  }
  if (mapping !== undefined) {
    const newValue = Object.prototype.hasOwnProperty.call(mapping, id)
      ? mapping[id]
      : undefined
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
    return _.isEmpty(relativePath) ? [] : [instance.elemID.createNestedID('selected_macros', index.toString(), ...relativePath)]
  })
}

const mergeUserReplacers = (replacers: ValueReplacer[]): ValueReplacer => (instance, mapping) => (
  replacers.flatMap(replacer => replacer(instance, mapping))
)

const DEFAULT_REPLACER_PARAMS_FOR_ACTIONS = [{ fieldName: ['actions'], fieldsToReplace: [{ name: 'assignee_id' }, { name: 'follower' }] }]
const DEFAULT_REPLACER_PARAMS_FOR_CONDITIONS = [
  { fieldName: ['conditions', 'all'], fieldsToReplace: [{ name: 'assignee_id' }, { name: 'requester_id' }] },
  { fieldName: ['conditions', 'any'], fieldsToReplace: [{ name: 'assignee_id' }, { name: 'requester_id' }] },
]

export const TYPE_NAME_TO_REPLACER: Record<string, ValueReplacer> = {
  automation: replaceConditionsAndActionsCreator([
    ...[{ fieldName: ['actions'], fieldsToReplace: [{ name: 'assignee_id' }, { name: 'follower' }, { name: 'notification_user', valuePath: ['value', '0'] }] }],
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
  sla_policy: replaceConditionsAndActionsCreator([
    { fieldName: ['filter', 'all'], fieldsToReplace: [{ name: 'assignee_id' }, { name: 'requester_id' }] },
    { fieldName: ['filter', 'any'], fieldsToReplace: [{ name: 'assignee_id' }, { name: 'requester_id' }] },
  ], true),
  trigger: replaceConditionsAndActionsCreator([
    ...[{ fieldName: ['actions'], fieldsToReplace: [{ name: 'assignee_id' }, { name: 'follower' }, { name: 'notification_user', valuePath: ['value', '0'] }, { name: 'notification_sms_user', valuePath: ['value', '0'] }] }],
    ...[
      { fieldName: ['conditions', 'all'], fieldsToReplace: [{ name: 'assignee_id' }, { name: 'requester_id' }, { name: 'role' }] },
      { fieldName: ['conditions', 'any'], fieldsToReplace: [{ name: 'assignee_id' }, { name: 'requester_id' }, { name: 'role' }] },
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

/*
* Fetch all users with admin and agent roles.
* Results are cached after the initial call to improve performance.
*
*/
const getUsersFunc = ():(paginator: clientUtils.Paginator) => Promise<User[]> => {
  let calculatedUsers: User[]

  const getUsers = async (paginator: clientUtils.Paginator): Promise<User[]> => {
    if (calculatedUsers !== undefined) {
      return calculatedUsers
    }
    const paginationArgs = {
      url: '/api/v2/users',
      paginationField: 'next_page',
      queryParams: {
        role: ['admin', 'agent'],
      },
    }
    const users = (await toArrayAsync(
      paginator(paginationArgs, page => makeArray(page) as clientUtils.ResponseValue[])
    )).flat().flatMap(response => response.users)
    if (!areUsers(users)) {
      calculatedUsers = []
      return []
    }
    calculatedUsers = users
    return users
  }

  return getUsers
}

export const getUsers = getUsersFunc()
