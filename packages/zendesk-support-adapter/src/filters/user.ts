/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { Change, getChangeData, InstanceElement, isInstanceElement, Values } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { conditionFieldValue, isCorrectConditions } from './utils'

const log = logger(module)
const { toArrayAsync, awu } = collections.asynciterable
const { makeArray } = collections.array

type UserReplacer = (instance: InstanceElement, mapping: Record<string, string>) => void
type User = {
  id: number
  email: string
}

const EXPECTED_USER_SCHEMA = Joi.array().items(Joi.object({
  id: Joi.number().required(),
  email: Joi.string().required(),
}).unknown(true)).required()

const areUsers = (values: unknown): values is User[] => {
  const { error } = EXPECTED_USER_SCHEMA.validate(values)
  if (error !== undefined) {
    log.warn(`Received an invalid response for the users values: ${error.message}`)
    return false
  }
  return true
}

type ReplacerCreatorParams = {
  fieldName: string
  fieldsToReplace: { name: string; valuePath?: string }[]
}

const replaceConditionsAndActionsCreator = (
  params: ReplacerCreatorParams[],
  isIdNumber = false,
): UserReplacer => (instance, mapping) => {
  params.forEach(replacerParams => {
    const conditions = _.get(instance.value, replacerParams.fieldName)
    const { typeName } = instance.elemID
    // Coditions can be undefined - in that case, we don't want to log a warning
    if (conditions === undefined
      || !isCorrectConditions(conditions, typeName)) {
      return
    }
    conditions
      .filter(condition => replacerParams.fieldsToReplace
        .map(f => f.name)
        .includes(conditionFieldValue(condition, typeName)))
      .forEach(condition => {
        const valuePath = replacerParams.fieldsToReplace
          .find(f => f.name === conditionFieldValue(condition, typeName))?.valuePath ?? 'value'
        const value = _.get(condition, valuePath)?.toString()
        const newValue = ((value !== undefined)
          && Object.prototype.hasOwnProperty.call(mapping, value))
          ? mapping[value]
          : undefined
        if (newValue !== undefined) {
          _.set(condition, valuePath, (isIdNumber && Number.isInteger(Number(newValue)))
            ? Number(newValue)
            : newValue)
        }
      })
  })
}

const replaceRestrictionImpl = (values: Values, mapping: Record<string, string>): void => {
  const id = values.restriction?.id
  if ((values.restriction?.type === 'User') && (id !== undefined)) {
    const newValue = Object.prototype.hasOwnProperty.call(mapping, id)
      ? mapping[id]
      : undefined
    if (newValue !== undefined) {
      values.restriction.id = newValue
    }
  }
}

const replaceRestriction: UserReplacer = (instance, mapping) => {
  replaceRestrictionImpl(instance.value, mapping)
}

const workspaceReplacer: UserReplacer = (instance, mapping) => {
  const selectedMacros = instance.value.selected_macros;
  (selectedMacros ?? []).forEach((macro: Values) => {
    replaceRestrictionImpl(macro, mapping)
  })
}

const mergeUserReplacers = (replacers: UserReplacer[]): UserReplacer => (instance, mapping) => {
  replacers.forEach(replacer => { replacer(instance, mapping) })
}

const DEFAULT_REPLACER_PARAMS_FOR_ACTIONS = [{ fieldName: 'actions', fieldsToReplace: [{ name: 'assignee_id' }, { name: 'follower' }] }]
const DEFAULT_REPLACER_PARAMS_FOR_CONDITIONS = [
  { fieldName: 'conditions.all', fieldsToReplace: [{ name: 'assignee_id' }, { name: 'requester_id' }] },
  { fieldName: 'conditions.any', fieldsToReplace: [{ name: 'assignee_id' }, { name: 'requester_id' }] },
]

const TYPE_NAME_TO_REPLACER: Record<string, UserReplacer> = {
  automation: replaceConditionsAndActionsCreator([
    ...[{ fieldName: 'actions', fieldsToReplace: [{ name: 'assignee_id' }, { name: 'follower' }, { name: 'notification_user', valuePath: 'value.0' }] }],
    ...DEFAULT_REPLACER_PARAMS_FOR_CONDITIONS,
  ]),
  macro: mergeUserReplacers([
    replaceConditionsAndActionsCreator(DEFAULT_REPLACER_PARAMS_FOR_ACTIONS),
    replaceRestriction,
  ]),
  routing_attribute_value: replaceConditionsAndActionsCreator([
    { fieldName: 'conditions.all', fieldsToReplace: [{ name: 'requester_id' }] },
    { fieldName: 'conditions.any', fieldsToReplace: [{ name: 'requester_id' }] },
  ]),
  sla_policy: replaceConditionsAndActionsCreator([
    { fieldName: 'filter.all', fieldsToReplace: [{ name: 'assignee_id' }, { name: 'requester_id' }] },
    { fieldName: 'filter.any', fieldsToReplace: [{ name: 'assignee_id' }, { name: 'requester_id' }] },
  ], true),
  trigger: replaceConditionsAndActionsCreator([
    ...[{ fieldName: 'actions', fieldsToReplace: [{ name: 'assignee_id' }, { name: 'follower' }, { name: 'notification_user', valuePath: 'value.0' }, { name: 'notification_sms_user', valuePath: 'value.0' }] }],
    ...[
      { fieldName: 'conditions.all', fieldsToReplace: [{ name: 'assignee_id' }, { name: 'requester_id' }, { name: 'role' }] },
      { fieldName: 'conditions.any', fieldsToReplace: [{ name: 'assignee_id' }, { name: 'requester_id' }, { name: 'role' }] },
    ],
  ]),
  view: mergeUserReplacers([
    replaceConditionsAndActionsCreator(DEFAULT_REPLACER_PARAMS_FOR_CONDITIONS),
    replaceRestriction,
  ]),
  workspace: workspaceReplacer,
}

const getUsers = async (paginator: clientUtils.Paginator): Promise<User[]> => {
  const paginationArgs = {
    url: '/users',
    paginationField: 'next_page',
    queryParams: {
      role: ['admin', 'agent'],
    },
  }
  const users = (await toArrayAsync(
    paginator(paginationArgs, page => makeArray(page) as clientUtils.ResponseValue[])
  )).flat().flatMap(response => response.users)
  if (!areUsers(users)) {
    return []
  }
  return users
}

const isRelevantChange = (change: Change<InstanceElement>): boolean => (
  Object.keys(TYPE_NAME_TO_REPLACER).includes(getChangeData(change).elemID.typeName)
)

const deployModificationFunc = async (
  changes: Change<InstanceElement>[],
  mapping: Record<string, string>,
): Promise<void> => {
  await awu(changes).forEach(async change => {
    await applyFunctionToChangeData<Change<InstanceElement>>(
      change,
      instance => {
        TYPE_NAME_TO_REPLACER[instance.elemID.typeName]?.(instance, mapping)
        return instance
      }
    )
  })
}

/**
 * Replaces the user ids with emails
 */
const filterCreator: FilterCreator = ({ paginator }) => {
  let userIdToEmail: Record<string, string> = {}
  return {
    onFetch: async elements => {
      const users = await getUsers(paginator)
      if (_.isEmpty(users)) {
        return
      }
      const mapping = Object.fromEntries(
        users.map(user => [user.id.toString(), user.email])
      ) as Record<string, string>
      const instances = elements.filter(isInstanceElement)
      instances.forEach(instance => {
        TYPE_NAME_TO_REPLACER[instance.elemID.typeName]?.(instance, mapping)
      })
    },
    preDeploy: async (changes: Change<InstanceElement>[]) => {
      const relevantChanges = changes.filter(isRelevantChange)
      if (_.isEmpty(relevantChanges)) {
        return
      }
      const users = await getUsers(paginator)
      if (_.isEmpty(users)) {
        return
      }
      userIdToEmail = Object.fromEntries(
        users.map(user => [user.id.toString(), user.email])
      ) as Record<string, string>
      const emailToUserId = Object.fromEntries(
        users.map(user => [user.email, user.id.toString()])
      ) as Record<string, string>
      await deployModificationFunc(changes, emailToUserId)
    },
    onDeploy: async (changes: Change<InstanceElement>[]) => {
      const relevantChanges = changes.filter(isRelevantChange)
      if (_.isEmpty(relevantChanges)) {
        return
      }
      await deployModificationFunc(changes, userIdToEmail)
    },
  }
}

export default filterCreator
