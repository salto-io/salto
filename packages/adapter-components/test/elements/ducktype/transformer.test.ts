/*
*                      Copyright 2022 Salto Labs Ltd.
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

import { ObjectType, ElemID, InstanceElement, BuiltinTypes, CORE_ANNOTATIONS, ReferenceExpression } from '@salto-io/adapter-api'
import { mockFunction } from '@salto-io/test-utils'
import { getTypeAndInstances, getAllElements, EntriesRequester } from '../../../src/elements/ducktype'
import * as typeElements from '../../../src/elements/ducktype/type_elements'
import * as instanceElements from '../../../src/elements/ducktype/instance_elements'
import * as transformer from '../../../src/elements/ducktype/transformer'
import { HTTPError, Paginator } from '../../../src/client'
import { TypeDuckTypeConfig, TypeDuckTypeDefaultsConfig } from '../../../src/config'
import { simpleGetArgs, returnFullEntry, computeGetArgs } from '../../../src/elements'
import { findDataField } from '../../../src/elements/field_finder'
import { createElementQuery } from '../../../src/elements/query'

describe('ducktype_transformer', () => {
  describe('getTypeAndInstances', () => {
    let mockPaginator: Paginator

    beforeEach(() => {
      mockPaginator = mockFunction<Paginator>().mockImplementationOnce(async function *get() {
        yield [{ name: 'bla1' }]
        yield [{ missing: 'something' }]
      })
      jest.spyOn(typeElements, 'generateType').mockImplementation(({ adapterName, name }) => {
        const someNested = new ObjectType({ elemID: new ElemID(adapterName, `${name}__some_nested`) })
        const anotherNested = new ObjectType({ elemID: new ElemID(adapterName, `${name}__another_nested`) })
        return {
          type: new ObjectType({
            elemID: new ElemID(adapterName, name),
            fields: { someNested: { refType: someNested } },
          }),
          nestedTypes: [someNested, anotherNested],
        }
      })
      jest.spyOn(instanceElements, 'toInstance').mockImplementation(({
        type,
        transformationConfigByType,
        transformationDefaultConfig,
        entry,
      }) => Promise.resolve(new InstanceElement(
        ((
          transformationConfigByType[type.elemID.name]?.idFields
          ?? transformationDefaultConfig.idFields
        ).map(f => entry[f]).filter(e => e !== undefined)).join('_') || 'bla',
        type,
        entry,
      )))
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should return the type, nested types and instances', async () => {
      const res = await getTypeAndInstances({
        adapterName: 'something',
        paginator: mockPaginator,
        computeGetArgs: simpleGetArgs,
        typeName: 'myType',
        typesConfig: {
          myType: {
            request: {
              url: 'url',
            },
          },
        },
        typeDefaultConfig: {
          transformation: {
            idFields: ['name'],
            fileNameFields: ['also_name'],
          },
        },
        nestedFieldFinder: returnFullEntry,
      })
      expect(res).toHaveLength(5)
      expect(res.map(e => e.elemID.getFullName())).toEqual([
        'something.myType',
        'something.myType__some_nested',
        'something.myType__another_nested',
        'something.myType.instance.bla1',
        'something.myType.instance.bla',
      ])
      expect(mockPaginator).toHaveBeenCalledTimes(1)
      expect(mockPaginator).toHaveBeenCalledWith({ url: 'url', queryParams: undefined, recursiveQueryParams: undefined, paginationField: undefined }, expect.anything())
      expect(typeElements.generateType).toHaveBeenCalledTimes(1)
      expect(typeElements.generateType).toHaveBeenCalledWith({
        adapterName: 'something',
        name: 'myType',
        entries: [{ name: 'bla1' }, { missing: 'something' }],
        hasDynamicFields: false,
        transformationConfigByType: {},
        transformationDefaultConfig: {
          idFields: ['name'],
          fileNameFields: ['also_name'],
        },
      })
      expect(instanceElements.toInstance).toHaveBeenCalledTimes(2)
      expect(instanceElements.toInstance).toHaveBeenNthCalledWith(1, {
        entry: { name: 'bla1' },
        type: res[0],
        transformationConfigByType: {},
        transformationDefaultConfig: {
          idFields: ['name'],
          fileNameFields: ['also_name'],
        },
        defaultName: 'unnamed_0',
      })
      expect(instanceElements.toInstance).toHaveBeenNthCalledWith(2, {
        entry: { missing: 'something' },
        type: res[0],
        transformationConfigByType: {},
        transformationDefaultConfig: {
          idFields: ['name'],
          fileNameFields: ['also_name'],
        },
        defaultName: 'unnamed_1',
      })
    })

    it('should omit fieldsToOmit from instances but not from type', async () => {
      const res = await getTypeAndInstances({
        adapterName: 'something',
        paginator: mockPaginator,
        computeGetArgs: simpleGetArgs,
        typeName: 'myType',
        typesConfig: {
          myType: {
            request: {
              url: 'url',
            },
            transformation: {
              fieldsToOmit: [{ fieldName: 'missing' }],
            },
          },
        },
        typeDefaultConfig: {
          transformation: {
            idFields: ['name'],
            fileNameFields: ['also_name'],
          },
        },
        nestedFieldFinder: returnFullEntry,
      })
      expect(res).toHaveLength(5)
      expect(res.map(e => e.elemID.getFullName())).toEqual([
        'something.myType',
        'something.myType__some_nested',
        'something.myType__another_nested',
        'something.myType.instance.bla1',
        'something.myType.instance.bla',
      ])
      expect(mockPaginator).toHaveBeenCalledTimes(1)
      expect(mockPaginator).toHaveBeenCalledWith({ url: 'url', queryParams: undefined, recursiveQueryParams: undefined, paginationField: undefined }, expect.anything())
      expect(typeElements.generateType).toHaveBeenCalledTimes(1)
      expect(typeElements.generateType).toHaveBeenCalledWith({
        adapterName: 'something',
        name: 'myType',
        entries: [{ name: 'bla1' }, { missing: 'something' }],
        hasDynamicFields: false,
        transformationConfigByType: {
          myType: {
            fieldsToOmit: [{ fieldName: 'missing' }],
          },
        },
        transformationDefaultConfig: {
          idFields: ['name'],
          fileNameFields: ['also_name'],
        },
      })
      expect(instanceElements.toInstance).toHaveBeenCalledTimes(2)
      expect(instanceElements.toInstance).toHaveBeenNthCalledWith(1, {
        entry: { name: 'bla1' },
        type: res[0],
        transformationConfigByType: {
          myType: {
            fieldsToOmit: [{ fieldName: 'missing' }],
          },
        },
        transformationDefaultConfig: {
          idFields: ['name'],
          fileNameFields: ['also_name'],
        },
        defaultName: 'unnamed_0',
      })
      expect(instanceElements.toInstance).toHaveBeenNthCalledWith(2, {
        entry: { missing: 'something' },
        type: res[0],
        transformationConfigByType: {
          myType: {
            fieldsToOmit: [{ fieldName: 'missing' }],
          },
        },
        transformationDefaultConfig: {
          idFields: ['name'],
          fileNameFields: ['also_name'],
        },
        defaultName: 'unnamed_1',
      })
    })

    it('should return nested instances when nestedFieldFinder returns a specific field\'s details', async () => {
      mockPaginator = mockFunction<Paginator>().mockImplementation(async function *get() {
        yield [{ someNested: { name: 'bla1' } }]
        yield [{ someNested: [{ missing: 'something' }] }]
      })

      const res = await getTypeAndInstances({
        adapterName: 'something',
        paginator: mockPaginator,
        computeGetArgs: simpleGetArgs,
        typeName: 'myType',
        typesConfig: {
          myType: {
            request: {
              url: 'url',
            },
          },
        },
        typeDefaultConfig: {
          transformation: {
            idFields: ['name'],
            fileNameFields: ['also_name'],
          },
        },
        nestedFieldFinder: findDataField,
      })
      expect(res).toHaveLength(5)
      expect(res.map(e => e.elemID.getFullName())).toEqual([
        'something.myType',
        'something.myType__some_nested',
        'something.myType__another_nested',
        'something.myType__some_nested.instance.bla1',
        'something.myType__some_nested.instance.bla',
      ])
      expect(mockPaginator).toHaveBeenCalledTimes(1)
      expect(mockPaginator).toHaveBeenCalledWith({ url: 'url', queryParams: undefined, recursiveQueryParams: undefined, paginationField: undefined }, expect.anything())
      expect(typeElements.generateType).toHaveBeenCalledTimes(1)
      expect(typeElements.generateType).toHaveBeenCalledWith({
        adapterName: 'something',
        name: 'myType',
        entries: [{ someNested: { name: 'bla1' } }, { someNested: [{ missing: 'something' }] }],
        hasDynamicFields: false,
        transformationConfigByType: {},
        transformationDefaultConfig: {
          idFields: ['name'],
          fileNameFields: ['also_name'],
        },
      })
      expect(instanceElements.toInstance).toHaveBeenCalledTimes(2)
      expect(instanceElements.toInstance).toHaveBeenNthCalledWith(1, {
        entry: { name: 'bla1' },
        type: res[1],
        transformationConfigByType: {},
        transformationDefaultConfig: {
          idFields: ['name'],
          fileNameFields: ['also_name'],
        },
        defaultName: 'unnamed_0_0',
      })
      expect(instanceElements.toInstance).toHaveBeenNthCalledWith(2, {
        entry: { missing: 'something' },
        type: res[1],
        transformationConfigByType: {},
        transformationDefaultConfig: {
          idFields: ['name'],
          fileNameFields: ['also_name'],
        },
        defaultName: 'unnamed_1_0',
      })
    })

    it('should fail if type is missing from config', async () => {
      mockPaginator = mockFunction<Paginator>().mockImplementation(async function *get() {
        yield [{ someNested: { name: 'bla1' } }]
        yield [{ someNested: [{ missing: 'something' }] }]
      })
      await expect(() => getTypeAndInstances({
        adapterName: 'something',
        paginator: mockPaginator,
        computeGetArgs: simpleGetArgs,
        typeName: 'myType',
        typesConfig: {
          myType: {},
        },
        typeDefaultConfig: {
          transformation: {
            idFields: ['name'],
            fileNameFields: ['also_name'],
          },
        },
        nestedFieldFinder: findDataField,
      })).rejects.toThrow(new Error('Invalid type config - type something.myType has no request config'))
    })
    it('should fail if type does not have request details', async () => {
      mockPaginator = mockFunction<Paginator>().mockImplementation(async function *get() {
        yield [{ someNested: { name: 'bla1' } }]
        yield [{ someNested: [{ missing: 'something' }] }]
      })
      await expect(() => getTypeAndInstances({
        adapterName: 'something',
        paginator: mockPaginator,
        computeGetArgs: simpleGetArgs,
        typeName: 'missing',
        typesConfig: {
          myType: {
            request: {
              url: 'url',
            },
          },
        },
        typeDefaultConfig: {
          transformation: {
            idFields: ['name'],
            fileNameFields: ['also_name'],
          },
        },
        nestedFieldFinder: findDataField,
      })).rejects.toThrow(new Error('could not find type missing'))
    })
    it('should fail if type is setting but there\'s more than one instance', async () => {
      jest.spyOn(typeElements, 'generateType').mockImplementation(({ adapterName, name }) => {
        const someNested = new ObjectType({ elemID: new ElemID(adapterName, `${name}__some_nested`) })
        const anotherNested = new ObjectType({ elemID: new ElemID(adapterName, `${name}__another_nested`) })
        return {
          type: new ObjectType({
            elemID: new ElemID(adapterName, name),
            fields: { someNested: { refType: someNested } },
            isSettings: true,
          }),
          nestedTypes: [someNested, anotherNested],
        }
      })
      await expect(getTypeAndInstances({
        adapterName: 'something',
        paginator: mockPaginator,
        computeGetArgs: simpleGetArgs,
        typeName: 'myType',
        typesConfig: {
          myType: {
            request: {
              url: 'url',
            },
            transformation: {
              isSingleton: true,
            },
          },
        },
        typeDefaultConfig: {
          transformation: {
            idFields: ['name'],
            fileNameFields: ['also_name'],
          },
        },
        nestedFieldFinder: returnFullEntry,
      })).rejects.toThrow(new Error('Could not fetch type myType, singleton types should not have more than one instance'))
    })
    it('should returns recurseInto values in the instances', async () => {
      jest.spyOn(typeElements, 'generateType').mockRestore()
      jest.spyOn(instanceElements, 'toInstance').mockRestore()
      const res = await getTypeAndInstances({
        adapterName: 'something',
        paginator: mockFunction<Paginator>().mockImplementation(async function *get(params) {
          if (params.url === '/folders') {
            yield [{ id: 1, name: 'folder1' }, { id: 2, name: 'folder2' }]
          }
          if (params.url === '/folders/1/subfolders') {
            yield [{ id: 3, name: 'subfolder1' }]
          }
          if (params.url === '/folders/2/subfolders') {
            yield [{ id: 4, name: 'subfolder2' }]
          }
        }),
        computeGetArgs,
        typeName: 'folder',
        typesConfig: {
          folder: {
            request: {
              url: '/folders',
              recurseInto: [
                {
                  type: 'subfolder',
                  toField: 'subfolders',
                  context: [{ name: 'folderId', fromField: 'id' }],
                },
              ],
            },
            transformation: {
              standaloneFields: [{ fieldName: 'subfolders' }],
            },
          },
          subfolder: {
            request: {
              url: '/folders/{folderId}/subfolders',
            },
            transformation: {
              sourceTypeName: 'folder__subfolders',
            },
          },
        },
        typeDefaultConfig: {
          transformation: {
            idFields: ['name'],
            fileNameFields: ['also_name'],
          },
        },
        nestedFieldFinder: returnFullEntry,
      })
      expect(res).toHaveLength(6)
      expect(res.map(e => e.elemID.getFullName())).toEqual([
        'something.folder',
        'something.subfolder',
        'something.folder.instance.folder1',
        'something.folder.instance.folder2',
        'something.subfolder.instance.folder1__subfolder1',
        'something.subfolder.instance.folder2__subfolder2',
      ])
      const folder1 = res.find(e =>
        e.elemID.getFullName() === 'something.folder.instance.folder1') as InstanceElement
      const folder2 = res.find(e =>
        e.elemID.getFullName() === 'something.folder.instance.folder2') as InstanceElement
      const subfolder1 = res.find(
        e => e.elemID.getFullName() === 'something.subfolder.instance.folder1__subfolder1'
      ) as InstanceElement
      const subfolder2 = res.find(
        e => e.elemID.getFullName() === 'something.subfolder.instance.folder2__subfolder2'
      ) as InstanceElement
      expect(folder1.value)
        .toEqual({
          id: 1,
          name: 'folder1',
          subfolders: [new ReferenceExpression(subfolder1.elemID)],
        })
      expect(folder2.value)
        .toEqual({
          id: 2,
          name: 'folder2',
          subfolders: [new ReferenceExpression(subfolder2.elemID)],
        })
      expect(subfolder1.value).toEqual({ id: 3, name: 'subfolder1' })
      expect(subfolder1.annotations).toEqual({ [CORE_ANNOTATIONS.PARENT]: [
        new ReferenceExpression(folder1.elemID, folder1),
      ] })
      expect(subfolder2.value).toEqual({ id: 4, name: 'subfolder2' })
      expect(subfolder2.annotations).toEqual({ [CORE_ANNOTATIONS.PARENT]: [
        new ReferenceExpression(folder2.elemID, folder2),
      ] })
    })
  })

  describe('getAllElements', () => {
    const mockPaginator: Paginator = mockFunction<Paginator>().mockImplementation(
      async function *get() {
        yield [{ name: 'bla1' }]
        yield [{ missing: 'something' }]
      }
    )

    const typesConfig: Record<string, TypeDuckTypeConfig> = {
      folder: {
        request: {
          url: '/folders',
        },
        transformation: {
          idFields: ['name'],
          standaloneFields: [{ fieldName: 'subfolders' }],
        },
      },
      file: {
        request: {
          url: '/files',
          dependsOn: [
            // id doesn't actually exist in the url so this configuration is not realistic
            { pathParam: 'id', from: { type: 'folder', field: 'id' } },
          ],
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
    }
    const typeDefaultConfig: TypeDuckTypeDefaultsConfig = {
      transformation: {
        idFields: ['name'],
        fileNameFields: ['also_name'],
        fieldsToOmit: [{ fieldName: 'a' }, { fieldName: 'b' }],
      },
    }

    afterEach(() => {
      jest.clearAllMocks()
    })
    afterAll(() => {
      jest.restoreAllMocks()
    })

    it('should return the type, nested types and instances', async () => {
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
      const res = await getAllElements({
        adapterName: 'something',
        paginator: mockPaginator,
        fetchQuery: createElementQuery({
          include: [
            { type: 'folder' },
            { type: 'file' },
            { type: 'permission' },
          ],
          exclude: [],
        }),
        supportedTypes: {
          folder: ['folder'],
          file: ['file'],
          permission: ['permission'],
        },
        computeGetArgs: simpleGetArgs,
        nestedFieldFinder: returnFullEntry,
        types: typesConfig,
        typeDefaults: typeDefaultConfig,
      })
      const { elements } = res
      expect(elements.map(e => e.elemID.getFullName())).toEqual([
        'something.folder',
        'something.permission',
        'something.file',
        'something.folder.instance.abc',
        'something.permission.instance.abc',
        'something.file.instance.abc',
        'something.folder__subfolders',
        'something.workflow',
      ])
      expect(transformer.getTypeAndInstances).toHaveBeenCalledTimes(3)
      expect(transformer.getTypeAndInstances).toHaveBeenCalledWith({
        adapterName: 'something',
        typeName: 'folder',
        paginator: mockPaginator,
        nestedFieldFinder: returnFullEntry,
        computeGetArgs: simpleGetArgs,
        typesConfig,
        typeDefaultConfig,
      })
      expect(transformer.getTypeAndInstances).toHaveBeenCalledWith({
        adapterName: 'something',
        typeName: 'file',
        paginator: mockPaginator,
        nestedFieldFinder: returnFullEntry,
        computeGetArgs: simpleGetArgs,
        typesConfig,
        typeDefaultConfig,
        contextElements: {
          folder: [expect.anything(), expect.anything()],
          permission: [expect.anything(), expect.anything()],
        },
      })
      expect(transformer.getTypeAndInstances).toHaveBeenCalledWith({
        adapterName: 'something',
        typeName: 'permission',
        paginator: mockPaginator,
        nestedFieldFinder: returnFullEntry,
        computeGetArgs: simpleGetArgs,
        typesConfig,
        typeDefaultConfig,
        contextElements: undefined,
      })
    })
    it('should run a function to retrieve entries responses and not adding the remaining types', async () => {
      const getEntriesResponseValuesFunc: EntriesRequester = jest.fn()
      const res = await getAllElements({
        adapterName: 'something',
        paginator: mockPaginator,
        fetchQuery: createElementQuery({
          include: [
            { type: 'folder' },
          ],
          exclude: [],
        }),
        supportedTypes: {
          folder: ['folder'],
        },
        computeGetArgs: simpleGetArgs,
        nestedFieldFinder: returnFullEntry,
        types: typesConfig,
        typeDefaults: typeDefaultConfig,
        getEntriesResponseValuesFunc,
        shouldAddRemainingTypes: false,
      })
      const { elements } = res
      expect(elements.map(e => e.elemID.getFullName())).toEqual([
        'something.folder',
        'something.folder.instance.abc',
      ])
      expect(transformer.getTypeAndInstances).toHaveBeenCalledTimes(1)
      expect(transformer.getTypeAndInstances).toHaveBeenCalledWith({
        adapterName: 'something',
        typeName: 'folder',
        paginator: mockPaginator,
        nestedFieldFinder: returnFullEntry,
        computeGetArgs: simpleGetArgs,
        typesConfig,
        typeDefaultConfig,
        getEntriesResponseValuesFunc,
      })
    })
    it('should return config changes', async () => {
      const typeToOverrideWith = 'test'
      jest.spyOn(transformer, 'getTypeAndInstances').mockImplementation(() => {
        throw new HTTPError('err', { data: {}, status: 403 })
      })
      const res = await getAllElements({
        adapterName: 'something',
        paginator: mockPaginator,
        fetchQuery: createElementQuery({
          include: [
            { type: 'folder' },
          ],
          exclude: [],
        }),
        supportedTypes: {
          folder: ['folders'],
        },
        computeGetArgs: simpleGetArgs,
        nestedFieldFinder: returnFullEntry,
        types: {
          folders: {
            request: {
              url: '/folders',
            },
            transformation: {
              idFields: ['name'],
              fieldTypeOverrides: [
                { fieldName: 'test1', fieldType: typeToOverrideWith },
                {
                  fieldName: 'test2',
                  fieldType: BuiltinTypes.STRING.elemID.getFullName(),
                  restrictions: { enforce_value: true, values: ['yes', 'no'] },
                },
              ],
            },
          },
        },
        typeDefaults: typeDefaultConfig,
        isErrorTurnToConfigSuggestion: error =>
          error instanceof HTTPError && (error.response.status === 403),
      })
      const { configChanges } = res
      expect(configChanges).toEqual([{ typeToExclude: 'folder' }])
    })
  })

  describe('getNewElementsFromInstances', () => {
    it('should create new types and instances from existing instances', () => {
      const oldNestedestedType = new ObjectType({
        elemID: new ElemID('someAdapter', 'nestedType'),
        fields: {
          name: { refType: BuiltinTypes.STRING },
        },
      })
      const oldType = new ObjectType({
        elemID: new ElemID('someAdapter', 'someType'),
        fields: {
          id: { refType: BuiltinTypes.NUMBER },
          nested_type: { refType: oldNestedestedType },
        },
      })
      const oldInstances = [
        new InstanceElement(
          'old1',
          oldType,
          {
            id: 123,
            nestedType: {
              name: 'one',
            },
          }
        ),
        new InstanceElement(
          'old1',
          oldType,
          {
            id: 123,
            nestedType: {
              name: 'two',
            },
          }
        ),
      ]

      const { instances, type, nestedTypes } = transformer.getNewElementsFromInstances({
        adapterName: 'someAdapter',
        typeName: 'someType',
        instances: oldInstances,
        transformationConfigByType: {},
        transformationDefaultConfig: { idFields: [] },
      })
      expect(type.elemID.getFullName()).toEqual('someAdapter.someType')
      expect(instances).toHaveLength(2)
      expect(instances[0].refType.type).toEqual(type)
      expect(instances[1].refType.type).toEqual(type)
      expect(nestedTypes).toHaveLength(1)
      expect(type.fields.nestedType.refType.type).toEqual(nestedTypes[0])
    })
  })
})
