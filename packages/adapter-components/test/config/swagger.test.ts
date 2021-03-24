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
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
import { createSwaggerAdapterApiConfigType, validateSwaggerApiDefinitionConfig } from '../../src/config'

describe('config_swagger', () => {
  describe('createSwaggerAdapterApiConfigType', () => {
    it('should return default config type when no custom fields were added', async () => {
      const configType = createSwaggerAdapterApiConfigType({ adapter: 'myAdapter' })
      expect(Object.keys(configType.fields)).toHaveLength(4)
      expect(configType.fields.types).toBeDefined()
      expect(configType.fields.typeDefaults).toBeDefined()
      expect(configType.fields.apiVersion).toBeDefined()
      expect(configType.fields.swagger).toBeDefined()
      const swagger = await configType.fields.swagger.getType() as ObjectType
      expect(swagger).toBeInstanceOf(ObjectType)
      expect(new Set(Object.keys(swagger.fields))).toEqual(new Set(['url', 'typeNameOverrides', 'additionalTypes']))
      const types = await configType.fields.types.getType() as MapType
      expect(types).toBeInstanceOf(MapType)
      const typesInner = await types.getInnerType() as ObjectType
      expect(typesInner).toBeInstanceOf(ObjectType)
      expect(new Set(Object.keys(typesInner.fields))).toEqual(new Set(['request', 'transformation']))
      const request = await typesInner.fields.request.getType() as ObjectType
      const transformation = await typesInner.fields.transformation.getType() as ObjectType
      expect(request).toBeInstanceOf(ObjectType)
      expect(transformation).toBeInstanceOf(ObjectType)
      const typeDefaults = await configType.fields.typeDefaults.getType() as ObjectType
      expect(typeDefaults).toBeInstanceOf(ObjectType)
      expect(new Set(Object.keys(typeDefaults.fields))).toEqual(new Set(['request', 'transformation']))
      const requestDefaults = await typesInner.fields.request.getType() as ObjectType
      const transformationDefaults = await typesInner.fields.transformation.getType() as ObjectType
      expect(requestDefaults).toBeInstanceOf(ObjectType)
      expect(transformationDefaults).toBeInstanceOf(ObjectType)
    })

    it('should include additional fields when added', async () => {
      const configType = createSwaggerAdapterApiConfigType({
        adapter: 'myAdapter',
        additionalRequestFields: { a: { refType: createRefToElmWithValue(BuiltinTypes.STRING) } },
        additionalTransformationFields: { b: {
          refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
        } },
      })
      expect(Object.keys(configType.fields)).toHaveLength(4)
      expect(configType.fields.types).toBeDefined()
      expect(configType.fields.typeDefaults).toBeDefined()
      expect(configType.fields.apiVersion).toBeDefined()
      expect(configType.fields.swagger).toBeDefined()
      const swagger = await configType.fields.swagger.getType() as ObjectType
      expect(swagger).toBeInstanceOf(ObjectType)
      expect(new Set(Object.keys(swagger.fields))).toEqual(new Set(['url', 'typeNameOverrides', 'additionalTypes']))
      const types = await configType.fields.types.getType() as MapType
      expect(types).toBeInstanceOf(MapType)
      const typesInner = await types.getInnerType() as ObjectType
      expect(typesInner).toBeInstanceOf(ObjectType)
      expect(new Set(Object.keys(typesInner.fields))).toEqual(new Set(['request', 'transformation']))
      const request = await typesInner.fields.request.getType() as ObjectType
      const transformation = await typesInner.fields.transformation.getType() as ObjectType
      expect(request).toBeInstanceOf(ObjectType)
      expect(transformation).toBeInstanceOf(ObjectType)
      expect(request.fields.a).toBeDefined()
      expect(transformation.fields.b).toBeDefined()
      expect(transformation.fields.a).toBeUndefined()
      const typeDefaults = await configType.fields.typeDefaults.getType() as ObjectType
      expect(typeDefaults).toBeInstanceOf(ObjectType)
      expect(new Set(Object.keys(typeDefaults.fields))).toEqual(new Set(['request', 'transformation']))
      const requestDefaults = await typesInner.fields.request.getType() as ObjectType
      const transformationDefaults = await typesInner.fields.transformation.getType() as ObjectType
      expect(requestDefaults).toBeInstanceOf(ObjectType)
      expect(transformationDefaults).toBeInstanceOf(ObjectType)
      expect(requestDefaults.fields.a).toBeDefined()
      expect(transformationDefaults.fields.b).toBeDefined()
      expect(transformationDefaults.fields.a).toBeUndefined()
    })
  })

  describe('validateApiDefinitionConfig', () => {
    it('should validate successfully when values are valid', () => {
      expect(() => validateSwaggerApiDefinitionConfig(
        'PATH',
        {
          swagger: {
            url: '/a/b/c',
            additionalTypes: [
              { typeName: 'abc', cloneFrom: 'def' },
            ],
            typeNameOverrides: [
              { newName: 'aaa', originalName: 'bbb' },
            ],
          },
          typeDefaults: {
            transformation: {
              idFields: ['a', 'b'],
            },
          },
          types: {
            abc: {
              transformation: {
                idFields: ['something', 'else'],
              },
            },
            aaa: {
              transformation: {
                idFields: ['something'],
              },
            },
          },
        },
      )).not.toThrow()
    })
    it('should throw when a renamed type is used', () => {
      expect(() => validateSwaggerApiDefinitionConfig(
        'PATH',
        {
          swagger: {
            url: '/a/b/c',
            additionalTypes: [
              { typeName: 'abc', cloneFrom: 'def' },
            ],
            typeNameOverrides: [
              { newName: 'aaa', originalName: 'bbb' },
            ],
          },
          typeDefaults: {
            transformation: {
              idFields: ['a', 'b'],
            },
          },
          types: {
            abc: {
              transformation: {
                idFields: ['something', 'else'],
              },
            },
            bbb: {
              transformation: {
                idFields: ['something'],
              },
            },
          },
        },
      )).toThrow(new Error('Invalid type names in PATH: bbb were renamed in PATH.typeNameOverrides'))
    })
    it('should throw when a type has multiple overrides', () => {
      expect(() => validateSwaggerApiDefinitionConfig(
        'PATH',
        {
          swagger: {
            url: '/a/b/c',
            additionalTypes: [
              { typeName: 'abc', cloneFrom: 'def' },
            ],
            typeNameOverrides: [
              { newName: 'aaa', originalName: 'bbb' },
              { newName: 'ccc', originalName: 'bbb' },
              { newName: 'ddd', originalName: 'eee' },
              { newName: 'fff', originalName: 'eee' },
            ],
          },
          typeDefaults: {
            transformation: {
              idFields: ['a', 'b'],
            },
          },
          types: {
            abc: {
              transformation: {
                idFields: ['something', 'else'],
              },
            },
          },
        },
      )).toThrow(new Error('Duplicate type names in PATH.typeNameOverrides: bbb,eee'))
    })
  })
})
