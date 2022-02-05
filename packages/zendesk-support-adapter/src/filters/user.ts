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
import { collections } from '@salto-io/lowerdash'
import { Change, getChangeData, InstanceElement, isInstanceElement, Values } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'

const log = logger(module)
const { toArrayAsync } = collections.asynciterable
const { makeArray } = collections.array

type UserReplacer = (instance: InstanceElement, mapping: Record<string, string>) => void
type User = {
  id: number
  email: string
}
type Condition = {
  field: string
}

const EXPECTED_USER_SCHEMA = Joi.array().items(Joi.object({
  id: Joi.number().required(),
  email: Joi.string().required(),
}).unknown(true)).required()

const EXPECTED_CONDITION_SCHEMA = Joi.array().items(Joi.object({
  field: Joi.string().required(),
}).unknown(true))

const areUsers = (values: unknown): values is User[] => {
  const { error } = EXPECTED_USER_SCHEMA.validate(values)
  if (error !== undefined) {
    log.error(`Received an invalid response for the users values: ${error.message}`)
    return false
  }
  return true
}
const areConditions = (values: unknown): values is Condition[] => {
  const { error } = EXPECTED_CONDITION_SCHEMA.validate(values)
  return error === undefined
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
    if (conditions === undefined || !areConditions(conditions)) {
      return
    }
    conditions
      .filter(condition => replacerParams.fieldsToReplace
        .map(f => f.name).includes(condition.field))
      .forEach(condition => {
        const valuePath = replacerParams.fieldsToReplace
          .find(f => f.name === condition.field)?.valuePath ?? 'value'
        const value = _.get(condition, valuePath)?.toString() as string | undefined
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
    values.restriction.id = newValue
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
    url: '/users?role[]=admin&role[]=agent',
    paginationField: 'next_page',
  }
  const users = (await toArrayAsync(
    paginator(paginationArgs, page => makeArray(page) as clientUtils.ResponseValue[])
  )).flat().flatMap(response => response.users)
  if (!areUsers(users)) {
    return []
  }
  return users
}

const deployModificationFunc = async (
  changes: Change<InstanceElement>[],
  paginator: clientUtils.Paginator,
  mappingFunction: (user: User) => [string, string],
): Promise<void> => {
  const changesTypeNames = _.uniq(changes.map(getChangeData).map(e => e.elemID.typeName))
  if (_.isEmpty(_.intersection(changesTypeNames, Object.keys(TYPE_NAME_TO_REPLACER)))) {
    return
  }
  const users = await getUsers(paginator)
  if (_.isEmpty(users)) {
    return
  }
  const mapping = Object.fromEntries(users.map(user => mappingFunction(user)))
  changes.forEach(change => {
    _.mapValues(change.data, (instance: InstanceElement) => {
      TYPE_NAME_TO_REPLACER[instance.elemID.typeName]?.(instance, mapping)
    })
  })
}

/**
 * Replaces the user ids with emails
 */
const filterCreator: FilterCreator = ({ paginator }) => ({
  onFetch: async elements => {
    const users = await getUsers(paginator)
    if (_.isEmpty(users)) {
      return
    }
    const userIdToEmail = Object.fromEntries(
      users
        .map(user => [user.id.toString(), user.email])
    ) as Record<string, string>
    const instances = elements.filter(isInstanceElement)
    instances.forEach(instance => {
      TYPE_NAME_TO_REPLACER[instance.elemID.typeName]?.(instance, userIdToEmail)
    })
  },
  preDeploy: async (changes: Change<InstanceElement>[]) => {
    await deployModificationFunc(changes, paginator, user => [user.email, user.id.toString()])
  },
  onDeploy: async (changes: Change<InstanceElement>[]) => {
    await deployModificationFunc(changes, paginator, user => [user.id.toString(), user.email])
  },
})

export default filterCreator
