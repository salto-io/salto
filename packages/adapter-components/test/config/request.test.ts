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
import { ObjectType, BuiltinTypes, MapType, ListType } from '@salto-io/adapter-api'
import { createRequestConfigs, validateRequestConfig } from '../../src/config'

describe('config_request', () => {
  describe('createRequestConfigs', () => {
    it('should return default config type when no custom fields were added', () => {
      const { request, requestDefault } = createRequestConfigs('myAdapter')
      expect(Object.keys(request.fields)).toHaveLength(5)
      expect(Object.keys(request.fields).sort()).toEqual(['dependsOn', 'paginationField', 'queryParams', 'recursiveQueryByResponseField', 'url'])
      expect(request.fields.url.type).toEqual(BuiltinTypes.STRING)
      expect(request.fields.paginationField.type).toEqual(BuiltinTypes.STRING)
      const dependsOnType = request.fields.dependsOn.type as ListType
      expect(dependsOnType).toBeInstanceOf(ListType)
      const dependsOnTypeInner = dependsOnType.innerType as ObjectType
      expect(dependsOnTypeInner).toBeInstanceOf(ObjectType)
      expect(Object.keys(dependsOnTypeInner.fields).sort()).toEqual(['from', 'pathParam'])
      const queryParamsType = request.fields.queryParams.type as MapType
      expect(queryParamsType).toBeInstanceOf(MapType)
      expect(queryParamsType.innerType).toEqual(BuiltinTypes.STRING)
      const recursiveQueryByResponseFieldType = request.fields.queryParams.type as MapType
      expect(recursiveQueryByResponseFieldType).toBeInstanceOf(MapType)
      expect(recursiveQueryByResponseFieldType.innerType).toEqual(BuiltinTypes.STRING)

      expect(Object.keys(requestDefault.fields)).toHaveLength(4)
      expect(Object.keys(requestDefault.fields).sort()).toEqual(['dependsOn', 'paginationField', 'queryParams', 'recursiveQueryByResponseField'])
      expect(requestDefault.fields.paginationField.type).toEqual(BuiltinTypes.STRING)
      const dependsOnDefaultType = requestDefault.fields.dependsOn.type as ListType
      expect(dependsOnDefaultType).toBeInstanceOf(ListType)
      const dependsOnDefaultTypeInner = dependsOnType.innerType as ObjectType
      expect(dependsOnDefaultTypeInner).toBeInstanceOf(ObjectType)
      expect(Object.keys(dependsOnDefaultTypeInner.fields).sort()).toEqual(['from', 'pathParam'])
      const queryParamsDefaultType = requestDefault.fields.queryParams.type as MapType
      expect(queryParamsDefaultType).toBeInstanceOf(MapType)
      expect(queryParamsDefaultType.innerType).toEqual(BuiltinTypes.STRING)
      const recursiveQueryByResponseFieldDefaultType = (
        requestDefault.fields.queryParams.type as MapType)
      expect(recursiveQueryByResponseFieldDefaultType).toBeInstanceOf(MapType)
      expect(recursiveQueryByResponseFieldDefaultType.innerType).toEqual(BuiltinTypes.STRING)
    })

    it('should include additional fields when added', () => {
      const { request, requestDefault } = createRequestConfigs(
        'myAdapter',
        { a: { type: BuiltinTypes.STRING } },
      )
      expect(Object.keys(request.fields)).toHaveLength(6)
      expect(Object.keys(request.fields).sort()).toEqual(['a', 'dependsOn', 'paginationField', 'queryParams', 'recursiveQueryByResponseField', 'url'])
      expect(request.fields.a.type).toEqual(BuiltinTypes.STRING)
      expect(Object.keys(requestDefault.fields)).toHaveLength(5)
      expect(Object.keys(requestDefault.fields).sort()).toEqual(['a', 'dependsOn', 'paginationField', 'queryParams', 'recursiveQueryByResponseField'])
      expect(requestDefault.fields.a.type).toEqual(BuiltinTypes.STRING)
    })
  })

  describe('validateRequestConfig', () => {
    it('should validate successfully when values are valid', () => {
      expect(() => validateRequestConfig(
        'PATH',
        {
          dependsOn: [
            { pathParam: 'abc', from: { field: 'field', type: 'type' } },
          ],
        },
        {
          t1: {
            url: '/a/b',
            dependsOn: [
              { pathParam: 'abc', from: { field: 'field', type: 'type' } },
              { pathParam: 'def', from: { field: 'field', type: 'type' } },
            ],
          },
          t2: {
            url: '/a/b',
            dependsOn: [
              { pathParam: 'abc', from: { field: 'field', type: 'type' } },
              { pathParam: 'def', from: { field: 'field', type: 'type' } },
            ],
          },
        },
      )).not.toThrow()
    })
    it('should fail if there are conflicts between dependsOn entries in the default config', () => {
      expect(() => validateRequestConfig(
        'PATH',
        {
          dependsOn: [
            { pathParam: 'abc', from: { field: 'field', type: 'type' } },
            { pathParam: 'abc', from: { field: 'f1', type: 't2' } },
          ],
        },
        {
          t1: {
            url: '/a/b',
            dependsOn: [
              { pathParam: 'abc', from: { field: 'field', type: 'type' } },
            ],
          },
          t2: {
            url: '/a/b',
            dependsOn: [
              { pathParam: 'abc', from: { field: 'field', type: 'type' } },
              { pathParam: 'def', from: { field: 'field', type: 'type' } },
            ],
          },
        },
      )).toThrow(new Error('Duplicate dependsOn params found in PATH default config: abc'))
    })
    it('should fail if there are conflicts between dependsOn entries for specific types', () => {
      expect(() => validateRequestConfig(
        'PATH',
        {
          dependsOn: [
            { pathParam: 'abc', from: { field: 'field', type: 'type' } },
          ],
        },
        {
          t1: {
            url: '/a/b',
            dependsOn: [
              { pathParam: 'abc', from: { field: 'field', type: 'type' } },
              { pathParam: 'abc', from: { field: 'f1', type: 't2' } },
              { pathParam: 'def', from: { field: 'field', type: 'type' } },
            ],
          },
          t2: {
            url: '/a/b',
            dependsOn: [
              { pathParam: 'abc', from: { field: 'field', type: 'type' } },
              { pathParam: 'def', from: { field: 'field', type: 'type' } },
              { pathParam: 'def', from: { field: 'field', type: 'type' } },
            ],
          },
        },
      )).toThrow(new Error('Duplicate dependsOn params found in PATH for the following types: t1,t2'))
    })
    it('should fail if not all url params can be resolved', () => {
      expect(() => validateRequestConfig(
        'PATH',
        {
          dependsOn: [
            { pathParam: 'abc', from: { field: 'field', type: 'type' } },
          ],
        },
        {
          t1: {
            url: '/a/b/{something_missing}',
            dependsOn: [
              { pathParam: 'abc', from: { field: 'field', type: 'type' } },
              { pathParam: 'def', from: { field: 'field', type: 'type' } },
            ],
          },
          t2: {
            url: '/a/{something_else}/b/{abc}/{def}',
            dependsOn: [
              { pathParam: 'abc', from: { field: 'field', type: 'type' } },
              { pathParam: 'def', from: { field: 'field', type: 'type' } },
            ],
          },
          t3: {
            url: '/a/b/{abc}/{def}',
            dependsOn: [
              { pathParam: 'abc', from: { field: 'field', type: 'type' } },
              { pathParam: 'def', from: { field: 'field', type: 'type' } },
            ],
          },
        },
      )).toThrow(new Error('Unresolved URL params in the following types in PATH for the following types: t1,t2'))
    })
  })
})
