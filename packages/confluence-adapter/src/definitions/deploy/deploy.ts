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
import { getBusinessHoursScheduleDefinition } from './business_hours_schedule'

type InstanceDeployApiDefinitions = definitions.deploy.InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>

// TODO example - adjust and remove irrelevant definitions. check @adapter-components/deployment for helper functions

const createCustomizations = (): Record<string, InstanceDeployApiDefinitions> => {
  const standardRequestDefinitions = deployment.helpers.createStandardDeployDefinitions<
    AdditionalAction,
    ClientOptions
  >({
    group: { bulkPath: '/api/v2/groups', nestUnderField: 'group' },
  })
  const customDefinitions: Record<string, Partial<InstanceDeployApiDefinitions>> = {
    business_hours_schedule: getBusinessHoursScheduleDefinition(),
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
  dependencies: [
    // {
    //   first: { type: 'dynamic_content_item', action: 'add' },
    //   second: { type: 'dynamic_content_item_variant', action: 'add' },
    // },
    // {
    //   first: { type: 'dynamic_content_item', action: 'remove' },
    //   second: { type: 'dynamic_content_item_variant', action: 'remove' },
    // },
  ],
})
