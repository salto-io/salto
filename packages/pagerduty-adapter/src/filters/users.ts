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
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { Change, getChangeData, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { filterUtils, fetch as fetchUtils, definitions as definitionsUtils } from '@salto-io/adapter-components'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { ADAPTER_NAME, ESCALATION_POLICY_TYPE_NAME, SCHEDULE_LAYERS_TYPE_NAME, SCHEDULE_TYPE_NAME } from '../constants'
import { Options } from '../definitions/types'
import { DEFAULT_CONVERT_USERS_IDS_VALUE, UserConfig } from '../config'
import { USER_FETCH_DEFINITIONS, isRelevantInstance, isRelevantInstanceForFetch } from '../users_utils'

const log = logger(module)
const { awu } = collections.asynciterable
const { makeArray } = collections.array

type UserReference = { type: string; id: string }

type EscalationRule = {
  targets: UserReference[]
}

type ScheduleLayerUser = {
  user: UserReference
}

/*
Example structure of escalation policy:
{
  name: 'blabla'
  escalation_rules: [
    {
      name: 'rule1',
      targets: [
        { type: 'user_reference', id: 'P123456' },
        { type: 'team_reference', id: 'P123457' },
      ]
    }
  ]
}

Example structure of schedule layer:
{
  name: 'blabla'
  users: [
    { user: { type: 'user_reference', id: 'P123456' } },
    { user: { type: 'user_reference', id: 'P123458' } },
  ]
}
*/

const isEscalationRule = (value: unknown): value is EscalationRule => {
  const targets = _.get(value, 'targets')
  return Array.isArray(targets) && targets.every(target => _.isString(target.id) && _.isString(target.type))
}

const isScheduleLayerUser = (value: unknown): value is ScheduleLayerUser => {
  const user = _.get(value, 'user')
  return _.isPlainObject(user) && _.isString(user.id) && _.isString(user.type)
}

const replaceUserInUserObject = (userObj: ScheduleLayerUser | UserReference, mapping: Record<string, string>): void => {
  const userIdentifier = _.get(userObj, 'user.id')
  if (mapping[userIdentifier]) {
    _.set(userObj, 'user.id', mapping[userIdentifier])
  } else {
    log.debug(`Could not find user with id ${userIdentifier} in the mapping`)
  }
}

const replaceValues = (instance: InstanceElement, mapping: Record<string, string>): void => {
  switch (instance.elemID.typeName) {
    case ESCALATION_POLICY_TYPE_NAME:
      makeArray(instance.value.escalation_rules)
        .filter(isEscalationRule)
        .forEach(rule => {
          rule.targets.forEach(target => {
            if (target.type === 'user_reference') {
              const userIdentifier = target.id
              if (mapping[userIdentifier]) {
                _.set(target, 'id', mapping[userIdentifier])
              } else {
                log.debug(`Could not find user with id ${userIdentifier} in the mapping`)
              }
            }
          })
        })
      break

    case SCHEDULE_LAYERS_TYPE_NAME:
      makeArray(instance.value.users)
        .filter(isScheduleLayerUser)
        .forEach(userObj => replaceUserInUserObject(userObj, mapping))
      break
    case SCHEDULE_TYPE_NAME:
      makeArray(instance.value.schedule_layers).forEach(scheduleLayer => {
        makeArray(scheduleLayer.users)
          .filter(isScheduleLayerUser)
          .forEach(userObj => replaceUserInUserObject(userObj, mapping))
      })
      break
    default:
      break
  }
}

const replaceValuesForChanges = async (
  changes: Change<InstanceElement>[],
  mapping: Record<string, string>,
): Promise<void> => {
  await awu(changes).forEach(async change => {
    await applyFunctionToChangeData<Change<InstanceElement>>(change, instance => {
      replaceValues(instance, mapping)
      return instance
    })
  })
}

/**
 * Replaces user ids with login name, when 'convertUsersIds' config flag is enabled
 */
const filter: filterUtils.AdapterFilterCreator<UserConfig, filterUtils.FilterResult, {}, Options> = ({
  config,
  definitions,
  fetchQuery,
  sharedContext,
}) => {
  let userIdToLogin: Record<string, string> = {}
  const userDefinition = { ...definitions, fetch: { instances: USER_FETCH_DEFINITIONS } }

  return {
    name: 'usersFilter',
    onFetch: async elements => {
      if (!(config.fetch.convertUsersIds ?? DEFAULT_CONVERT_USERS_IDS_VALUE)) {
        log.debug('Converting user ids was disabled (onFetch)')
        return
      }
      const instances = elements.filter(isInstanceElement).filter(isRelevantInstanceForFetch)
      if (_.isEmpty(instances)) {
        return
      }

      // Using casting as the difference between definitions type and RequiredDefinitions is that the fetch is not mandatory in  the definitions, but I override it.
      const users = await fetchUtils.getElements({
        adapterName: ADAPTER_NAME,
        fetchQuery,
        definitions: userDefinition as definitionsUtils.RequiredDefinitions<Options>,
      })
      if (!users || _.isEmpty(users.elements)) {
        log.warn('Could not find any users (onFetch)')
        return
      }
      const mapping = Object.fromEntries(
        users.elements.filter(isInstanceElement).map(user => [user.value.id, user.value.email]),
      )
      instances.forEach(instance => {
        replaceValues(instance, mapping)
      })
    },
    preDeploy: async (changes: Change<InstanceElement>[]) => {
      if (!(config.fetch.convertUsersIds ?? DEFAULT_CONVERT_USERS_IDS_VALUE)) {
        log.debug('Converting user ids was disabled (preDeploy)')
        return
      }
      const relevantChanges = changes.filter(change => isRelevantInstance(getChangeData(change)))
      if (_.isEmpty(relevantChanges)) {
        return
      }
      if (sharedContext.users === undefined) {
        sharedContext.users = fetchUtils.getElements({
          adapterName: ADAPTER_NAME,
          fetchQuery,
          definitions: userDefinition as definitionsUtils.RequiredDefinitions<Options>,
        })
      }
      const users = (await sharedContext.users) as fetchUtils.FetchElements<InstanceElement[]>
      if (!users || _.isEmpty(users.elements)) {
        log.warn('Could not find any users (onFetch)')
        return
      }

      userIdToLogin = Object.fromEntries(
        users.elements.filter(isInstanceElement).map(user => [user.value.id, user.value.email]),
      )
      const loginToUserId = Object.fromEntries(
        users.elements.filter(isInstanceElement).map(user => [user.value.email, user.value.id]),
      )
      await replaceValuesForChanges(relevantChanges, loginToUserId)
    },
    onDeploy: async (changes: Change<InstanceElement>[]) => {
      if (!(config.fetch.convertUsersIds ?? DEFAULT_CONVERT_USERS_IDS_VALUE)) {
        log.debug('Converting user ids was disabled (preDeploy)')
        return
      }
      const relevantChanges = changes.filter(change => isRelevantInstance(getChangeData(change)))
      if (_.isEmpty(relevantChanges)) {
        return
      }
      await replaceValuesForChanges(relevantChanges, userIdToLogin)
    },
  }
}

export default filter
