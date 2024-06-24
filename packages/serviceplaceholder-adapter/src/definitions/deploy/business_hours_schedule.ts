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

// TODO example - remove if not needed. check @adapter-components/deployment for helper functions

// business hour schedule holiday deployment:
// first, the "usual" call to create/modify/delete
// for create or modify, a separate call is then made to deploy intervals
export const getBusinessHoursScheduleDefinition = (): InstanceDeployApiDefinitions => {
  const basicDef = deployment.helpers.createStandardItemDeployDefinition<AdditionalAction, ClientOptions>({
    bulkPath: '/api/v2/business_hours/schedules',
    nestUnderField: 'schedule',
  })
  const intervalRequest: definitions.deploy.DeployableRequestDefinition<ClientOptions> = {
    // compare the intervals field values -
    // if this is a modification and the values are identical, the request will be skipped
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
        pick: ['intervals'],
        nestUnderField: 'workweek',
      },
    },
  }
  _.assign(basicDef.requestsByAction.customizations?.add?.[0], 'request.transformation.omit', ['schedule.intervals'])
  basicDef.requestsByAction.customizations?.add?.push(intervalRequest)
  basicDef.requestsByAction.customizations?.modify?.push(intervalRequest)

  return basicDef
}
