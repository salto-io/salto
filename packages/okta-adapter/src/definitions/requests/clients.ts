/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions } from '@salto-io/adapter-components'
import { OktaOptions } from '../types'
import { OktaUserConfig } from '../../user_config'

const OMIT_STATUS_REQUEST_BODY = {
  post: {
    omitBody: true,
  },
}

export const createClientDefinitions = (
  clients: Record<
    definitions.ResolveClientOptionsType<OktaOptions>,
    definitions.RESTApiClientDefinition<definitions.ResolvePaginationOptionsType<OktaOptions>>['httpClient']
  >,
): definitions.ApiDefinitions<OktaOptions>['clients'] => ({
  default: 'main',
  options: {
    main: {
      httpClient: clients.main,
      endpoints: {
        default: {
          get: {
            pagination: 'cursorHeader',
            // only readonly endpoint calls are allowed during fetch. we assume by default that GET endpoints are safe
            readonly: true,
          },
          delete: {
            additionalValidStatuses: [404],
            omitBody: true,
          },
        },
        customizations: {
          '/api/v1/groups': {
            get: {
              queryArgs: { limit: '10000' }, // maximum page size allowed
            },
          },
          '/api/v1/apps': {
            get: {
              queryArgs: { limit: '200' }, // maximum page size allowed
            },
          },
          '/api/v1/groups/rules': {
            get: {
              queryArgs: { limit: '200' }, // maximum page size allowed
            },
          },
          '/api/v1/apps/{appId}/groups': {
            get: {
              queryArgs: { limit: '200' }, // maximum page size allowed
            },
          },
          '/api/v1/mappings': {
            get: {
              queryArgs: { limit: '200' }, // maximum page size allowed
            },
          },
          '/api/v1/users': {
            get: {
              queryArgs: {
                limit: '200', // maximum page size allowed
                search: 'id pr', // The search query is needed to fetch deprovisioned users
              },
            },
          },
          '/api/v1/apps/{id}/lifecycle/activate': OMIT_STATUS_REQUEST_BODY,
          '/api/v1/apps/{id}/lifecycle/deactivate': OMIT_STATUS_REQUEST_BODY,
          '/api/v1/apps/{source}/policies/{target}': {
            put: {
              omitBody: true,
            },
          },
          '/api/v1/authorizationServers/{authorizationServerId}/policies/{id}/lifecycle/activate':
            OMIT_STATUS_REQUEST_BODY,
          '/api/v1/authorizationServers/{authorizationServerId}/policies/{id}/lifecycle/deactivate':
            OMIT_STATUS_REQUEST_BODY,
          '/api/v1/zones/{id}/lifecycle/activate': OMIT_STATUS_REQUEST_BODY,
          '/api/v1/zones/{id}/lifecycle/deactivate': OMIT_STATUS_REQUEST_BODY,
          '/api/v1/idps/{id}/lifecycle/deactivate': OMIT_STATUS_REQUEST_BODY,
          '/api/v1/idps/{id}/lifecycle/activate': OMIT_STATUS_REQUEST_BODY,
        },
      },
    },
    private: {
      httpClient: clients.private,
      endpoints: {
        default: {
          get: {
            pagination: 'cursor',
            // only readonly endpoint calls are allowed during fetch. we assume by default that GET endpoints are safe
            readonly: true,
          },
          delete: {
            omitBody: true,
          },
        },
        customizations: {},
      },
    },
  },
})

export const shouldAccessPrivateAPIs = (isOAuthLogin: boolean, config: OktaUserConfig): boolean => {
  const usePrivateAPI = config.client?.usePrivateAPI
  if (isOAuthLogin || !usePrivateAPI) {
    return false
  }
  return true
}
