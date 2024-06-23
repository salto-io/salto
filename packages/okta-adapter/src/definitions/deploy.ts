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
import { AdditionalAction, ClientOptions } from './types'
import { GROUP_TYPE_NAME } from '../constants'

type InstanceDeployApiDefinitions = definitions.deploy.InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>
export type DeployApiDefinitions = definitions.deploy.DeployApiDefinitions<AdditionalAction, ClientOptions>

const createCustomizations = (): Record<string, InstanceDeployApiDefinitions> => {
  const standardRequestDefinitions = deployment.helpers.createStandardDeployDefinitions<
    AdditionalAction,
    ClientOptions
  >({
    [GROUP_TYPE_NAME]: { bulkPath: '/api/v1/groups' },
  })

  const customDefinitions: Record<string, Partial<InstanceDeployApiDefinitions>> = {}

  return _.merge(standardRequestDefinitions, customDefinitions)
}

export const createDeployDefinitions = (): DeployApiDefinitions => ({
  instances: {
    default: {
      requestsByAction: {
        default: {
          request: {
            context: deployment.helpers.DEFAULT_CONTEXT,
          },
          copyFromResponse: {
            updateServiceIDs: true,
          },
        },
      },
      referenceResolution: {
        when: 'early',
      },
    },
    customizations: createCustomizations(),
  },
  dependencies: [],
})
