/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { definitions } from '@salto-io/adapter-components'
import { EndpointPath, Options } from '../types'
import { GET_MANAGED_STORE_APP_POST_DEPLOY_PATH } from '../deploy'

export const GRAPH_V1_PATH = '/v1.0'
export const GRAPH_BETA_PATH = '/beta'

export const createClientDefinitions = (
  clients: Record<
    definitions.ResolveClientOptionsType<Options>,
    definitions.RESTApiClientDefinition<definitions.ResolvePaginationOptionsType<Options>>['httpClient']
  >,
): definitions.ApiDefinitions<Options>['clients'] => ({
  default: 'main',
  options: {
    main: {
      httpClient: clients.main,
      endpoints: {
        default: {
          get: {
            pagination: 'cursor',
            readonly: true,
          },
          delete: {
            omitBody: true,
          },
        },
        customizations: {
          '/v1.0/groupLifecyclePolicies/{lifeCyclePolicyId}/addGroup': {
            post: {
              // After creating a group it takes a while for the group to be available for assigning it to a lifecycle policy
              // See a similar issue in https://stackoverflow.com/questions/47303158/add-group-member-fails-with-404-error
              polling: {
                interval: 6000,
                retries: 3,
                checkStatus: response =>
                  response.status === 200 ||
                  (response.status === 400 &&
                    _.get(response, 'data.error.message')?.includes('is already present in the policy')),
                retryOnStatus: [404],
              },
            },
          },
          [`/beta${GET_MANAGED_STORE_APP_POST_DEPLOY_PATH}` as EndpointPath]: {
            get: {
              polling: {
                interval: 5000,
                retries: 6,
                checkStatus: response => !_.isEmpty(_.get(response.data, 'value')),
              },
            },
          },
          '/beta/identity/conditionalAccess/policies': {
            post: {
              polling: {
                interval: 5000,
                retries: 3,
                retryOnStatus: [400],
                checkStatus: response => response.status === 201,
              },
            },
            patch: {
              polling: {
                interval: 5000,
                retries: 3,
                retryOnStatus: [400],
                checkStatus: response => response.status === 204,
              },
            },
          },
        },
      },
    },
  },
})
