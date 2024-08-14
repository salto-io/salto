/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { toHiddenFields, toOmittedFields } from '../../../../../src/definitions/fetch/shared/utils'

describe('field customizations utils', () => {
  describe(`${toHiddenFields.name}`, () => {
    it('should return the correct customizations', () => {
      const result = toHiddenFields(['field1', 'field2'])
      expect(result).toEqual({
        field1: {
          hide: true,
        },
        field2: {
          hide: true,
        },
      })
    })
  })

  describe(`${toOmittedFields.name}`, () => {
    it('should return the correct customizations', () => {
      const result = toOmittedFields(['field1', 'field2'])
      expect(result).toEqual({
        field1: {
          omit: true,
        },
        field2: {
          omit: true,
        },
      })
    })
  })
})
