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

const createCustomizations = (): Record<string, InstanceDeployApiDefinitions> => {
  const standardRequestDefinitions = deployment.helpers.createStandardDeployDefinitions<
    AdditionalAction,
    ClientOptions
  >({
    businessService: { bulkPath: '/business_services', nestUnderField: 'business_service' },
    escalationPolicy: { bulkPath: '/escalation_policies', nestUnderField: 'escalation_policy' },
    schedule: { bulkPath: '/schedules', nestUnderField: 'schedule' },
    team: { bulkPath: '/teams', nestUnderField: 'team' },
  })

  const customDefinitions: Record<string, Partial<InstanceDeployApiDefinitions>> = {
    service: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/services',
                  method: 'post',
                },
                transformation: {
                  omit: ['serviceOrchestration'],
                  nestUnderField: 'service',
                },
              },
              condition: {
                transformForCheck: {
                  omit: ['serviceOrchestration'],
                },
              },
            },
            {
              request: {
                endpoint: {
                  path: '/event_orchestrations/services/{id}',
                  method: 'put',
                },
                transformation: {
                  root: 'serviceOrchestration',
                  nestUnderField: 'orchestration_path',
                },
              },
              condition: {
                transformForCheck: {
                  pick: ['serviceOrchestration'],
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/services/{id}',
                  method: 'delete',
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/services/{id}',
                  method: 'put',
                },
                transformation: {
                  omit: ['serviceOrchestration'],
                  nestUnderField: 'service',
                },
              },
              condition: {
                transformForCheck: {
                  omit: ['serviceOrchestration'],
                },
              },
            },
            {
              request: {
                endpoint: {
                  path: '/event_orchestrations/services/{id}',
                  method: 'put',
                },
                transformation: {
                  root: 'serviceOrchestration',
                  nestUnderField: 'orchestration_path',
                },
              },
              condition: {
                transformForCheck: {
                  pick: ['serviceOrchestration'],
                },
              },
            },
          ],
        },
      },
    },
    eventOrchestration: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/event_orchestrations',
                  method: 'post',
                },
                transformation: {
                  omit: ['eventOrchestrationsRouter'],
                  nestUnderField: 'orchestration',
                },
              },
              condition: {
                transformForCheck: {
                  omit: ['eventOrchestrationsRouter'],
                },
              },
            },
            {
              request: {
                endpoint: {
                  path: '/event_orchestrations/{id}/router',
                  method: 'put',
                },
                transformation: {
                  root: 'eventOrchestrationsRouter',
                  nestUnderField: 'orchestration_path',
                },
              },
              condition: {
                transformForCheck: {
                  pick: ['eventOrchestrationsRouter'],
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/event_orchestrations/{id}',
                  method: 'delete',
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/event_orchestrations/{id}',
                  method: 'put',
                },
                transformation: {
                  omit: ['eventOrchestrationsRouter'],
                  nestUnderField: 'orchestration',
                },
              },
              condition: {
                transformForCheck: {
                  omit: ['eventOrchestrationsRouter'],
                },
              },
            },
            {
              request: {
                endpoint: {
                  path: '/event_orchestrations/{id}/router',
                  method: 'put',
                },
                transformation: {
                  root: 'eventOrchestrationsRouter',
                  nestUnderField: 'orchestration_path',
                },
              },
              condition: {
                transformForCheck: {
                  pick: ['eventOrchestrationsRouter'],
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
  dependencies: [],
})
