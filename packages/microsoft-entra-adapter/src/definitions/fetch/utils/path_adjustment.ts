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
import { EndpointPath } from '../../types'
import { FetchCustomizations } from '../types'

export const createCustomizationsWithBasePath = (
  customizations: FetchCustomizations,
  basePath: EndpointPath,
): FetchCustomizations =>
  _.mapValues(customizations, customization => ({
    ...customization,
    requests: customization.requests?.map(req => ({
      ...req,
      endpoint: {
        ...req.endpoint,
        path: `${basePath}${req.endpoint.path}` as EndpointPath,
      },
    })),
  }))
