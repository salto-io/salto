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
import { definitions, deployment } from '@salto-io/adapter-components'
import { AdditionalAction, ClientOptions } from '../types'
import {
  API_ROLE_TYPE_NAME,
  BUILDING_TYPE_NAME,
  CATEGORY_TYPE_NAME,
  CLASS_TYPE_NAME,
  DEPARTMENT_TYPE_NAME,
  PACKAGE_TYPE_NAME,
  POLICY_TYPE_NAME,
  SCRIPT_TYPE_NAME,
} from '../../constants'
import { createClassicApiDefinitionsForType } from './classic_api_utils'

type InstanceDeployApiDefinitions = definitions.deploy.InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>

const createCustomizations = (): Record<string, InstanceDeployApiDefinitions> => {
  const standardRequestDefinitions = deployment.helpers.createStandardDeployDefinitions<
    AdditionalAction,
    ClientOptions
  >({
    [BUILDING_TYPE_NAME]: { bulkPath: '/api/v1/buildings' },
    [DEPARTMENT_TYPE_NAME]: { bulkPath: '/api/v1/departments' },
    [CATEGORY_TYPE_NAME]: { bulkPath: '/api/v1/categories' },
    [SCRIPT_TYPE_NAME]: { bulkPath: '/api/v1/scripts' },
    [PACKAGE_TYPE_NAME]: { bulkPath: '/api/v1/packages' },
  })
  const customDefinitions: Record<string, Partial<InstanceDeployApiDefinitions>> = {
    [CLASS_TYPE_NAME]: createClassicApiDefinitionsForType(CLASS_TYPE_NAME, `${CLASS_TYPE_NAME}es`),
    [POLICY_TYPE_NAME]: createClassicApiDefinitionsForType(POLICY_TYPE_NAME, 'policies'),
    [API_ROLE_TYPE_NAME]: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/api-roles',
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/api-roles/{id}',
                },
                transformation: {
                  omit: ['id'],
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/api-roles/{id}',
                },
              },
            },
          ],
        },
      },
    },
  }
  return _.merge(standardRequestDefinitions, customDefinitions)
}

export const createDeployDefinitions = (): definitions.deploy.DeployApiDefinitions<never, ClientOptions> => ({
  instances: {
    default: {
      requestsByAction: {
        default: {
          request: {
            context: deployment.helpers.DEFAULT_CONTEXT,
          },
        },
        customizations: {},
      },
      changeGroupId: deployment.grouping.selfGroup,
    },
    customizations: createCustomizations(),
  },
})
