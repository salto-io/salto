/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions, deployment } from '@salto-io/adapter-components'
import { merge } from 'lodash'
import { BOT_BUILDER_ANSWER, CONVERSATION_BOT, BOT_BUILDER_NODE } from '../../constants'
import { AdditionalAction, ClientOptions } from '../types'
import {
  createFlowMutation,
  createSubFlowMutation,
  deleteFlowMutation,
  deleteSubFlowMutation,
  updateFlowLanguages,
  updateFlowName,
  updateSubFlowMutation,
} from './graphql_schemas'
import {
  transformNodeRequest,
  transformNodeResponse,
  transformReqGraphQLItem,
  transformResGraphQLItem,
} from './transforms'

type InstanceDeployApiDefinitions = definitions.deploy.InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>
type DeployApiDefinitions = definitions.deploy.DeployApiDefinitions<AdditionalAction, ClientOptions>

const createCustomizations = (): Record<string, InstanceDeployApiDefinitions> => {
  const standardRequestDefinitions = deployment.helpers.createStandardDeployDefinitions<
    AdditionalAction,
    ClientOptions
  >({})

  const customDefinitions: Record<string, Partial<InstanceDeployApiDefinitions>> = {
    [CONVERSATION_BOT]: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/api/admin/private/answer_bot/graphql',
                  method: 'post',
                },
                transformation: {
                  adjust: transformReqGraphQLItem(createFlowMutation, 'createFlow', [
                    'botAvatarPath',
                    'name',
                    'brandId',
                    'sourceLanguage',
                  ]),
                },
              },
              copyFromResponse: {
                additional: { adjust: transformResGraphQLItem('createFlow') },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/api/admin/private/answer_bot/graphql',
                  method: 'post',
                },
                transformation: {
                  adjust: transformReqGraphQLItem(updateFlowName, 'updateFlowName', ['id', 'name']),
                },
              },
              copyFromResponse: {
                additional: { adjust: transformResGraphQLItem('updateFlowName') },
              },
            },
            {
              request: {
                endpoint: {
                  path: '/api/admin/private/answer_bot/graphql',
                  method: 'post',
                },
                transformation: {
                  adjust: transformReqGraphQLItem(updateFlowLanguages, 'updateLanguageSettings', [
                    'id',
                    'sourceLanguage',
                    'enabledLanguages',
                  ]),
                },
              },
              copyFromResponse: {
                additional: { adjust: transformResGraphQLItem('updateLanguageSettings') },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/api/admin/private/answer_bot/graphql',
                  method: 'post',
                },
                transformation: {
                  adjust: transformReqGraphQLItem(deleteFlowMutation, 'deleteBotFlow', ['id']),
                },
              },
              copyFromResponse: {
                additional: { adjust: transformResGraphQLItem('deleteBotFlow') },
              },
            },
          ],
        },
      },
    },
    [BOT_BUILDER_ANSWER]: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/api/admin/private/answer_bot/graphql',
                  method: 'post',
                },
                transformation: {
                  adjust: transformReqGraphQLItem(createSubFlowMutation, 'createSubflow', ['flowId', 'name']),
                },
              },
              copyFromResponse: {
                additional: { adjust: transformResGraphQLItem('createSubflow') },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/api/admin/private/answer_bot/graphql',
                  method: 'post',
                },
                transformation: {
                  adjust: transformReqGraphQLItem(updateSubFlowMutation, 'updateSubflow', ['id', 'name']),
                },
              },
              copyFromResponse: {
                additional: { adjust: transformResGraphQLItem('updateSubflow') },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/api/admin/private/answer_bot/graphql',
                  method: 'post',
                },
                transformation: {
                  adjust: transformReqGraphQLItem(deleteSubFlowMutation, 'deleteSubflow', ['id']),
                },
              },
              copyFromResponse: {
                additional: { adjust: transformResGraphQLItem('deleteSubflow') },
              },
            },
          ],
        },
      },
    },
    [BOT_BUILDER_NODE]: {
      concurrency: 1,
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/api/admin/private/answer_bot/graphql',
                  method: 'post',
                },
                transformation: {
                  adjust: transformNodeRequest('Added'),
                },
              },
              copyFromResponse: {
                additional: { adjust: transformNodeResponse() },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/api/admin/private/answer_bot/graphql',
                  method: 'post',
                },
                transformation: {
                  adjust: transformNodeRequest('Changed'),
                },
              },
              copyFromResponse: {
                additional: { adjust: transformNodeResponse() },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/api/admin/private/answer_bot/graphql',
                  method: 'post',
                },
                transformation: {
                  adjust: transformNodeRequest('Deleted'),
                },
              },
              copyFromResponse: {
                additional: { adjust: transformNodeResponse(true) },
              },
            },
          ],
        },
      },
    },
  }

  return merge(standardRequestDefinitions, customDefinitions)
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
    },
    customizations: createCustomizations(),
  },
  dependencies: [],
})
