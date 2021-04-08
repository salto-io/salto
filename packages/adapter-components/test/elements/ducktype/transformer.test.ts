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
import { getTypeAndInstances, getAllElements } from '../../../src/elements/ducktype'
import { returnFullEntry, findDataField } from '../../../src/elements/field_finder'
import * as typeElements from '../../../src/elements/ducktype/type_elements'
import * as instanceElements from '../../../src/elements/ducktype/instance_elements'
import * as transformer from '../../../src/elements/ducktype/transformer'
import { Paginator } from '../../../src/client'
import { TypeDuckTypeConfig, TypeDuckTypeDefaultsConfig } from '../../../src/config'
import { simpleGetArgs } from '../../../src/elements/request_parameters'
import { mockFunction } from '../../common'

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
            fields: { someNested: { type: someNested } },
          }),
          nestedTypes: [someNested, anotherNested],
        }
      })
      jest.spyOn(instanceElements, 'toInstance').mockImplementation(({
        type,
        transformationConfigByType,
        transformationDefaultConfig,
        entry,
      }) => new InstanceElement(
        ((
          transformationConfigByType[type.elemID.name]?.idFields
          ?? transformationDefaultConfig.idFields
        ).map(f => entry[f]).filter(e => e !== undefined)).join('_') || 'bla',
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
      expect(mockPaginator).toHaveBeenCalledWith({ url: 'url', queryParams: undefined, recursiveQueryParams: undefined, paginationField: undefined })
      expect(typeElements.generateType).toHaveBeenCalledTimes(1)
      expect(typeElements.generateType).toHaveBeenCalledWith({
        adapterName: 'something',
        name: 'myType',
        entries: [{ name: 'bla1' }, { missing: 'something' }],
        hasDynamicFields: false,
      })
      expect(instanceElements.toInstance).toHaveBeenCalledTimes(2)
      expect(instanceElements.toInstance).toHaveBeenCalledWith({
        entry: { name: 'bla1' },
        type: res[0],
        transformationConfigByType: {},
        transformationDefaultConfig: {
          idFields: ['name'],
          fileNameFields: ['also_name'],
        },
        defaultName: 'unnamed_0',
      })
      expect(instanceElements.toInstance).toHaveBeenCalledWith({
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
      expect(mockPaginator).toHaveBeenCalledWith({ url: 'url', queryParams: undefined, recursiveQueryParams: undefined, paginationField: undefined })
      expect(typeElements.generateType).toHaveBeenCalledTimes(1)
      expect(typeElements.generateType).toHaveBeenCalledWith({
        adapterName: 'something',
        name: 'myType',
        entries: [{ name: 'bla1' }, { missing: 'something' }],
        hasDynamicFields: false,
      })
      expect(instanceElements.toInstance).toHaveBeenCalledTimes(2)
      expect(instanceElements.toInstance).toHaveBeenCalledWith({
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
      expect(instanceElements.toInstance).toHaveBeenCalledWith({
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
      expect(mockPaginator).toHaveBeenCalledWith({ url: 'url', queryParams: undefined, recursiveQueryParams: undefined, paginationField: undefined })
      expect(typeElements.generateType).toHaveBeenCalledTimes(1)
      expect(typeElements.generateType).toHaveBeenCalledWith({
        adapterName: 'something',
        name: 'myType',
        entries: [{ someNested: { name: 'bla1' } }, { someNested: [{ missing: 'something' }] }],
        hasDynamicFields: false,
      })
      expect(instanceElements.toInstance).toHaveBeenCalledTimes(2)
      expect(instanceElements.toInstance).toHaveBeenCalledWith({
        entry: { name: 'bla1' },
        type: res[1],
        transformationConfigByType: {},
        transformationDefaultConfig: {
          idFields: ['name'],
          fileNameFields: ['also_name'],
        },
        defaultName: 'unnamed_0_0',
      })
      expect(instanceElements.toInstance).toHaveBeenCalledWith({
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
        paginator: mockPaginator,
        includeTypes: ['folder', 'file', 'permission'],
        computeGetArgs: simpleGetArgs,
        nestedFieldFinder: returnFullEntry,
        types: typesConfig,
        typeDefaults: typeDefaultConfig,
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
  })
})
