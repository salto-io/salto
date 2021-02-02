/*
*                      Copyright 2021 Salto Labs Ltd.
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
/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { ObjectType, BuiltinTypes, MapType } from '@salto-io/adapter-api'
import { createAdapterApiConfigType, createUserFetchConfigType, validateFetchConfig } from '../../../src/elements/ducktype/resource_config'

describe('ducktype_resource_config', () => {
  describe('createAdapterApiConfigType', () => {
    it('should return default type when no custom fields were added', () => {
      const type = createAdapterApiConfigType('myAdapter')
      expect(Object.keys(type.fields)).toHaveLength(2)
      expect(type.fields.resources).toBeDefined()
      expect(type.fields.apiVersion).toBeDefined()
      const resources = type.fields.resources.type as MapType
      expect(resources).toBeInstanceOf(MapType)
      const resourcesInner = resources.innerType as ObjectType
      expect(resourcesInner).toBeInstanceOf(ObjectType)
      expect(new Set(Object.keys(resourcesInner.fields))).toEqual(new Set(['endpoint', 'translation']))
      const endpoint = resourcesInner.fields.endpoint.type as ObjectType
      const translation = resourcesInner.fields.translation.type as ObjectType
      expect(endpoint).toBeInstanceOf(ObjectType)
      expect(translation).toBeInstanceOf(ObjectType)
    })

    it('should include additional custom buckets when added', () => {
      const type = createAdapterApiConfigType(
        'myAdapter',
        { a: { type: BuiltinTypes.STRING } },
        { b: { type: BuiltinTypes.NUMBER } },
      )
      expect(Object.keys(type.fields)).toHaveLength(2)
      expect(type.fields.resources).toBeDefined()
      expect(type.fields.apiVersion).toBeDefined()
      const resources = type.fields.resources.type as MapType
      expect(resources).toBeInstanceOf(MapType)
      const resourcesInner = resources.innerType as ObjectType
      expect(resourcesInner).toBeInstanceOf(ObjectType)
      expect(new Set(Object.keys(resourcesInner.fields))).toEqual(new Set(['endpoint', 'translation']))
      const endpoint = resourcesInner.fields.endpoint.type as ObjectType
      const translation = resourcesInner.fields.translation.type as ObjectType
      expect(endpoint).toBeInstanceOf(ObjectType)
      expect(translation).toBeInstanceOf(ObjectType)
      expect(endpoint.fields.a).toBeDefined()
      expect(translation.fields.b).toBeDefined()
      expect(translation.fields.a).toBeUndefined()
    })
  })

  describe('createUserFetchConfigType', () => {
    it('should return default type when no custom fields were added', () => {
      const type = createUserFetchConfigType('myAdapter')
      expect(Object.keys(type.fields)).toHaveLength(1)
      expect(type.fields.includeResources).toBeDefined()
    })
  })

  describe('validateFetchConfig', () => {
    it('should validate successfully when values are valid', () => {
      expect(() => validateFetchConfig(
        'PATH',
        {
          includeResources: ['a', 'bla'],
        },
        {
          resources: {
            a: {
              endpoint: {
                url: '/x/a',
              },
            },
            bla: {
              endpoint: {
                url: '/bla',
              },
            },
          },
        },
      )).not.toThrow()
    })
    it('should validate successfully when one of the values is 0', () => {
      expect(() => validateFetchConfig(
        'PATH',
        {
          includeResources: ['a', 'unknown'],
        },
        {
          resources: {
            a: {
              endpoint: {
                url: '/x/a',
              },
            },
            bla: {
              endpoint: {
                url: '/bla',
              },
            },
          },
        },
      )).toThrow(new Error('Invalid resource names in PATH: unknown'))
    })
  })
})
