/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { getFieldTypeOverridesTypes } from '../../../src/openapi/type_elements/type_config_override'

describe('type_config_override', () => {
  describe('getFieldTypeOverridesTypes', () => {
    it('should return additional types from fieldTypeOverrides config', () => {
      const typeConfig = {
        Order: {
          transformation: {
            fieldTypeOverrides: [
              { fieldName: 'petId', fieldType: 'list<number>' },
              { fieldName: 'shipDate', fieldType: 'list<map<Type1>>' },
              { fieldName: 'quantity', fieldType: 'map<Category>' },
              { fieldName: 'newField', fieldType: 'list<Category>' },
              { fieldName: 'newField2', fieldType: 'unknown' },
            ],
          },
        },
        NewType: {
          transformation: {
            fieldTypeOverrides: [
              { fieldName: 'id', fieldType: 'string' },
              { fieldName: 'id', fieldType: 'Type2' },
              { fieldName: 'id', fieldType: 'list<list<list<Type3>>>' },
            ],
          },
        },
        SomeType: {
          transformation: {
            idFields: ['name', 'parent'],
          },
        },
      }
      const typeDefaults = { transformation: { idFields: ['name'] } }
      const result = getFieldTypeOverridesTypes(typeConfig, typeDefaults)
      expect(result).toEqual(new Set(['Type1', 'Category', 'Type2', 'Type3']))
    })
  })
})
