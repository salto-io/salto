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
  AdditionChange,
  SaltoError,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { createSchemeGuard, naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import _ from 'lodash'
import Joi from 'joi'
import { collections } from '@salto-io/lowerdash'
import { client as clientUtils } from '@salto-io/adapter-components'
import { FilterCreator } from '../../filter'
import { OBJECT_TYPE_ICON_TYPE } from '../../constants'
import JiraClient from '../../client/client'
import { deployChanges } from '../../deployment/standard_deployment'
import { isIconResponse, sendIconRequest, setIconContent } from '../icon_utils'
import { getWorkspaceId, getWorkspaceIdMissingErrors } from '../../workspace_id'
import { createLogoConnection } from '../../client/connection'

const log = logger(module)
const { awu } = collections.asynciterable
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
  change: AdditionChange<InstanceElement>,
  logoClient: JiraClient,
  workspaceId: string,
  client: JiraClient,
): Promise<void> => {
  const instance = getChangeData(change)
  const url = `/file/binary?collection=insight_${workspaceId}_icons&name=${pathNaclCase(naclCase(instance.value.name))}.png&deletable=true`
  try {
    const resp = await sendIconRequest({ client: logoClient, change, url, fieldName: 'icon' })
    if (!isIconCreationResponseScheme(resp)) {
      throw new Error(`Failed to deploy object type icon with response: ${resp}`)
    }
    const response = await client.post({
      url: `gateway/api/jsm/assets/workspace/${workspaceId}/v1/icon/create`,
      data: {
        name: instance.value.name,
        mediaFileUuid: resp.data.data.id,
      },
    })
    if (!isIconResponse(response)) {
      throw new Error(`Failed to deploy object type icon with response: ${response}`)
    }
    instance.value.id = response.data.id
  } catch (e) {
    if (e instanceof clientUtils.HTTPError) {
      throw new Error(`Failed to deploy icon to Jira object type: ${e.message}`)
    }
    throw new Error(`Failed to deploy icon to Jira object type: ${e}`)
  }
}

/* This filter responsible to add icons to object type icons nacls and deploy addition of object type icons */
const filter: FilterCreator = ({ client, config, adapterContext }) => ({
  name: 'objectTypeIconFilter',
  onFetch: async elements => {
    if (!config.fetch.enableJSM || !config.fetch.enableJSMPremium) {
      return { errors: [] }
    }
    const objectTypeIcons = elements.filter(e => e.elemID.typeName === OBJECT_TYPE_ICON_TYPE).filter(isInstanceElement)
    if (objectTypeIcons.length === 0) {
      return { errors: [] }
    }
    const workspaceId = await getWorkspaceId(client, config)
    if (workspaceId === undefined) {
      log.error(`Skip fetching of ${OBJECT_TYPE_ICON_TYPE} types because workspaceId is undefined`)
      return {
        errors: [{ message: 'Failed to fetch object type icons because workspaceId is undefined', severity: 'Error' }],
      }
    }
    const errors: SaltoError[] = []
    await awu(objectTypeIcons).forEach(async objectTypeIcon => {
      try {
        const link = `/gateway/api/jsm/insight/workspace/${workspaceId}/v1/icon/${objectTypeIcon.value.id}/icon.png`
        await setIconContent({ client, instance: objectTypeIcon, link, fieldName: 'icon' })
      } catch (e) {
        errors.push({ message: e.message, severity: 'Error' })
      }
    })
    return { errors }
  },
  /* Only deploys addition of object type icons. The deployment of modifications and deletion of object type icons
  is done in the standard jsm deployment. */
  deploy: async (changes: Change<InstanceElement>[]) => {
    const { jsmApiDefinitions } = config
    if (!config.fetch.enableJSM || !config.fetch.enableJSMPremium || jsmApiDefinitions === undefined) {
      return { deployResult: { appliedChanges: [], errors: [] }, leftoverChanges: changes }
    }

    const [objectTypeIconAdditionChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === OBJECT_TYPE_ICON_TYPE && isAdditionChange(change),
    )
    if (objectTypeIconAdditionChanges.length === 0) {
      return { deployResult: { appliedChanges: [], errors: [] }, leftoverChanges: changes }
    }

    const workspaceId = await getWorkspaceId(client, config)
    if (workspaceId === undefined) {
      log.error(`Skip deployment of ${OBJECT_TYPE_ICON_TYPE} types because workspaceId is undefined`)
      const errors = getWorkspaceIdMissingErrors(objectTypeIconAdditionChanges)
      return {
        deployResult: { appliedChanges: [], errors },
        leftoverChanges,
      }
    }
    if (adapterContext.authorizationToken === undefined) {
      const authorizationToken = await client.get({
        url: `/gateway/api/jsm/assets/workspace/${workspaceId}/v1/icon/token-for-uploading-icon`,
      })
      if (!isAuthorizationTokenResponse(authorizationToken)) {
        return {
          deployResult: { appliedChanges: [], errors: [] },
          leftoverChanges: changes,
        }
      }
      adapterContext.authorizationToken = authorizationToken.data.mediaJwtToken
    }
    const baseUrl = 'https://api.media.atlassian.com'
    const logoConnection = createLogoConnection(createRetryOptions(DEFAULT_RETRY_OPTS, DEFAULT_TIMEOUT_OPTS))
    await logoConnection.login({ token: adapterContext.authorizationToken, baseUrl, user: '' })
    const logoClient = new JiraClient({
      connection: logoConnection,
      isDataCenter: false,
      credentials: { baseUrl, token: adapterContext.authorizationToken, user: '' },
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
