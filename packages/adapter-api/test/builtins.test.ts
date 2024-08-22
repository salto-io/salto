/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS, getRestriction, createRestriction, isServiceId } from '../src/builtins'

describe('builtins', () => {
  describe('getRestriction', () => {
    it('should a reference to the restriction when element has restriction', () => {
      const annotations = {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ min: 10 }),
      }
      const result = getRestriction({ annotations })
      expect(result).toBe(annotations[CORE_ANNOTATIONS.RESTRICTION])
    })

    it('should return an empty object when element has no restriction', () => {
      const result = getRestriction({ annotations: {} })
      expect(result).toEqual({})
    })
  })

  describe('isServiceId', () => {
    it('should return true when service ID is true', () => {
      const result = isServiceId({
        annotations: {
          _service_id: true,
        },
      })
      expect(result).toEqual(true)
    })

    it('should return false when service ID is false', () => {
      const result = isServiceId({
        annotations: {
          _service_id: false,
        },
      })
      expect(result).toEqual(false)
    })

    it('should return false when service ID is missing', () => {
      const result = isServiceId({
        annotations: {},
      })
      expect(result).toEqual(false)
    })

    it('should return false when annotations are missing', () => {
      const result = isServiceId({})
      expect(result).toEqual(false)
    })
  })
})
