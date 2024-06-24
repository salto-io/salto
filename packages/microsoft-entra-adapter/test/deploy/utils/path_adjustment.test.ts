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

import { DeployCustomDefinitions } from '../../../src/definitions/deploy/types'
import { createCustomizationsWithBasePathForDeploy } from '../../../src/definitions/deploy/utils'

describe(`${createCustomizationsWithBasePathForDeploy.name}`, () => {
  it('should add the base path to the endpoint path when it exists', () => {
    const definitionWithPath: DeployCustomDefinitions = {
      a: {
        requestsByAction: {
          customizations: {
            add: [
              {
                request: {
                  endpoint: {
                    path: '/path',
                  },
                },
              },
            ],
          },
        },
      },
    }
    const resultDefinitionWithPath = createCustomizationsWithBasePathForDeploy(definitionWithPath, '/base')
    expect(resultDefinitionWithPath).toEqual({
      a: {
        requestsByAction: {
          customizations: {
            add: [
              {
                request: {
                  endpoint: {
                    path: '/base/path',
                  },
                },
              },
            ],
          },
        },
      },
    })
  })

  it('should not add endpoint definition if it does not exist', () => {
    const definitionWithoutPath: DeployCustomDefinitions = {
      a: {
        requestsByAction: {
          customizations: {
            add: [
              {
                request: {
                  earlySuccess: true,
                },
              },
            ],
          },
        },
      },
    }
    const resultDefinitionWithoutPath = createCustomizationsWithBasePathForDeploy(definitionWithoutPath, '/base')
    expect(resultDefinitionWithoutPath).toEqual({
      a: {
        requestsByAction: {
          customizations: {
            add: [
              {
                request: {
                  earlySuccess: true,
                },
              },
            ],
          },
        },
      },
    })
  })
})
