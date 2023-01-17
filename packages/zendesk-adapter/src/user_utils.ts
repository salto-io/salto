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
import { ElemID, InstanceElement, Values } from '@salto-io/adapter-api'
import { conditionFieldValue, isCorrectConditions } from './filters/utils'

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

type UserReplacer = (instance: InstanceElement, mapping?: Record<string, string>) => ElemID[]

type UserFieldsParams = {
  fieldName: string[]
  fieldsToReplace: { name: string; valuePath?: string[] }[]
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

const replaceConditionsAndActionsCreator = (
  params: UserFieldsParams[],
  isIdNumber = false,
): UserReplacer => (instance, mapping) => (
  params.flatMap(replacerParams => {
    const conditions = _.get(instance.value, replacerParams.fieldName)
    const { typeName } = instance.elemID
    // Coditions can be undefined - in that case, we don't want to log a warning
    if (conditions === undefined
      || !isCorrectConditions(conditions, typeName)) {
      return []
    }
    return conditions
      .flatMap((condition, i) => {
        const fieldNamesToReplace = replacerParams.fieldsToReplace.map(f => f.name)
        const conditionValue = conditionFieldValue(condition, typeName)
        if (!fieldNamesToReplace.includes(conditionValue)) {
          return []
        }
        const valueRelativePath = replacerParams.fieldsToReplace
          .find(f => f.name === conditionValue)?.valuePath ?? ['value']
        const value = _.get(condition, valueRelativePath)?.toString()
        if (value !== undefined) {
          const valuePath = instance.elemID
            .createNestedID(...replacerParams.fieldName, i.toString(), ...valueRelativePath)
          if (mapping !== undefined) {
            const newValue = Object.prototype.hasOwnProperty.call(mapping, value) ? mapping[value] : undefined
            if (newValue !== undefined) {
              _.set(condition, valueRelativePath, (isIdNumber && Number.isInteger(Number(newValue)))
                ? Number(newValue)
                : newValue)
            }
          }
          return [valuePath]
        }
        return []
      })
  })
)

const fieldReplacer = (fields: string[]): UserReplacer => (instance, mapping) => (
  fields
    .flatMap(field => {
      const value = _.get(instance.value, field)?.toString()
      if (value === undefined) {
        return []
      }
      const valuePath = instance.elemID.createNestedID(field)
      if (mapping !== undefined) {
        const newValue = Object.prototype.hasOwnProperty.call(mapping, value) ? mapping[value] : undefined
        if (newValue !== undefined) {
          _.set(
            instance.value,
            field,
            (Number.isInteger(Number(newValue)))
              ? Number(newValue)
              : newValue
          )
        }
      }
      return [valuePath]
    })
)

const replaceRestrictionImpl = (values: Values, mapping?: Record<string, string>): string[] => {
  const restrictionRelativePath = ['restriction', 'id']
  const id = _.get(values, restrictionRelativePath)
  if ((values.restriction?.type === 'User') && (id !== undefined)) {
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
  return []
}

const replaceRestriction: UserReplacer = (instance, mapping) => {
  const relativePath = replaceRestrictionImpl(instance.value, mapping)
  return _.isEmpty(relativePath) ? [] : [instance.elemID.createNestedID(...relativePath)]
}

const workspaceReplacer: UserReplacer = (instance, mapping) => {
  const selectedMacros = instance.value.selected_macros
  return (selectedMacros ?? []).flatMap((macro: Values, index: number) => {
    const relativePath = replaceRestrictionImpl(macro, mapping)
    return _.isEmpty(relativePath) ? [] : [instance.elemID.createNestedID('selected_macros', index.toString(), ...relativePath)]
  })
}

const mergeUserReplacers = (replacers: UserReplacer[]): UserReplacer => (instance, mapping) => (
  replacers.flatMap(replacer => replacer(instance, mapping))
)

const DEFAULT_REPLACER_PARAMS_FOR_ACTIONS = [{ fieldName: ['actions'], fieldsToReplace: [{ name: 'assignee_id' }, { name: 'follower' }] }]
const DEFAULT_REPLACER_PARAMS_FOR_CONDITIONS = [
  { fieldName: ['conditions', 'all'], fieldsToReplace: [{ name: 'assignee_id' }, { name: 'requester_id' }] },
  { fieldName: ['conditions', 'any'], fieldsToReplace: [{ name: 'assignee_id' }, { name: 'requester_id' }] },
]

export const TYPE_NAME_TO_REPLACER: Record<string, UserReplacer> = {
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
  workspace: workspaceReplacer,
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
