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
import { ObjectType, ElemID, BuiltinTypes, ListType, MapType, InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { getAllInstances } from '../../../src/elements/swagger'
import { returnFullEntry } from '../../../src/elements/field_finder'
import { Paginator } from '../../../src/client'
import { simpleGetArgs } from '../../../src/elements/request_parameters'
import { mockFunction } from '../../common'

const ADAPTER_NAME = 'myAdapter'

describe('swagger_instance_elements', () => {
  describe('getAllInstances', () => {
    let mockPaginator: Paginator

    const generateObjectTypes = (): Record<string, ObjectType> => {
      const Owner = new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'Owner'),
        fields: {
          name: { type: BuiltinTypes.STRING },
          additionalProperties: { type: new MapType(BuiltinTypes.UNKNOWN) },
        },
      })
      const Food = new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'Owner'),
        fields: {
          id: { type: BuiltinTypes.STRING },
          name: { type: BuiltinTypes.STRING },
        },
      })
      const Pet = new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'Pet'),
        fields: {
          id: { type: BuiltinTypes.STRING },
          name: { type: BuiltinTypes.STRING },
          owners: { type: new ListType(Owner) },
          primaryOwner: { type: Owner },
          additionalProperties: { type: new MapType(Food) },
        },
      })

      return {
        Owner,
        Pet,
        Food,
      }
    }

    beforeEach(() => {
      mockPaginator = mockFunction<Paginator>().mockImplementation(
        async function *getAll(getParams) {
          if (getParams.url === '/pet') {
            yield [
              {
                id: 'dog',
                name: 'def',
                owners: [
                  { name: 'o1', bla: 'BLA', x: { nested: 'value' } },
                ],
                primaryOwner: { name: 'primary' },
                food1: { id: 'f1' },
                food2: { id: 'f2' },
              },
              {
                id: 'cat',
                name: 'def',
                owners: [
                  { name: 'o2', bla: 'BLA', x: { nested: 'value' } },
                ],
                food1: { id: 'f1' },
                food2: { id: 'f2' },
              },
            ]
            yield [
              {
                id: 'mouse',
                name: 'def',
                owners: [
                  { name: 'o3', bla: 'BLA', x: { nested: 'value' } },
                ],
                food1: { id: 'f1' },
                food2: { id: 'f2' },
              },
            ]
          }
          if (getParams.url === '/owner') {
            yield [
              { name: 'owner2' },
            ]
          }
        }
      )
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should return instances corresponding to the HTTP response and the type', async () => {
      const objectTypes = generateObjectTypes()
      const res = await getAllInstances({
        paginator: mockPaginator,
        apiConfig: {
          swagger: {
            url: 'ignored',
          },
          typeDefaults: {
            transformation: {
              idFields: ['id'],
            },
          },
          types: {
            Owner: {
              request: {
                url: '/owner',
              },
              transformation: {
                idFields: ['name'],
              },
            },
            Pet: {
              request: {
                url: '/pet',
                queryParams: {
                  a: 'b',
                },
              },
            },
          },
        },
        fetchConfig: {
          includeTypes: ['Owner', 'Pet'],
        },
        objectTypes,
        computeGetArgs: simpleGetArgs,
        nestedFieldFinder: returnFullEntry,
      })
      expect(res).toHaveLength(4)
      expect(res.map(e => e.elemID.getFullName())).toEqual([
        `${ADAPTER_NAME}.Owner.instance.owner2`,
        `${ADAPTER_NAME}.Pet.instance.dog`,
        `${ADAPTER_NAME}.Pet.instance.cat`,
        `${ADAPTER_NAME}.Pet.instance.mouse`,
      ])
      expect(mockPaginator).toHaveBeenCalledTimes(2)
      expect(mockPaginator).toHaveBeenCalledWith({ url: '/pet', queryParams: { a: 'b' }, recursiveQueryParams: undefined, paginationField: undefined })
      expect(mockPaginator).toHaveBeenCalledWith({ url: '/owner', queryParams: undefined, recursiveQueryParams: undefined, paginationField: undefined })

      const ownerInst = res.find(e => e.elemID.name === 'owner2')
      expect(ownerInst?.isEqual(new InstanceElement(
        'owner2',
        objectTypes.Owner,
        {
          name: 'owner2',
        },
        [ADAPTER_NAME, 'Records', 'Owner', 'owner2'],
      ))).toBeTruthy()
      const petInst = res.find(e => e.elemID.name === 'dog')
      expect(petInst?.isEqual(new InstanceElement(
        'dog',
        objectTypes.Pet,
        {
          id: 'dog',
          name: 'def',
          owners: [
            {
              name: 'o1',
              additionalProperties: {
                bla: 'BLA',
                x: { nested: 'value' },
              },
            },
          ],
          primaryOwner: { name: 'primary' },
          additionalProperties: {
            food1: { id: 'f1' },
            food2: { id: 'f2' },
          },
        },
        [ADAPTER_NAME, 'Records', 'Pet', 'dog'],
      ))).toBeTruthy()
    })

    it('should extract standalone fields', async () => {
      const objectTypes = generateObjectTypes()
      const res = await getAllInstances({
        paginator: mockPaginator,
        apiConfig: {
          swagger: {
            url: 'ignored',
          },
          typeDefaults: {
            transformation: {
              idFields: ['id'],
            },
          },
          types: {
            Owner: {
              request: {
                url: '/owner',
              },
              transformation: {
                idFields: ['name'],
              },
            },
            Pet: {
              request: {
                url: '/pet',
                queryParams: {
                  a: 'b',
                },
              },
              transformation: {
                standaloneFields: [
                  { fieldName: 'owners' },
                  { fieldName: 'primaryOwner' },
                ],
              },
            },
          },
        },
        fetchConfig: {
          includeTypes: ['Owner', 'Pet'],
        },
        objectTypes,
        computeGetArgs: simpleGetArgs,
        nestedFieldFinder: returnFullEntry,
      })
      expect(res).toHaveLength(8)
      expect(res.map(e => e.elemID.getFullName())).toEqual([
        `${ADAPTER_NAME}.Owner.instance.owner2`,
        `${ADAPTER_NAME}.Pet.instance.dog`,
        `${ADAPTER_NAME}.Owner.instance.dog__o1`,
        `${ADAPTER_NAME}.Owner.instance.dog__primary`,
        `${ADAPTER_NAME}.Pet.instance.cat`,
        `${ADAPTER_NAME}.Owner.instance.cat__o2`,
        `${ADAPTER_NAME}.Pet.instance.mouse`,
        `${ADAPTER_NAME}.Owner.instance.mouse__o3`,
      ])
      expect(mockPaginator).toHaveBeenCalledTimes(2)
      expect(mockPaginator).toHaveBeenCalledWith({ url: '/pet', queryParams: { a: 'b' }, recursiveQueryParams: undefined, paginationField: undefined })
      expect(mockPaginator).toHaveBeenCalledWith({ url: '/owner', queryParams: undefined, recursiveQueryParams: undefined, paginationField: undefined })

      const primaryOInst = res.find(e => e.elemID.name === 'dog__primary') as InstanceElement
      const dogO1Inst = res.find(e => e.elemID.name === 'dog__o1') as InstanceElement
      const petInst = res.find(e => e.elemID.name === 'dog') as InstanceElement
      expect(primaryOInst).toBeInstanceOf(InstanceElement)
      expect(dogO1Inst).toBeInstanceOf(InstanceElement)
      expect(petInst).toBeInstanceOf(InstanceElement)
      expect(dogO1Inst.isEqual(new InstanceElement(
        'dog__o1',
        objectTypes.Owner,
        {
          name: 'o1',
          additionalProperties: {
            bla: 'BLA',
            x: { nested: 'value' },
          },
        },
        [ADAPTER_NAME, 'Records', 'Owner', 'dog__o1'],
        {
          _parent: [
            new ReferenceExpression(petInst.elemID),
          ],
        }
      ))).toBeTruthy()
      expect(primaryOInst.isEqual(new InstanceElement(
        'dog__primary',
        objectTypes.Owner,
        {
          name: 'primary',
        },
        [ADAPTER_NAME, 'Records', 'Owner', 'dog__primary'],
        {
          _parent: [
            new ReferenceExpression(petInst.elemID),
          ],
        }
      ))).toBeTruthy()
      expect(petInst.isEqual(new InstanceElement(
        'dog',
        objectTypes.Pet,
        {
          id: 'dog',
          name: 'def',
          owners: [
            new ReferenceExpression(dogO1Inst.elemID),
          ],
          primaryOwner: new ReferenceExpression(primaryOInst.elemID),
          additionalProperties: {
            food1: { id: 'f1' },
            food2: { id: 'f2' },
          },
        },
        [ADAPTER_NAME, 'Records', 'Pet', 'dog'],
      ))).toBeTruthy()
    })

    it('should not extract standalone fields that are not object types or lists of object types', async () => {
      const objectTypes = generateObjectTypes()
      const res = await getAllInstances({
        paginator: mockPaginator,
        apiConfig: {
          swagger: {
            url: 'ignored',
          },
          typeDefaults: {
            transformation: {
              idFields: ['id'],
            },
          },
          types: {
            Owner: {
              request: {
                url: '/owner',
              },
              transformation: {
                idFields: ['name'],
              },
            },
            Pet: {
              request: {
                url: '/pet',
                queryParams: {
                  a: 'b',
                },
              },
              transformation: {
                standaloneFields: [
                  { fieldName: 'additionalProperties' },
                  { fieldName: 'name' },
                ],
              },
            },
          },
        },
        fetchConfig: {
          includeTypes: ['Owner', 'Pet'],
        },
        objectTypes,
        computeGetArgs: simpleGetArgs,
        nestedFieldFinder: returnFullEntry,
      })
      expect(res).toHaveLength(4)
      expect(res.map(e => e.elemID.getFullName())).toEqual([
        `${ADAPTER_NAME}.Owner.instance.owner2`,
        `${ADAPTER_NAME}.Pet.instance.dog`,
        `${ADAPTER_NAME}.Pet.instance.cat`,
        `${ADAPTER_NAME}.Pet.instance.mouse`,
      ])
    })

    it('should omit fieldsToOmit from instances', async () => {
      const objectTypes = generateObjectTypes()
      const res = await getAllInstances({
        paginator: mockPaginator,
        apiConfig: {
          swagger: {
            url: 'ignored',
          },
          typeDefaults: {
            transformation: {
              idFields: ['id'],
            },
          },
          types: {
            Owner: {
              request: {
                url: '/owner',
              },
              transformation: {
                idFields: ['name'],
              },
            },
            Pet: {
              request: {
                url: '/pet',
                queryParams: {
                  a: 'b',
                },
              },
              transformation: {
                fieldsToOmit: [
                  { fieldName: 'name', fieldType: 'string' },
                  { fieldName: 'primaryOwner' },
                ],
              },
            },
          },
        },
        fetchConfig: {
          includeTypes: ['Owner', 'Pet'],
        },
        objectTypes,
        computeGetArgs: simpleGetArgs,
        nestedFieldFinder: returnFullEntry,
      })
      expect(res).toHaveLength(4)
      expect(res.map(e => e.elemID.getFullName())).toEqual([
        `${ADAPTER_NAME}.Owner.instance.owner2`,
        `${ADAPTER_NAME}.Pet.instance.dog`,
        `${ADAPTER_NAME}.Pet.instance.cat`,
        `${ADAPTER_NAME}.Pet.instance.mouse`,
      ])
      expect(mockPaginator).toHaveBeenCalledTimes(2)
      expect(mockPaginator).toHaveBeenCalledWith({ url: '/pet', queryParams: { a: 'b' }, recursiveQueryParams: undefined, paginationField: undefined })
      expect(mockPaginator).toHaveBeenCalledWith({ url: '/owner', queryParams: undefined, recursiveQueryParams: undefined, paginationField: undefined })

      const petInst = res.find(e => e.elemID.name === 'dog') as InstanceElement
      expect(petInst).toBeInstanceOf(InstanceElement)
      // primaryOwner and name are omitted from the value
      expect(petInst.isEqual(new InstanceElement(
        'dog',
        objectTypes.Pet,
        {
          id: 'dog',
          owners: [
            {
              name: 'o1',
              additionalProperties: {
                bla: 'BLA',
                x: { nested: 'value' },
              },
            },
          ],
          additionalProperties: {
            food1: { id: 'f1' },
            food2: { id: 'f2' },
          },
        },
        [ADAPTER_NAME, 'Records', 'Pet', 'dog'],
      ))).toBeTruthy()
    })

    it('should return nested instances when nestedFieldFinder returns a specific field\'s details', async () => {
      const objectTypes = generateObjectTypes()
      const res = await getAllInstances({
        paginator: mockPaginator,
        apiConfig: {
          swagger: {
            url: 'ignored',
          },
          typeDefaults: {
            transformation: {
              idFields: ['id'],
            },
          },
          types: {
            Owner: {
              request: {
                url: '/owner',
              },
              transformation: {
                idFields: ['name'],
              },
            },
            Pet: {
              request: {
                url: '/pet',
                queryParams: {
                  a: 'b',
                },
              },
            },
          },
        },
        fetchConfig: {
          includeTypes: ['Owner', 'Pet'],
        },
        objectTypes,
        computeGetArgs: simpleGetArgs,
        nestedFieldFinder: type => {
          if (type.fields.owners !== undefined) {
            return {
              field: type.fields.owners,
              type: objectTypes.Owner,
            }
          }
          return undefined
        },
      })
      expect(res).toHaveLength(4)
      expect(res.map(e => e.elemID.getFullName())).toEqual([
        `${ADAPTER_NAME}.Owner.instance.owner2`,
        `${ADAPTER_NAME}.Owner.instance.o1`,
        `${ADAPTER_NAME}.Owner.instance.o2`,
        `${ADAPTER_NAME}.Owner.instance.o3`,
      ])
      expect(mockPaginator).toHaveBeenCalledTimes(2)
      expect(mockPaginator).toHaveBeenCalledWith({ url: '/pet', queryParams: { a: 'b' }, recursiveQueryParams: undefined, paginationField: undefined })
      expect(mockPaginator).toHaveBeenCalledWith({ url: '/owner', queryParams: undefined, recursiveQueryParams: undefined, paginationField: undefined })

      const dogO1Inst = res.find(e => e.elemID.name === 'o1') as InstanceElement
      expect(dogO1Inst).toBeInstanceOf(InstanceElement)
      expect(dogO1Inst.isEqual(new InstanceElement(
        'o1',
        objectTypes.Owner,
        {
          name: 'o1',
          additionalProperties: {
            bla: 'BLA',
            x: { nested: 'value' },
          },
        },
        [ADAPTER_NAME, 'Records', 'Owner', 'o1'],
      ))).toBeTruthy()
    })

    it('should fail gracefully if data field is not an object type', async () => {
      const objectTypes = generateObjectTypes()
      const res = await getAllInstances({
        paginator: mockPaginator,
        apiConfig: {
          swagger: {
            url: 'ignored',
          },
          typeDefaults: {
            transformation: {
              idFields: ['id'],
            },
          },
          types: {
            Pet: {
              request: {
                url: '/pet',
              },
            },
          },
        },
        fetchConfig: {
          includeTypes: ['Pet'],
        },
        objectTypes,
        nestedFieldFinder: type => ({
          field: type.fields.name,
          type, // not the real type
        }),
      })
      expect(res).toHaveLength(0)
    })

    it('should extract inner instances for list types', async () => {
      const objectTypes = generateObjectTypes()
      const PetList = new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'PetList'),
        fields: {
          items: { type: new ListType(objectTypes.Pet) },
        },
      })

      mockPaginator = mockFunction<Paginator>().mockImplementationOnce(async function *get() {
        yield [
          {
            id: 'dog',
            name: 'def',
            owners: [
              { name: 'o1', bla: 'BLA', x: { nested: 'value' } },
            ],
            primaryOwner: { name: 'primary' },
            food1: { id: 'f1' },
            food2: { id: 'f2' },
          },
          {
            id: 'cat',
            name: 'def',
            owners: [
              { name: 'o2', bla: 'BLA', x: { nested: 'value' } },
            ],
            food1: { id: 'f1' },
            food2: { id: 'f2' },
          },
        ]
        yield [
          {
            id: 'mouse',
            name: 'def',
            owners: [
              { name: 'o3', bla: 'BLA', x: { nested: 'value' } },
            ],
            food1: { id: 'f1' },
            food2: { id: 'f2' },
          },
        ]
      })
      const res = await getAllInstances({
        paginator: mockPaginator,
        apiConfig: {
          swagger: {
            url: 'ignored',
          },
          typeDefaults: {
            transformation: {
              idFields: ['id'],
            },
          },
          types: {
            PetList: {
              request: {
                url: '/pet_list',
              },
            },
          },
        },
        fetchConfig: {
          includeTypes: ['PetList'],
        },
        objectTypes: {
          ...objectTypes,
          PetList,
        },
      })
      expect(res).toHaveLength(3)
      expect(res.map(e => e.elemID.getFullName())).toEqual([
        `${ADAPTER_NAME}.Pet.instance.dog`,
        `${ADAPTER_NAME}.Pet.instance.cat`,
        `${ADAPTER_NAME}.Pet.instance.mouse`,
      ])
      expect(mockPaginator).toHaveBeenCalledTimes(1)
      expect(mockPaginator).toHaveBeenCalledWith({ url: '/pet_list', queryParams: undefined, recursiveQueryParams: undefined, paginationField: undefined })

      const petInst = res.find(e => e.elemID.name === 'dog')
      expect(petInst?.isEqual(new InstanceElement(
        'dog',
        objectTypes.Pet,
        {
          id: 'dog',
          name: 'def',
          owners: [
            {
              name: 'o1',
              additionalProperties: {
                bla: 'BLA',
                x: { nested: 'value' },
              },
            },
          ],
          primaryOwner: { name: 'primary' },
          additionalProperties: {
            food1: { id: 'f1' },
            food2: { id: 'f2' },
          },
        },
        [ADAPTER_NAME, 'Records', 'Pet', 'dog'],
      ))).toBeTruthy()
    })

    it('(special case) should extract additionalProperties values if it is the only field nested under a dataField specified in configuration', async () => {
      const CustomObjectDefinition = new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'CustomObjectDefinition'),
        fields: {
          name: { type: BuiltinTypes.STRING },
          additionalProperties: { type: new MapType(BuiltinTypes.UNKNOWN) },
        },
      })
      const CustomObjectDefinitionMapping = new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'CustomObjectDefinitionMapping'),
        fields: {
          additionalProperties: { type: new MapType(CustomObjectDefinition) },
        },
      })
      const AllCustomObjects = new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'AllCustomObjects'),
        fields: {
          definitions: { type: CustomObjectDefinitionMapping },
        },
      })
      const objectTypes = {
        CustomObjectDefinition,
        CustomObjectDefinitionMapping,
        AllCustomObjects,
      }

      mockPaginator = mockFunction<Paginator>().mockImplementationOnce(async function *get() {
        yield [
          {
            definitions: {
              Pet: {
                name: 'Pet',
                something: 'else',
              },
              Owner: {
                name: 'Owner',
                custom: 'field',
              },
            },
          },
          {
            definitions: {
              Food: {
                name: 'Food',
              },
            },
          },
        ]
      })
      const res = await getAllInstances({
        paginator: mockPaginator,
        apiConfig: {
          swagger: {
            url: 'ignored',
          },
          typeDefaults: {
            transformation: {
              idFields: ['name'],
            },
          },
          types: {
            AllCustomObjects: {
              request: {
                url: '/custom_objects',
              },
              transformation: {
                dataField: 'definitions',
              },
            },
          },
        },
        fetchConfig: {
          includeTypes: ['AllCustomObjects'],
        },
        objectTypes,
      })
      expect(res).toHaveLength(3)
      expect(res.map(e => e.elemID.getFullName())).toEqual([
        `${ADAPTER_NAME}.CustomObjectDefinition.instance.Pet`,
        `${ADAPTER_NAME}.CustomObjectDefinition.instance.Owner`,
        `${ADAPTER_NAME}.CustomObjectDefinition.instance.Food`,
      ])
      expect(mockPaginator).toHaveBeenCalledTimes(1)
      expect(mockPaginator).toHaveBeenCalledWith({ url: '/custom_objects', queryParams: undefined, recursiveQueryParams: undefined, paginationField: undefined })

      const petInst = res.find(e => e.elemID.name === 'Pet') as InstanceElement
      expect(petInst).toBeInstanceOf(InstanceElement)
      expect(petInst.isEqual(new InstanceElement(
        'Pet',
        objectTypes.CustomObjectDefinition,
        {
          name: 'Pet',
          additionalProperties: {
            something: 'else',
          },
        },
        [ADAPTER_NAME, 'CustomObjectDefinition', 'Owner', 'Pet'],
      ))).toBeTruthy()
    })

    it('should fail if type is missing from config', async () => {
      const objectTypes = generateObjectTypes()
      await expect(() => getAllInstances({
        paginator: mockPaginator,
        apiConfig: {
          swagger: {
            url: 'ignored',
          },
          typeDefaults: {
            transformation: {
              idFields: ['id'],
            },
          },
          types: {
            Pet: {
            },
          },
        },
        fetchConfig: {
          includeTypes: ['Owner'],
        },
        objectTypes,
      })).rejects.toThrow(new Error('could not find type Owner'))
    })
    it('should fail if type is missing from object types', async () => {
      const objectTypes = generateObjectTypes()
      await expect(() => getAllInstances({
        paginator: mockPaginator,
        apiConfig: {
          swagger: {
            url: 'ignored',
          },
          typeDefaults: {
            transformation: {
              idFields: ['id'],
            },
          },
          types: {
            Bla: {
            },
          },
        },
        fetchConfig: {
          includeTypes: ['Bla'],
        },
        objectTypes,
      })).rejects.toThrow(new Error('could not find type Bla'))
    })
    it('should fail if type does not have request details', async () => {
      const objectTypes = generateObjectTypes()
      await expect(() => getAllInstances({
        paginator: mockPaginator,
        apiConfig: {
          swagger: {
            url: 'ignored',
          },
          typeDefaults: {
            transformation: {
              idFields: ['id'],
            },
          },
          types: {
            Pet: {
            },
          },
        },
        fetchConfig: {
          includeTypes: ['Pet'],
        },
        objectTypes,
      })).rejects.toThrow(new Error('Invalid type config - type myAdapter.Pet has no request config'))
    })
  })
})
