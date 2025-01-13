/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
