/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { createUserFetchConfigType } from '../../../src/definitions/user'

describe('config_shared', () => {
  describe('createUserFetchConfigType', () => {
    it('should return default type when no custom fields were added', () => {
      const type = createUserFetchConfigType({ adapterName: 'myAdapter' })
      expect(Object.keys(type.fields)).toHaveLength(5)
      expect(type.fields.include).toBeDefined()
      expect(type.fields.exclude).toBeDefined()
      expect(type.fields.hideTypes).toBeDefined()
      expect(type.fields.asyncPagination).toBeDefined()
      expect(type.fields.elemID).toBeDefined()
    })
    it('should not add elem id when flag is set', () => {
      const type = createUserFetchConfigType({ adapterName: 'myAdapter', omitElemID: true })
      expect(Object.keys(type.fields)).toHaveLength(4)
      expect(type.fields.include).toBeDefined()
      expect(type.fields.exclude).toBeDefined()
      expect(type.fields.hideTypes).toBeDefined()
      expect(type.fields.asyncPagination).toBeDefined()
    })
  })
})
