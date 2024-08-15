/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { getConfigWithDefault } from '../../src/config_deprecated'

describe('config_shared', () => {
  describe('getConfigWithDefault', () => {
    it('should return the config with defaults for adapter api when type-specific config is provided', () => {
      expect(
        getConfigWithDefault(
          { url: 'abc', queryParams: { a: 'specific' } },
          { paginationField: 'page', queryParams: { b: 'default' } },
        ),
      ).toEqual({ url: 'abc', queryParams: { a: 'specific' }, paginationField: 'page' })
      expect(
        getConfigWithDefault(
          { standaloneFields: [{ fieldName: 'specific' }] },
          { idFields: ['a', 'b'], standaloneFields: [{ fieldName: 'default' }] },
        ),
      ).toEqual({ idFields: ['a', 'b'], standaloneFields: [{ fieldName: 'specific' }] })
    })
    it('should return the config with defaults for adapter api  when type-specific config is missing', () => {
      expect(getConfigWithDefault(undefined, { paginationField: 'page', queryParams: { b: 'default' } })).toEqual({
        paginationField: 'page',
        queryParams: { b: 'default' },
      })
      expect(
        getConfigWithDefault(undefined, { idFields: ['a', 'b'], standaloneFields: [{ fieldName: 'default' }] }),
      ).toEqual({ idFields: ['a', 'b'], standaloneFields: [{ fieldName: 'default' }] })
    })
  })
})
