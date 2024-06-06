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
import { collections } from '@salto-io/lowerdash'
import { createSchemeGuard } from '@salto-io/adapter-utils'

import JiraClient, { GQL_BASE_URL_GATEWAY } from '../client/client'

const { awu } = collections.asynciterable

const QUERY_INSTALLED_APPS = `query jira_manageApps_getEcosystemInstalledApps($cloudId: ID!) {
    ecosystem {
        appInstallationsByContext(
            filter: { appInstallations: { contexts: [$cloudId] } }
            after: null
        ) {
            nodes {
                app {
                    id
                    name
                }
            }
        }
    }
}`

export const UPM_INSTALLED_APPS_URL = '/rest/plugins/1.0/'

export type ExtensionType = {
  name: string
  id: string
}

export const EXTENSION_ID_LENGTH = 36
export const EXTENSION_ID_ARI_PREFIX = 'ari:cloud:ecosystem::app/'

type UPMInstalledAppsResponseType = {
  data: {
    plugins: {
      name: string
      key: string
      enabled: boolean
      userInstalled: boolean
    }[]
  }
}
const UPM_INSTALLED_APPS_RESPONSE_SCHEME = Joi.object({
  data: Joi.object({
    plugins: Joi.array()
      .items(
        Joi.object({
          name: Joi.string().required(),
          key: Joi.string().required(),
          enabled: Joi.bool().required(),
          userInstalled: Joi.bool().required(),
        }).unknown(true),
      )
      .required(),
  })
    .required()
    .unknown(true),
})
  .unknown(true)
  .required()
export const isUPMInstalledAppsResponse = createSchemeGuard<UPMInstalledAppsResponseType>(
  UPM_INSTALLED_APPS_RESPONSE_SCHEME,
  'Failed to get UPM Installed Apps response',
)
type GQLGatewayInstalledAppsResponseType = {
  data: {
    ecosystem: {
      appInstallationsByContext: {
        nodes: {
          app: {
            id: string
            name: string
          }
        }[]
      }
    }
  }
}
const GQL_GATEWAY_INSTALLED_APPS_RESPONSE_SCHEME = Joi.object({
  data: Joi.object({
    ecosystem: Joi.object({
      appInstallationsByContext: Joi.object({
        nodes: Joi.array()
          .items({
            app: Joi.object({
              id: Joi.string().required(),
              name: Joi.string().required(),
            }).required(),
          })
          .required(),
      }).required(),
    }).required(),
  }).required(),
})
  .unknown(true)
  .required()

const isGQLGatewayInstalledAppsResponse = createSchemeGuard<GQLGatewayInstalledAppsResponseType>(
  GQL_GATEWAY_INSTALLED_APPS_RESPONSE_SCHEME,
  'Failed to get GQL Gateway Installed Apps response',
)

const getInstalledExtensionsUPM = async (client: JiraClient): Promise<ExtensionType[]> => {
  const upmResponse = await client.get({
    url: UPM_INSTALLED_APPS_URL,
  })
  if (isUPMInstalledAppsResponse(upmResponse)) {
    return upmResponse.data.plugins
      .filter(plugin => plugin.enabled && plugin.userInstalled)
      .map(plugin => ({ name: plugin.name, id: plugin.key }))
  }
  throw new Error('Failed to get UPM Installed Apps response')
}

const getInstalledExtensionsGQL = async (client: JiraClient): Promise<ExtensionType[]> => {
  const cloudId = await client.getCloudId()

  const gqlResponse = await client.gqlPost({
    url: GQL_BASE_URL_GATEWAY,
    query: QUERY_INSTALLED_APPS,
    variables: { cloudId: `ari:cloud:jira::site/${cloudId}` },
  })
  if (isGQLGatewayInstalledAppsResponse(gqlResponse)) {
    return gqlResponse.data.ecosystem.appInstallationsByContext.nodes.map(node => {
      // app.id is of the format: <prefix>/<app-id>
      const id = node.app.id.split('/')[1]
      const { name } = node.app
      return { id, name }
    })
  }

  throw new Error('Failed to get GQL Gateway Installed Apps response')
}

export const getInstalledExtensions = async (client: JiraClient): Promise<ExtensionType[]> =>
  (await Promise.all([getInstalledExtensionsUPM(client), getInstalledExtensionsGQL(client)])).flat()

export const getInstalledExtensionsMap = async (client: JiraClient): Promise<Record<string, ExtensionType>> =>
  awu(await getInstalledExtensions(client)).reduce<Record<string, ExtensionType>>((acc, app) => {
    acc[app.id] = app
    return acc
  }, {})
