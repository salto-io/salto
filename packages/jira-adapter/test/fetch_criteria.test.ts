/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import fetchCriteria from '../src/fetch_criteria'

describe('fetch_criteria', () => {
  describe('name', () => {
    it('should match element name', () => {
      const instance = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
        name: 'name',
      })

      expect(fetchCriteria.name({ instance, value: '.ame' })).toBeTruthy()
      expect(fetchCriteria.name({ instance, value: 'ame' })).toBeFalsy()
    })
  })
  describe('type', () => {
    it('should match custom field type', () => {
      const instance = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
        schema: {
          custom: 'type',
        },
      })

      expect(fetchCriteria.type({ instance, value: '.ype' })).toBeTruthy()
      expect(fetchCriteria.type({ instance, value: 'ype' })).toBeFalsy()
    })

    it('should match standard field type', () => {
      const instance = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
        schema: {
          type: 'type',
        },
      })

      expect(fetchCriteria.type({ instance, value: '.ype' })).toBeTruthy()
      expect(fetchCriteria.type({ instance, value: 'ype' })).toBeFalsy()
    })
    it('should not match if there is no schema field', () => {
      const instance = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
        otherField: {
          type: 'type',
        },
      })

      expect(fetchCriteria.type({ instance, value: '.ype' })).toBeFalsy()
      expect(fetchCriteria.type({ instance, value: 'ype' })).toBeFalsy()
    })
  })
  describe('state', () => {
    it('should match state field', () => {
      const instance = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
        state: 'state',
      })

      expect(fetchCriteria.state({ instance, value: '.tate' })).toBeTruthy()
      expect(fetchCriteria.state({ instance, value: 'tate' })).toBeFalsy()
    })
  })
})
