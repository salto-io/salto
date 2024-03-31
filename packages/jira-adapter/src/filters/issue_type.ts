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
import Joi from 'joi'
import {
  Change,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isInstanceChange,
  isInstanceElement,
  isAdditionOrModificationChange,
  ModificationChange,
  AdditionChange,
  SaltoError,
  StaticFile,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { applyFunctionToChangeData, createSchemeGuard } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { ISSUE_TYPE_NAME } from '../constants'
import JiraClient from '../client/client'
import { defaultDeployChange, deployChanges } from '../deployment/standard_deployment'
import { PRIVATE_API_HEADERS } from '../client/headers'
import { isIconResponse, sendIconRequest, setIconContent } from './icon_utils'

const { awu } = collections.asynciterable

const STANDARD_TYPE = 'standard'
const SUBTASK_TYPE = 'subtask'
const STANDARD_HIERARCHY_LEVEL = 0
const SUBTASK_HIERARCHY_LEVEL = -1

type SystemAvatarResponse = {
  id: string
}
type SystemAvatarsResponse = {
  data: {
    system: SystemAvatarResponse[]
  }
}
const SYSTEM_AVATARS_RESPONSE_SCHEMA = Joi.object({
  data: Joi.object({
    system: Joi.array()
      .items(
        Joi.object({
          id: Joi.string().required(),
        }).unknown(true),
      )
      .required(),
  })
    .required()
    .unknown(true),
})
  .required()
  .unknown(true)

const isSystemAvatarsResponse = createSchemeGuard<SystemAvatarsResponse>(SYSTEM_AVATARS_RESPONSE_SCHEMA)

const deployIcon = async (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  client: JiraClient,
): Promise<void> => {
  const instance = getChangeData(change)
  try {
    const headers = { ...PRIVATE_API_HEADERS, 'Content-Type': 'image/png' }
    const url = `/rest/api/3/universal_avatar/type/issuetype/owner/${instance.value.id}`
    const resp = await sendIconRequest({ client, change, url, fieldName: 'avatar', headers })
    if (!isIconResponse(resp)) {
      throw new Error('Failed to deploy icon to Jira issue type: Invalid response from Jira API')
    }
    instance.value.avatarId = Number(resp.data.id)
  } catch (e) {
    throw new Error(`Failed to deploy icon to Jira issue type: ${e.message}`)
  }
}
const getSystemAvatarsIds = async (client: JiraClient): Promise<Record<string, StaticFile | undefined>> => {
  try {
  const systemAvatars = await client.get({
    url: '/rest/api/3/avatar/issuetype/system',
  })
  if (!isSystemAvatarsResponse(systemAvatars)) {
   return {} 
  }
  return Object.fromEntries(systemAvatars.data.system.map(avatar => [avatar.id, undefined]))
} catch (e) {
  return {}
  }
}

/*
 * This filter is responsible to align the DC issue types values with the Cloud,
 * and deploy cloud addition and modifications issue types with their icons.
 */
const filter: FilterCreator = ({ client, config }) => ({
  name: 'issueTypeFilter',
  onFetch: async elements => {
    const issueTypes = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === ISSUE_TYPE_NAME)

    if (client.isDataCenter) {
      issueTypes.forEach(instance => {
        instance.value.hierarchyLevel = instance.value.subtask ? SUBTASK_HIERARCHY_LEVEL : STANDARD_HIERARCHY_LEVEL
      })
    }
    issueTypes.forEach(issueType => {
      delete issueType.value.subtask
    })
    if (client.isDataCenter) {
      return { errors: [] }
    }
    const systemAvatarsIds = await getSystemAvatarsIds(client)
    const errors: SaltoError[] = []
    await awu(issueTypes).forEach(async issueType => {
      try {
        if (issueType.value.avatarId === undefined) {
          return
        }
        if (Object.keys(systemAvatarsIds).includes(issueType.value.avatarId.toString())) {
          if (systemAvatarsIds[issueType.value.avatarId] === undefined) {
            const link = `/rest/api/3/universal_avatar/view/type/issuetype/avatar/${issueType.value.avatarId}`
            await setIconContent({ client, instance: issueType, link, fieldName: 'avatar', fileName: issueType.value.avatarId })
            systemAvatarsIds[issueType.value.avatarId] = issueType.value.avatar
          } else {
            issueType.value.avatar = systemAvatarsIds[issueType.value.avatarId]
          }
          return
        }
        const link = `/rest/api/3/universal_avatar/view/type/issuetype/avatar/${issueType.value.avatarId}`
        await setIconContent({ client, instance: issueType, link, fieldName: 'avatar'  })
      } catch (e) {
        errors.push({ message: e.message, severity: 'Error' })
      }
    })
    return { errors }
  },

  preDeploy: async changes => {
    if (!client.isDataCenter) {
      return
    }

    await awu(changes)
      .filter(isInstanceChange)
      .filter(isAdditionChange)
      .filter(change => getChangeData(change).elemID.typeName === ISSUE_TYPE_NAME)
      .forEach(change =>
        applyFunctionToChangeData<Change<InstanceElement>>(change, instance => {
          instance.value.type = instance.value.hierarchyLevel === SUBTASK_HIERARCHY_LEVEL ? SUBTASK_TYPE : STANDARD_TYPE
          delete instance.value.hierarchyLevel
          return instance
        }),
      )
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    if (client.isDataCenter) {
      return {
        deployResult: { appliedChanges: [], errors: [] },
        leftoverChanges: changes,
      }
    }
    const [issueTypeChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === ISSUE_TYPE_NAME && isAdditionOrModificationChange(change),
    )

    const deployResult = await deployChanges(issueTypeChanges.filter(isAdditionOrModificationChange), async change => {
      if (isAdditionChange(change)) {
        // deploy issueType first to get issueType id
        await defaultDeployChange({
          change,
          client,
          fieldsToIgnore: ['avatar'],
          apiDefinitions: config.apiDefinitions,
        })
        // Load the avatar to get avatarId
        const instance = getChangeData(change)
        if (instance.value.avatar !== undefined) {
          await deployIcon(change, client)
          // update the issueTpype with the avatarId
          await client.put({
            url: `/rest/api/3/issuetype/${instance.value.id}`,
            data: { avatarId: instance.value.avatarId },
          })
        }
      } else {
        // Load the avatar to get avatarId
        const avatarBefore = change.data.before.value.avatar
        const avatarAfter = change.data.after.value.avatar
        if (avatarBefore !== undefined && avatarAfter !== undefined && !avatarBefore.isEqual(avatarAfter)) {
          await deployIcon(change, client)
        }
        // update the issueTpype with the avatarId
        await defaultDeployChange({
          change,
          client,
          fieldsToIgnore: ['avatar'],
          apiDefinitions: config.apiDefinitions,
        })
      }
    })

    return {
      leftoverChanges,
      deployResult,
    }
  },

  onDeploy: async changes => {
    if (!client.isDataCenter) {
      return
    }

    await awu(changes)
      .filter(isInstanceChange)
      .filter(isAdditionChange)
      .filter(change => getChangeData(change).elemID.typeName === ISSUE_TYPE_NAME)
      .forEach(change =>
        applyFunctionToChangeData<Change<InstanceElement>>(change, instance => {
          instance.value.hierarchyLevel =
            instance.value.type === SUBTASK_TYPE ? SUBTASK_HIERARCHY_LEVEL : STANDARD_HIERARCHY_LEVEL
          delete instance.value.type
          return instance
        }),
      )
  },
})

export default filter
