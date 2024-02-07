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

type InstanceDeployApiDefinitions = definitions.deploy.InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>

// TODO example - adjust and remove irrelevant definitions. check @adapter-components/deployment for helper functions

// business hour schedule holiday deployment:
// first, the "usual" call to create/modify/delete
// for create or modify, a separate call is then made to deploy holidays
const getBusinessHoursScheduleDefinition = (): InstanceDeployApiDefinitions => {
  const basicDef = deployment.helpers.createStandardItemDeployDefinition<AdditionalAction, ClientOptions>({
    bulkPath: '/api/v2/business_hours/schedules',
    nestUnderField: 'schedule',
  })
  const holidayRequest: definitions.deploy.DeployableRequestDefinition<ClientOptions> = {
    // compare the intervals field values -
    // if this is a modification and the values are identical, the erquest will be skipped
    condition: {
      // skipIfIdentical is true by default
      transformForCheck: {
        pick: ['intervals'],
      },
    },
    request: {
      endpoint: {
        path: '/api/v2/business_hours/schedules/{id}/workweek',
        method: 'put',
      },
      // "rename" the intervals field to workweek for the deploy
      transformation: {
        root: 'intervals',
        nestUnderField: 'workweek',
      },
    },
  }
  basicDef.requestsByAction.customizations.add?.push(holidayRequest)
  basicDef.requestsByAction.customizations.modify?.push(holidayRequest)

  return basicDef
}

const createCustomizations = (): Record<string, InstanceDeployApiDefinitions> => {
  const standardRequestDefinitions = deployment.helpers.createStandardDeployDefinitions<
    AdditionalAction,
    ClientOptions
  >({
    group: { bulkPath: '/api/v2/groups' },
    dynamic_content_item: {
      bulkPath: '/api/v2/dynamic_content/items',
      nestUnderField: 'item',
    },
    dynamic_content_item_variant: {
      bulkPath: '/api/v2/dynamic_content/items/{parent_id}/variants',
      nestUnderField: 'variant',
    },
  })
  const customDefinitions: Record<string, Partial<InstanceDeployApiDefinitions>> = {
    business_hours_schedule: getBusinessHoursScheduleDefinition(),
    dynamic_content_item_variant: {
      // dynamic content item variants are separate instances, but we want to group them with the parent for deploy
      changeGroupId: deployment.grouping.groupWithFirstParent,
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
  dependencies: [
    {
      first: { type: 'dynamic_content_item', action: 'add' },
      second: { type: 'dynamic_content_item_variant', action: 'add' },
    },
    {
      first: { type: 'dynamic_content_item', action: 'remove' },
      second: { type: 'dynamic_content_item_variant', action: 'remove' },
    },
  ],
})
