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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { simpleGetArgs, getTypeAndInstances, getAllElements, returnFullEntry, findNestedField } from '../../../src/elements/ducktype'
import * as typeElements from '../../../src/elements/ducktype/type_elements'
import * as instanceElements from '../../../src/elements/ducktype/instance_elements'
import * as transformer from '../../../src/elements/ducktype/transformer'
import { HTTPClientInterface } from '../../../src/client'

describe('ducktype_transformer', () => {
  describe('simpleGetArgs', () => {
    it('should pass standard args as provided', () => {
      expect(simpleGetArgs({ url: '/a/b/c' })).toEqual([{
        url: '/a/b/c',
        paginationField: undefined,
        queryParams: undefined,
        recursiveQueryParams: undefined,
      }])
      expect(simpleGetArgs({
        url: '/ep', paginationField: 'page', queryParams: { arg1: 'val1' },
      })).toEqual([{
        url: '/ep',
        paginationField: 'page',
        queryParams: { arg1: 'val1' },
        recursiveQueryParams: undefined,
      }])
    })

    it('should convert recursiveQueryParams to functions', () => {
      const res = simpleGetArgs({
        url: '/a/b/c',
        recursiveQueryByResponseField: {
          ref: 'referenced',
          parentId: 'id',
        },
      })
      expect(res).toEqual([{
        url: '/a/b/c',
        recursiveQueryParams: {
          ref: expect.anything(),
          parentId: expect.anything(),
        },
        paginationField: undefined,
        queryParams: undefined,
      }])
      expect(res[0].recursiveQueryParams?.ref({ a: 'a', b: 'b', referenced: 'val' })).toEqual('val')
      expect(res[0].recursiveQueryParams?.parentId({ a: 'a', b: 'b', referenced: 'val' })).toBeUndefined()
      expect(res[0].recursiveQueryParams?.parentId({ id: 'id' })).toEqual('id')
    })
  })

  describe('getTypeAndInstances', () => {
    let mockClient: HTTPClientInterface

    beforeEach(() => {
      mockClient = {
        get: jest.fn().mockImplementationOnce(async function *get() {
          yield [{ name: 'bla1' }]
          yield [{ missing: 'something' }]
        }),
      }
      jest.spyOn(typeElements, 'generateType').mockImplementation(({ adapterName, name }) => {
        const someNested = new ObjectType({ elemID: new ElemID(adapterName, `${name}__some_nested`) })
        const anotherNested = new ObjectType({ elemID: new ElemID(adapterName, `${name}__another_nested`) })
        return {
          type: new ObjectType({
            elemID: new ElemID(adapterName, name),
            fields: { someNested: { type: someNested } },
          }),
          nestedTypes: [someNested, anotherNested],
        }
      })
      jest.spyOn(instanceElements, 'toInstance').mockImplementation(({
        type, entry, nameField,
      }) => new InstanceElement(
        entry[nameField] ?? 'bla',
        type,
        entry,
      ))
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should return the type, nested types and instances', async () => {
      const res = await getTypeAndInstances({
        adapterName: 'something',
        client: mockClient,
        computeGetArgs: simpleGetArgs,
        defaultNameField: 'name',
        defaultPathField: 'also_name',
        typeName: 'myType',
        nestedFieldFinder: returnFullEntry,
        request: {
          url: 'url',
        },
        translation: {},
      })
      expect(res).toHaveLength(5)
      expect(res.map(e => e.elemID.getFullName())).toEqual([
        'something.myType',
        'something.myType__some_nested',
        'something.myType__another_nested',
        'something.myType.instance.bla1',
        'something.myType.instance.bla',
      ])
      expect(mockClient.get).toHaveBeenCalledTimes(1)
      expect(mockClient.get).toHaveBeenCalledWith({ url: 'url', queryParams: undefined, recursiveQueryParams: undefined, paginationField: undefined })
      expect(typeElements.generateType).toHaveBeenCalledTimes(1)
      expect(typeElements.generateType).toHaveBeenCalledWith({
        adapterName: 'something',
        name: 'myType',
        entries: [{ name: 'bla1' }, { missing: 'something' }],
        hasDynamicFields: false,
      })
      expect(instanceElements.toInstance).toHaveBeenCalledTimes(2)
      expect(instanceElements.toInstance).toHaveBeenCalledWith({
        adapterName: 'something',
        entry: { name: 'bla1' },
        type: res[0],
        nameField: 'name',
        pathField: 'also_name',
        defaultName: 'unnamed_0',
        fieldsToOmit: [],
      })
      expect(instanceElements.toInstance).toHaveBeenCalledWith({
        adapterName: 'something',
        entry: { missing: 'something' },
        type: res[0],
        nameField: 'name',
        pathField: 'also_name',
        defaultName: 'unnamed_1',
        fieldsToOmit: [],
      })
    })

    it('should omit fieldsToOmit from instances but not from type', async () => {
      const res = await getTypeAndInstances({
        adapterName: 'something',
        client: mockClient,
        computeGetArgs: simpleGetArgs,
        defaultNameField: 'name',
        defaultPathField: 'also_name',
        typeName: 'myType',
        nestedFieldFinder: returnFullEntry,
        request: {
          url: 'url',
        },
        translation: {
          fieldsToOmit: ['missing'],
        },
      })
      expect(res).toHaveLength(5)
      expect(res.map(e => e.elemID.getFullName())).toEqual([
        'something.myType',
        'something.myType__some_nested',
        'something.myType__another_nested',
        'something.myType.instance.bla1',
        'something.myType.instance.bla',
      ])
      expect(mockClient.get).toHaveBeenCalledTimes(1)
      expect(mockClient.get).toHaveBeenCalledWith({ url: 'url', queryParams: undefined, recursiveQueryParams: undefined, paginationField: undefined })
      expect(typeElements.generateType).toHaveBeenCalledTimes(1)
      expect(typeElements.generateType).toHaveBeenCalledWith({
        adapterName: 'something',
        name: 'myType',
        entries: [{ name: 'bla1' }, {}],
        hasDynamicFields: false,
      })
      expect(instanceElements.toInstance).toHaveBeenCalledTimes(2)
      expect(instanceElements.toInstance).toHaveBeenCalledWith({
        adapterName: 'something',
        entry: { name: 'bla1' },
        type: res[0],
        nameField: 'name',
        pathField: 'also_name',
        defaultName: 'unnamed_0',
        fieldsToOmit: ['missing'],
      })
      expect(instanceElements.toInstance).toHaveBeenCalledWith({
        adapterName: 'something',
        entry: {},
        type: res[0],
        nameField: 'name',
        pathField: 'also_name',
        defaultName: 'unnamed_1',
        fieldsToOmit: ['missing'],
      })
    })

    it('should return nested instances when nestedFieldFinder returns a specific field\'s details', async () => {
      mockClient = {
        get: jest.fn().mockImplementation(async function *get() {
          yield [{ someNested: { name: 'bla1' } }]
          yield [{ someNested: [{ missing: 'something' }] }]
        }),
      }

      const res = await getTypeAndInstances({
        adapterName: 'something',
        client: mockClient,
        computeGetArgs: simpleGetArgs,
        defaultNameField: 'name',
        defaultPathField: 'also_name',
        typeName: 'myType',
        nestedFieldFinder: findNestedField,
        request: {
          url: 'url',
        },
        translation: {},
      })
      expect(res).toHaveLength(5)
      expect(res.map(e => e.elemID.getFullName())).toEqual([
        'something.myType',
        'something.myType__some_nested',
        'something.myType__another_nested',
        'something.myType__some_nested.instance.bla1',
        'something.myType__some_nested.instance.bla',
      ])
      expect(mockClient.get).toHaveBeenCalledTimes(1)
      expect(mockClient.get).toHaveBeenCalledWith({ url: 'url', queryParams: undefined, recursiveQueryParams: undefined, paginationField: undefined })
      expect(typeElements.generateType).toHaveBeenCalledTimes(1)
      expect(typeElements.generateType).toHaveBeenCalledWith({
        adapterName: 'something',
        name: 'myType',
        entries: [{ someNested: { name: 'bla1' } }, { someNested: [{ missing: 'something' }] }],
        hasDynamicFields: false,
      })
      expect(instanceElements.toInstance).toHaveBeenCalledTimes(2)
      expect(instanceElements.toInstance).toHaveBeenCalledWith({
        adapterName: 'something',
        entry: { name: 'bla1' },
        type: res[1],
        nameField: 'name',
        pathField: 'also_name',
        defaultName: 'unnamed_0_0',
        fieldsToOmit: undefined,
      })
      expect(instanceElements.toInstance).toHaveBeenCalledWith({
        adapterName: 'something',
        entry: { missing: 'something' },
        type: res[1],
        nameField: 'name',
        pathField: 'also_name',
        defaultName: 'unnamed_1_0',
        fieldsToOmit: undefined,
      })
    })
  })

  describe('getAllElements', () => {
    const mockClient: HTTPClientInterface = {
      get: jest.fn().mockImplementation(async function *get() {
        yield [{ name: 'bla1' }]
        yield [{ missing: 'something' }]
      }),
    }

    beforeEach(() => {
      jest.spyOn(transformer, 'getTypeAndInstances').mockImplementation(async ({ adapterName, typeName }) => {
        const type = new ObjectType({ elemID: new ElemID(adapterName, typeName) })
        return [
          type,
          new InstanceElement(
            'abc',
            type,
            { bla: 'bla' },
          ),
        ]
      })
    })

    afterEach(() => {
      jest.clearAllMocks()
    })
    afterAll(() => {
      jest.restoreAllMocks()
    })

    it('should return the type, nested types and instances', async () => {
      const res = await getAllElements({
        adapterName: 'something',
        client: mockClient,
        includeEndpoints: ['folder', 'file', 'permission'],
        computeGetArgs: simpleGetArgs,
        defaultExtractionFields: {
          nameField: 'name',
          pathField: 'also_name',
          fieldsToOmit: ['a', 'b'],
        },
        nestedFieldFinder: returnFullEntry,
        endpoints: {
          folder: {
            request: {
              url: '/folders',
            },
            translation: {
              nameField: 'name',
              fieldsToExtract: ['subfolders'],
            },
          },
          file: {
            request: {
              url: '/files',
              dependsOn: ['folder'],
            },
          },
          permission: {
            request: {
              url: '/permissions',
              queryParams: {
                folderId: 'abc',
              },
            },
          },
          workflow: {
            request: {
              url: '/workflows',
            },
          },
        },
      })
      expect(res).toHaveLength(6)
      expect(res.map(e => e.elemID.getFullName())).toEqual([
        'something.folder',
        'something.folder.instance.abc',
        'something.permission',
        'something.permission.instance.abc',
        'something.file',
        'something.file.instance.abc',
      ])
      expect(transformer.getTypeAndInstances).toHaveBeenCalledTimes(3)
      expect(transformer.getTypeAndInstances).toHaveBeenCalledWith({
        adapterName: 'something',
        typeName: 'folder',
        client: mockClient,
        nestedFieldFinder: returnFullEntry,
        computeGetArgs: simpleGetArgs,
        request: {
          url: '/folders',
        },
        translation: {
          nameField: 'name',
          fieldsToExtract: ['subfolders'],
          fieldsToOmit: ['a', 'b'],
        },
        defaultNameField: 'name',
        defaultPathField: 'also_name',
        topLevelFieldsToOmit: undefined,
      })
      expect(transformer.getTypeAndInstances).toHaveBeenCalledWith({
        adapterName: 'something',
        typeName: 'file',
        client: mockClient,
        nestedFieldFinder: returnFullEntry,
        computeGetArgs: simpleGetArgs,
        request: {
          url: '/files',
          dependsOn: ['folder'],
        },
        translation: {
          fieldsToOmit: ['a', 'b'],
        },
        defaultNameField: 'name',
        defaultPathField: 'also_name',
        topLevelFieldsToOmit: undefined,
        contextElements: {
          folder: [expect.anything(), expect.anything()],
          permission: [expect.anything(), expect.anything()],
        },
      })
      expect(transformer.getTypeAndInstances).toHaveBeenCalledWith({
        adapterName: 'something',
        typeName: 'permission',
        client: mockClient,
        nestedFieldFinder: returnFullEntry,
        computeGetArgs: simpleGetArgs,
        request: {
          url: '/permissions',
          queryParams: {
            folderId: 'abc',
          },
        },
        translation: {
          fieldsToOmit: ['a', 'b'],
        },
        defaultNameField: 'name',
        defaultPathField: 'also_name',
        topLevelFieldsToOmit: undefined,
        contextElements: undefined,
      })
    })
  })
})
