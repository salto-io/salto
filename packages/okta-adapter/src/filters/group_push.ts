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
import Joi from 'joi'
import {
  Element,
  InstanceElement,
  isInstanceElement,
  ObjectType,
  ElemID,
  BuiltinTypes,
  ElemIdGetter,
  CORE_ANNOTATIONS,
  Change,
  getChangeData,
  isRemovalChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { elements as elementUtils, client as clientUtils, config as configUtils } from '@salto-io/adapter-components'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import {
  OKTA,
  APPLICATION_TYPE_NAME,
  GROUP_PUSH_TYPE_NAME,
  GROUP_PUSH_RULE_TYPE_NAME,
  ACTIVE_STATUS,
} from '../constants'
import { PRIVATE_API_DEFINITIONS_CONFIG, OktaConfig, CLIENT_CONFIG } from '../config'

const log = logger(module)
const { TYPES_PATH, toBasicInstance } = elementUtils
const { toArrayAsync } = collections.asynciterable
const { makeArray } = collections.array
const { createPaginator, getWithCursorPagination } = clientUtils
const { getTransformationConfigByType } = configUtils

type GroupPushEntry = {
  mappingId: string
  status: string
  sourceUserGroupId: string
  targetGroupName: string
  ruleId: string
}

type PushRuleEntry = {
  mappingRuleId: string
  status: string
  name: string
  searchExpression: string
  searchExpressionType: string
}

const GROUP_PUSH_SCHEMA = Joi.object({
  mappingId: Joi.string().required(),
  status: Joi.string().required(),
  sourceUserGroupId: Joi.string().required(),
  targetGroupName: Joi.string().required(),
  ruleId: Joi.string().allow(null),
}).unknown(true)

const PUSH_RULE_SCHEMA = Joi.object({
  mappingRuleId: Joi.string().required(),
  status: Joi.string().required(),
  name: Joi.string().required(),
  searchExpression: Joi.string(),
  searchExpressionType: Joi.string().required(),
}).unknown(true)

const GROUP_PUSH_RESPONSE_SCHEMA = Joi.array().items(GROUP_PUSH_SCHEMA).required()

const PUSH_RULE_RESPONSE_SCHEMA = Joi.array().items(PUSH_RULE_SCHEMA).required()

const isGroupPushResponse = createSchemeGuard<GroupPushEntry[]>(
  GROUP_PUSH_RESPONSE_SCHEMA,
  'Received an invalid response for group push',
)

const isPushRulesResponse = createSchemeGuard<PushRuleEntry[]>(
  PUSH_RULE_RESPONSE_SCHEMA,
  'Received an invalid response for push rules',
)

export const isAppSupportsGroupPush = (instance: InstanceElement): boolean =>
  Array.isArray(instance.value.features) && instance.value.features.includes('GROUP_PUSH')

const createGroupPushTypes = (): ObjectType[] => [
  new ObjectType({
    elemID: new ElemID(OKTA, GROUP_PUSH_TYPE_NAME),
    fields: {
      mappingId: {
        refType: BuiltinTypes.SERVICE_ID,
        annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
      },
      userGroupId: { refType: BuiltinTypes.STRING },
      groupPushRule: { refType: BuiltinTypes.STRING },
      status: { refType: BuiltinTypes.STRING },
      newAppGroupName: { refType: BuiltinTypes.STRING },
    },
    path: [OKTA, TYPES_PATH, GROUP_PUSH_TYPE_NAME],
  }),
  new ObjectType({
    elemID: new ElemID(OKTA, GROUP_PUSH_RULE_TYPE_NAME),
    fields: {
      mappingRuleId: {
        refType: BuiltinTypes.SERVICE_ID,
        annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
      },
      name: { refType: BuiltinTypes.STRING },
      status: { refType: BuiltinTypes.STRING },
      searchExpression: { refType: BuiltinTypes.STRING },
      searchExpressionType: { refType: BuiltinTypes.STRING },
      descriptionSearchExpression: { refType: BuiltinTypes.STRING },
      descriptionSearchExpressionType: { refType: BuiltinTypes.STRING },
    },
    path: [OKTA, TYPES_PATH, GROUP_PUSH_RULE_TYPE_NAME],
  }),
]

const getGroupPushForApp = async (paginator: clientUtils.Paginator, appId: string): Promise<GroupPushEntry[]> => {
  const paginationArgs = {
    url: `/api/internal/instance/${appId}/grouppush`,
    paginationField: 'nextMappingsPageUrl',
  }
  const groupPushEntries = (
    await toArrayAsync(paginator(paginationArgs, page => makeArray(page.mappings) as clientUtils.ResponseValue[]))
  ).flat()
  if (!isGroupPushResponse(groupPushEntries)) {
    log.error('Received invalid response for group push')
    return []
  }
  return groupPushEntries
}

const getPushRulesForApp = async (paginator: clientUtils.Paginator, appId: string): Promise<PushRuleEntry[]> => {
  const paginationArgs = {
    url: `/api/internal/instance/${appId}/grouppushrules`,
  }
  const pushRulesEntries = (
    await toArrayAsync(paginator(paginationArgs, page => makeArray(page) as clientUtils.ResponseValue[]))
  ).flat()
  if (!isPushRulesResponse(pushRulesEntries)) {
    log.error('Received invalid response for push rules')
    return []
  }
  return pushRulesEntries
}

const toGroupPushInstance = async ({
  entry,
  groupPushType,
  appInstance,
  config,
  getElemIdFunc,
}: {
  entry: GroupPushEntry
  groupPushType: ObjectType
  appInstance: InstanceElement
  config: OktaConfig
  getElemIdFunc?: ElemIdGetter
}): Promise<InstanceElement> => {
  // Convert group push entry to instance in a structure that can be deployed
  const value = {
    mappingId: entry.mappingId,
    status: entry.status,
    userGroupId: entry.sourceUserGroupId,
    newAppGroupName: entry.targetGroupName,
    groupPushRule: entry.ruleId,
  }
  return toBasicInstance({
    entry: value,
    type: groupPushType,
    transformationConfigByType: getTransformationConfigByType(config[PRIVATE_API_DEFINITIONS_CONFIG].types),
    transformationDefaultConfig: config[PRIVATE_API_DEFINITIONS_CONFIG].typeDefaults.transformation,
    parent: appInstance,
    defaultName: value.userGroupId,
    getElemIdFunc,
  })
}

const toPushRuleInstance = async ({
  entry,
  pushRuleType,
  appInstance,
  config,
  getElemIdFunc,
}: {
  entry: PushRuleEntry
  pushRuleType: ObjectType
  appInstance: InstanceElement
  config: OktaConfig
  getElemIdFunc?: ElemIdGetter
}): Promise<InstanceElement> =>
  toBasicInstance({
    entry,
    type: pushRuleType,
    transformationConfigByType: getTransformationConfigByType(config[PRIVATE_API_DEFINITIONS_CONFIG].types),
    transformationDefaultConfig: config[PRIVATE_API_DEFINITIONS_CONFIG].typeDefaults.transformation,
    parent: appInstance,
    defaultName: entry.name,
    getElemIdFunc,
  })

const getGroupPushRules = async ({
  appInstance,
  pushRuleType,
  paginator,
  config,
  getElemIdFunc,
}: {
  appInstance: InstanceElement
  pushRuleType: ObjectType
  paginator: clientUtils.Paginator
  config: OktaConfig
  getElemIdFunc?: ElemIdGetter
}): Promise<InstanceElement[]> => {
  const pushRulesEntries = await getPushRulesForApp(paginator, appInstance.value.id)
  return Promise.all(
    pushRulesEntries.map(async entry =>
      toPushRuleInstance({
        entry,
        pushRuleType,
        appInstance,
        config,
        getElemIdFunc,
      }),
    ),
  )
}

/**
 * Fetch group push instances and group push rule instances using private API
 */
const groupPushFilter: FilterCreator = ({ config, adminClient, getElemIdFunc }) => ({
  name: 'groupPushFilter',
  onFetch: async (elements: Element[]) => {
    if (config[CLIENT_CONFIG]?.usePrivateAPI !== true) {
      log.debug('Skipping fetch of group push because private API is not enabled')
      return
    }

    if (adminClient === undefined) {
      log.debug('Admin client is undefined, could not fetch group push instances')
      return
    }

    const appsWithGroupPush = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === APPLICATION_TYPE_NAME)
      .filter(isAppSupportsGroupPush)

    const [groupPushType, pushRuleType] = createGroupPushTypes()
    elements.push(groupPushType)
    elements.push(pushRuleType)

    const paginator = createPaginator({
      client: adminClient,
      // Pagination method is different from the rest of Okta's API
      paginationFuncCreator: () => getWithCursorPagination(),
    })

    const instances = (
      await Promise.all(
        appsWithGroupPush.map(async appInstance => {
          if (!_.isString(appInstance.value.id)) {
            log.error(`Skip fetching group push for app: ${appInstance.elemID.getFullName()}, because id is invalid`)
            return []
          }
          const groupPushEntries = await getGroupPushForApp(paginator, appInstance.value.id)
          const groupPush = await Promise.all(
            groupPushEntries.map(async entry =>
              toGroupPushInstance({
                entry,
                groupPushType,
                appInstance,
                config,
                getElemIdFunc,
              }),
            ),
          )
          const appStatus = appInstance.value.status
          // fetching Group Push rules is only supported for apps in status ACTIVE
          const groupPushRules =
            appStatus === ACTIVE_STATUS
              ? await getGroupPushRules({ appInstance, pushRuleType, paginator, config, getElemIdFunc })
              : []
          return groupPush.concat(groupPushRules)
        }),
      )
    ).flat()

    instances.forEach(instance => elements.push(instance))
  },
  preDeploy: async (changes: Change<InstanceElement>[]) => {
    changes
      .filter(isInstanceChange)
      .filter(isRemovalChange)
      .filter(change =>
        [GROUP_PUSH_TYPE_NAME, GROUP_PUSH_RULE_TYPE_NAME].includes(getChangeData(change).elemID.typeName),
      )
      .map(getChangeData)
      .forEach(instance => {
        // The payload on removal change should only include
        // the desired side affect of removing a push group or a push group rule
        if (instance.elemID.typeName === GROUP_PUSH_TYPE_NAME) {
          // The associated group created in the target app will be deleted
          instance.value.deleteAppGroup = true
        }
        if (instance.elemID.typeName === GROUP_PUSH_RULE_TYPE_NAME) {
          // All groups pushed by this rule will be deleteds from the target app
          instance.value.action = 'DELETE_MAPPINGS_AND_DELETE_APP_GROUPS'
        }
      })
  },
  onDeploy: async (changes: Change<InstanceElement>[]) => {
    changes
      .filter(isInstanceChange)
      .filter(isRemovalChange)
      .filter(change =>
        [GROUP_PUSH_TYPE_NAME, GROUP_PUSH_RULE_TYPE_NAME].includes(getChangeData(change).elemID.typeName),
      )
      .map(getChangeData)
      .forEach(instance => {
        if (instance.elemID.typeName === GROUP_PUSH_TYPE_NAME) {
          delete instance.value.deleteAppGroup
        }
        if (instance.elemID.typeName === GROUP_PUSH_RULE_TYPE_NAME) {
          delete instance.value.action
        }
      })
  },
})

export default groupPushFilter
