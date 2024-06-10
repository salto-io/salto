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
import { DeployCustomDefinitions, DeployRequestDefinition } from '../types'

export const createCustomizationsWithBasePath = (
  customizations: DeployCustomDefinitions,
  basePath: string,
): DeployCustomDefinitions =>
  _.mapValues(customizations, customization => ({
    ...customization,
    requestsByAction: {
      ...customization.requestsByAction,
      customizations: {
        ..._.mapValues(customization.requestsByAction?.customizations, actionCustomizations =>
          (actionCustomizations ?? []).map(action => ({
            ...action,
            request: {
              ...action.request,
              ...((action.request.endpoint
                ? { endpoint: { ...action.request.endpoint, path: `${basePath}${action.request.endpoint.path}` } }
                : {}) as DeployRequestDefinition['endpoint']),
            },
          })),
        ),
      },
    },
  }))
