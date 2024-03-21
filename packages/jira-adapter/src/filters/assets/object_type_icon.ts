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
import {
  Change,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  ModificationChange,
  AdditionChange,
  SaltoError,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import _ from 'lodash'
import Joi from 'joi'
import { client as clientUtils } from '@salto-io/adapter-components'
import { FilterCreator } from '../../filter'
import { OBJECT_TYPE_ICON } from '../../constants'
import JiraClient from '../../client/client'
import { deployChanges } from '../../deployment/standard_deployment'
import { convertName, isIconResponse, sendIconRequest, setIconContent } from '../icon_utils'
import { getWorkspaceId } from '../../workspace_id'
import { createLogoTwoConnection } from '../../client/connection'

const { createRetryOptions, DEFAULT_RETRY_OPTS, DEFAULT_TIMEOUT_OPTS } = clientUtils
type AuthorizationToken = {
  data: {
    mediaJwtToken: string
  }
}
const AUTHORIZATION_TOKEN_RESPONSE_SCHEME = Joi.object({
  data: Joi.object({
    mediaJwtToken: Joi.string().required(),
  })
    .required()
    .unknown(true),
})
  .required()
  .unknown(true)
const isAuthorizationTokenResponse = createSchemeGuard<AuthorizationToken>(AUTHORIZATION_TOKEN_RESPONSE_SCHEME)

type IconCreationResponse = {
  data: {
    data: {
      id: string
    }
  }
}

const ICON_CREATION_RESPONSE_SCHEME = Joi.object({
  data: Joi.object({
    data: Joi.object({
      id: Joi.string().required(),
    })
      .required()
      .unknown(true),
  })
    .required()
    .unknown(true),
})
  .required()
  .unknown(true)

const isIconCreationResponseScheme = createSchemeGuard<IconCreationResponse>(ICON_CREATION_RESPONSE_SCHEME)

const deployAdditionIcon = async (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  logoClient: JiraClient,
  workspaceId: string,
  client: JiraClient,
): Promise<void> => {
  const instance = getChangeData(change)
  const url = `/file/binary?collection=insight_${workspaceId}_icons&name=${convertName(instance.value.name)}.png&deletable=true`
  try {
    const resp = await sendIconRequest({ client: logoClient, change, url, fieldName: 'icon' })
    if (!isIconCreationResponseScheme(resp)) {
      throw new Error('Failed to deploy object type icon: Invalid response from Jira API')
    }
    const response = await client.post({
      url: `gateway/api/jsm/assets/workspace/${workspaceId}/v1/icon/create`,
      data: {
        name: instance.value.name,
        mediaFileUuid: resp.data.data.id,
      },
    })
    if (!isIconResponse(response)) {
      throw new Error('Failed to deploy icon to Jira object type: Invalid response from Jira API')
    }
    instance.value.id = Number(response.data.id)
  } catch (e) {
    throw new Error(`Failed to deploy icon to Jira object type: ${e.message}`)
  }
}

/* Fetch object type icons and deploy addition of object type icons */
const filter: FilterCreator = ({ client, config }) => ({
  name: 'objectTypeIconFilter',
  onFetch: async elements => {
    const objectTypeIcons = elements.filter(e => e.elemID.typeName === OBJECT_TYPE_ICON).filter(isInstanceElement)
    const workSpaceId = await getWorkspaceId(client, config)
    const errors: SaltoError[] = []
    await Promise.all(
      objectTypeIcons.map(async objectTypeIcon => {
        try {
          const link = `/gateway/api/jsm/insight/workspace/${workSpaceId}/v1/icon/${objectTypeIcon.value.id}/icon.png`
          await setIconContent({ client, instance: objectTypeIcon, link, fieldName: 'icon' })
        } catch (e) {
          errors.push({ message: e.message, severity: 'Error' })
        }
      }),
    )
    return { errors }
  },

  deploy: async (changes: Change<InstanceElement>[]) => {
    const { jsmApiDefinitions } = config
    if (!config.fetch.enableJSM || !config.fetch.enableJSMPremium || jsmApiDefinitions === undefined) {
      return { deployResult: { appliedChanges: [], errors: [] }, leftoverChanges: changes }
    }
    const [objectTypeIconAdditionChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === OBJECT_TYPE_ICON && isAdditionChange(change),
    )

    const workspaceId = await getWorkspaceId(client, config)
    if (workspaceId === undefined) {
      return {
        deployResult: { appliedChanges: [], errors: [] },
        leftoverChanges: changes,
      }
    }
    const authorizationToken = await client.get({
      url: `/gateway/api/jsm/assets/workspace/${workspaceId}/v1/icon/token-for-uploading-icon`,
    })
    if (!isAuthorizationTokenResponse(authorizationToken)) {
      return {
        deployResult: { appliedChanges: [], errors: [] },
        leftoverChanges: changes,
      }
    }
    const baseUrl = 'https://api.media.atlassian.com'
    const logoConnection = createLogoTwoConnection(createRetryOptions(DEFAULT_RETRY_OPTS, DEFAULT_TIMEOUT_OPTS))
    await logoConnection.login({ token: authorizationToken.data.mediaJwtToken, baseUrl, user: '' })
    const logoClient = new JiraClient({
      connection: logoConnection,
      isDataCenter: false,
      credentials: { baseUrl, token: authorizationToken.data.mediaJwtToken, user: '' },
    })

    const deployResult = await deployChanges(objectTypeIconAdditionChanges.filter(isAdditionChange), async change => {
      await deployAdditionIcon(change, logoClient, workspaceId, client)
    })

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
