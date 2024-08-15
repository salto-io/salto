/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import fetchCriteria from '../src/fetch_criteria'
import { GROUP_TYPE_NAME } from '../src/constants'

describe('fetch_criteria', () => {
  describe('name', () => {
    it('should match element name', () => {
      const instance = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
        name: 'name',
      })

      expect(fetchCriteria.name({ instance, value: '.ame' })).toBeTruthy()
      expect(fetchCriteria.name({ instance, value: 'ame' })).toBeFalsy()
    })
    it('should match group profile.name field', () => {
      const instance = new InstanceElement(
        'instance',
        new ObjectType({ elemID: new ElemID('adapter', GROUP_TYPE_NAME) }),
        {
          type: 'OKTA_GROUP',
          profile: { name: 'name' },
        },
      )

      expect(fetchCriteria.name({ instance, value: '.ame' })).toBeTruthy()
      expect(fetchCriteria.name({ instance, value: 'ame' })).toBeFalsy()
    })
  })
  describe('type', () => {
    it('should match element type', () => {
      const instance = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
        name: 'name',
        type: 'SAML_2_0',
      })

      expect(fetchCriteria.type({ instance, value: 'SAML_._0' })).toBeTruthy()
      expect(fetchCriteria.type({ instance, value: 'OIDC' })).toBeFalsy()
    })
  })
  describe('status', () => {
    it('should match element status', () => {
      const instance = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
        name: 'name',
        status: 'ACTIVE',
      })

      expect(fetchCriteria.status({ instance, value: 'ACTIVE' })).toBeTruthy()
      expect(fetchCriteria.status({ instance, value: 'INACTIVE' })).toBeFalsy()
    })
  })
})
