/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { getFieldTypeOverridesTypes } from '../../../src/elements/swagger/type_elements/type_config_override'

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
