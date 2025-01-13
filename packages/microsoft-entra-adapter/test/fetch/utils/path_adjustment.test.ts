/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { FetchCustomizations } from '../../../src/definitions/fetch/types'
import { createCustomizationsWithBasePathForFetch } from '../../../src/definitions/fetch/utils'

describe(`${createCustomizationsWithBasePathForFetch.name}`, () => {
  it('should return the correct customizations', () => {
    const customizations: FetchCustomizations = {
      a: {
        requests: [
          {
            endpoint: {
              path: '/path',
            },
          },
        ],
      },
    }
    const basePath = '/base'
    const result = createCustomizationsWithBasePathForFetch(customizations, basePath)
    expect(result).toEqual({
      a: {
        requests: [
          {
            endpoint: {
              path: '/base/path',
            },
          },
        ],
      },
    })
  })
})
