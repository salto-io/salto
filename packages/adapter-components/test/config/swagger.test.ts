/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import {
  createSwaggerAdapterApiConfigType,
  validateSwaggerApiDefinitionConfig,
  validateSwaggerFetchConfig,
} from '../../src/config'

describe('config_swagger', () => {
  describe('createSwaggerAdapterApiConfigType', () => {
    it('should return default config type when no custom fields were added', async () => {
      const configType = createSwaggerAdapterApiConfigType({ adapter: 'myAdapter' })
      expect(Object.keys(configType.fields)).toHaveLength(5)
      expect(configType.fields.types).toBeDefined()
      expect(configType.fields.typeDefaults).toBeDefined()
      expect(configType.fields.apiVersion).toBeDefined()
      expect(configType.fields.swagger).toBeDefined()
      const swagger = (await configType.fields.swagger.getType()) as ObjectType
      expect(swagger).toBeInstanceOf(ObjectType)
      expect(new Set(Object.keys(swagger.fields))).toEqual(new Set(['url', 'typeNameOverrides', 'additionalTypes']))
      const types = (await configType.fields.types.getType()) as MapType
      expect(types).toBeInstanceOf(MapType)
      const typesInner = (await types.getInnerType()) as ObjectType
      expect(typesInner).toBeInstanceOf(ObjectType)
      expect(new Set(Object.keys(typesInner.fields))).toEqual(new Set(['request', 'transformation', 'deployRequests']))
      const request = (await typesInner.fields.request.getType()) as ObjectType
      const transformation = (await typesInner.fields.transformation.getType()) as ObjectType
      expect(request).toBeInstanceOf(ObjectType)
      expect(transformation).toBeInstanceOf(ObjectType)
      const typeDefaults = (await configType.fields.typeDefaults.getType()) as ObjectType
      expect(typeDefaults).toBeInstanceOf(ObjectType)
      expect(new Set(Object.keys(typeDefaults.fields))).toEqual(new Set(['request', 'transformation']))
      const requestDefaults = (await typesInner.fields.request.getType()) as ObjectType
      const transformationDefaults = (await typesInner.fields.transformation.getType()) as ObjectType
      expect(requestDefaults).toBeInstanceOf(ObjectType)
      expect(transformationDefaults).toBeInstanceOf(ObjectType)
    })

    it('should include additional fields when added', async () => {
      const configType = createSwaggerAdapterApiConfigType({
        adapter: 'myAdapter',
        additionalRequestFields: { a: { refType: BuiltinTypes.STRING } },
        additionalTransformationFields: {
          b: {
            refType: BuiltinTypes.NUMBER,
          },
        },
        additionalTypeFields: { c: { refType: BuiltinTypes.STRING } },
      })
      expect(Object.keys(configType.fields)).toHaveLength(5)
      expect(configType.fields.types).toBeDefined()
      expect(configType.fields.typeDefaults).toBeDefined()
      expect(configType.fields.apiVersion).toBeDefined()
      expect(configType.fields.swagger).toBeDefined()
      const swagger = (await configType.fields.swagger.getType()) as ObjectType
      expect(swagger).toBeInstanceOf(ObjectType)
      expect(new Set(Object.keys(swagger.fields))).toEqual(new Set(['url', 'typeNameOverrides', 'additionalTypes']))
      const types = (await configType.fields.types.getType()) as MapType
      expect(types).toBeInstanceOf(MapType)
      const typesInner = (await types.getInnerType()) as ObjectType
      expect(typesInner).toBeInstanceOf(ObjectType)
      expect(new Set(Object.keys(typesInner.fields))).toEqual(
        new Set(['request', 'transformation', 'deployRequests', 'c']),
      )
      const request = (await typesInner.fields.request.getType()) as ObjectType
      const transformation = (await typesInner.fields.transformation.getType()) as ObjectType
      expect(request).toBeInstanceOf(ObjectType)
      expect(transformation).toBeInstanceOf(ObjectType)
      expect(request.fields.a).toBeDefined()
      expect(transformation.fields.b).toBeDefined()
      expect(transformation.fields.a).toBeUndefined()
      const typeDefaults = (await configType.fields.typeDefaults.getType()) as ObjectType
      expect(typeDefaults).toBeInstanceOf(ObjectType)
      expect(new Set(Object.keys(typeDefaults.fields))).toEqual(new Set(['request', 'transformation', 'c']))
      const requestDefaults = (await typesInner.fields.request.getType()) as ObjectType
      const transformationDefaults = (await typesInner.fields.transformation.getType()) as ObjectType
      expect(requestDefaults).toBeInstanceOf(ObjectType)
      expect(transformationDefaults).toBeInstanceOf(ObjectType)
      expect(requestDefaults.fields.a).toBeDefined()
      expect(transformationDefaults.fields.b).toBeDefined()
      expect(transformationDefaults.fields.a).toBeUndefined()
    })
  })

  describe('validateApiDefinitionConfig', () => {
    it('should validate successfully when values are valid', () => {
      expect(() =>
        validateSwaggerApiDefinitionConfig('PATH', {
          swagger: {
            url: 'https://raw.githubusercontent.com/salto-io/adapter-swaggers/my-swagger.yaml',
            additionalTypes: [{ typeName: 'abc', cloneFrom: 'def' }],
            typeNameOverrides: [
              { newName: 'aaa', originalName: 'bbb' },
              { newName: 'ccc', originalName: 'aaa' },
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
          supportedTypes: {},
        }),
      ).not.toThrow()
    })
    it('should throw when a renamed type is used', () => {
      expect(() =>
        validateSwaggerApiDefinitionConfig('PATH', {
          swagger: {
            url: 'https://raw.githubusercontent.com/salto-io/adapter-swaggers/my-swagger.yaml',
            additionalTypes: [{ typeName: 'abc', cloneFrom: 'def' }],
            typeNameOverrides: [{ newName: 'aaa', originalName: 'bbb' }],
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
          supportedTypes: {},
        }),
      ).toThrow(new Error('Invalid type names in PATH: bbb were renamed in PATH.typeNameOverrides'))
    })
    it('should throw when a type has multiple overrides', () => {
      expect(() =>
        validateSwaggerApiDefinitionConfig('PATH', {
          swagger: {
            url: 'https://raw.githubusercontent.com/salto-io/adapter-swaggers/my-swagger.yaml',
            additionalTypes: [{ typeName: 'abc', cloneFrom: 'def' }],
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
          supportedTypes: {},
        }),
      ).toThrow(new Error('Duplicate type names in PATH.typeNameOverrides: bbb,eee'))
    })
    it('should throw when multiple types have the same overrides', () => {
      expect(() =>
        validateSwaggerApiDefinitionConfig('PATH', {
          swagger: {
            url: 'https://raw.githubusercontent.com/salto-io/adapter-swaggers/my-swagger.yaml',
            additionalTypes: [{ typeName: 'abc', cloneFrom: 'def' }],
            typeNameOverrides: [
              { newName: 'ccc', originalName: 'aaa' },
              { newName: 'ccc', originalName: 'bbb' },
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
          supportedTypes: {},
        }),
      ).toThrow(new Error('Duplicate type names in PATH.typeNameOverrides: ccc'))
    })
    it('should not throw when supportedTypes is non-empty', () => {
      expect(() =>
        validateSwaggerApiDefinitionConfig('PATH', {
          swagger: {
            url: 'https://raw.githubusercontent.com/salto-io/adapter-swaggers/my-swagger.yaml',
            additionalTypes: [{ typeName: 'abc', cloneFrom: 'def' }],
            typeNameOverrides: [{ newName: 'aaa', originalName: 'bbb' }],
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
          supportedTypes: { aa: ['aaa'] },
        }),
      ).not.toThrow()
    })
    it('should throw when provided swagger url is invalid', () => {
      // doesn't start with https://
      expect(() =>
        validateSwaggerApiDefinitionConfig('PATH', {
          swagger: {
            url: 'https://my-swagger.yaml',
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
          supportedTypes: {},
        }),
      ).toThrow(new Error('Swagger url must be valid'))
      // https:// followed by an IPv4 address
      expect(() =>
        validateSwaggerApiDefinitionConfig('PATH', {
          swagger: {
            url: 'https://127.0.0.1/',
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
          supportedTypes: {},
        }),
      ).toThrow(new Error('Swagger url must be valid'))
      // https:// followed by an IPv6 address
      expect(() =>
        validateSwaggerApiDefinitionConfig('PATH', {
          swagger: {
            url: 'https://::1',
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
          supportedTypes: {},
        }),
      ).toThrow(new Error('Swagger url must be valid'))
    })
    it('should not throw on valid swagger urls', () => {
      expect(() =>
        validateSwaggerApiDefinitionConfig('PATH', {
          swagger: {
            url: 'https://raw.githubusercontent.com/salto-io/adapter-swaggers/my-swagger.yaml',
            additionalTypes: [{ typeName: 'abc', cloneFrom: 'def' }],
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
          supportedTypes: {},
        }),
      ).not.toThrow()
    })
  })

  describe('validateFetchConfig', () => {
    it('should validate successfully when values are valid', () => {
      expect(() =>
        validateSwaggerFetchConfig(
          'FETCH_PATH',
          {
            include: [{ type: 'a' }, { type: 'bla' }],
            exclude: [],
          },
          {
            swagger: {
              url: 'www.url.com',
            },
            supportedTypes: {
              a: ['a'],
              bla: ['bla'],
              lala: ['lala'],
            },
            typeDefaults: {
              transformation: {
                idFields: ['id'],
              },
            },
            types: {
              a: {
                request: {
                  url: '/x/a',
                },
              },
              bla: {
                request: {
                  url: '/bla',
                },
              },
            },
          },
        ),
      ).not.toThrow()
    })

    it('should throw when there are invalid includeTypes', () => {
      expect(() =>
        validateSwaggerFetchConfig(
          'FETCH_PATH',
          {
            include: [{ type: 'a' }, { type: 'unknown' }],
            exclude: [],
          },
          {
            swagger: {
              url: 'www.url.com',
            },
            supportedTypes: {
              a: ['a'],
              bla: ['bla'],
              lala: ['lala'],
            },
            typeDefaults: {
              transformation: {
                idFields: ['id'],
              },
            },
            types: {
              a: {
                request: {
                  url: '/x/a',
                },
              },
              bla: {
                request: {
                  url: '/bla',
                },
              },
            },
          },
        ),
      ).toThrow(new Error('Invalid type names in FETCH_PATH: unknown does not match any of the supported types.'))
    })
  })
})
