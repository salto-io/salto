
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
import _ from 'lodash'
import { ObjectType, ElemID, ListType, TypeElement, BuiltinTypes, MapType } from '@salto-io/adapter-api'
import { generateTypes, toPrimitiveType } from '../../../src/elements/swagger'
import { RequestableTypeSwaggerConfig } from '../../../src/config'

jest.mock('@salto-io/lowerdash', () => {
  const actual = jest.requireActual('@salto-io/lowerdash')
  return {
    ...actual,
    promises: {
      ...actual.promises,
      timeout: {
        ...actual.promises.timeout,
        sleep: () => undefined,
      },
    },
  }
})

const ADAPTER_NAME = 'myAdapter'
const BASE_DIR = __dirname.replace('/dist', '')

describe('swagger_type_elements', () => {
  describe('generateTypes', () => {
    const expectedTypes = ['Category', 'Food', 'FoodAndCategory', 'Order', 'Pet', 'Tag', 'User', 'foodDetails', 'pet__findByStatus', 'pet__findByTags', 'store__inventory']
    const expectedParsedConfigs = {
      Order: { request: { url: '/store/order/{orderId}' } },
      Pet: { request: { url: '/pet/{petId}' } },
      // eslint-disable-next-line camelcase
      pet__findByStatus: { request: { url: '/pet/findByStatus' } },
      // eslint-disable-next-line camelcase
      pet__findByTags: { request: { url: '/pet/findByTags' } },
      // eslint-disable-next-line camelcase
      store__inventory: { request: { url: '/store/inventory' } },
      User: { request: { url: '/user/{username}' } },
      Food: { request: { url: '/food/{foodId}' } },
      foodDetails: { request: { url: '/foodDetails' } },
    }

    describe('no config overrides', () => {
      const validateV2 = async (
        url: string,
        extraTypes: string[] = [],
        extraConfig: Record<string, RequestableTypeSwaggerConfig> = {},
      ): ReturnType<typeof generateTypes> => {
        const { allTypes, parsedConfigs } = await generateTypes(
          ADAPTER_NAME,
          {
            swagger: { url },
            typeDefaults: {
              transformation: {
                idFields: ['name'],
                serviceIdField: 'name',
              },
            },
            types: {},
            supportedTypes: {
              Category: ['Category'],
              Food: ['Food'],
              FoodAndCategory: ['FoodAndCategory'],
              Order: ['Order'],
              Pet: ['Pet'],
              Tag: ['Tag'],
              User: ['User'],
              foodDetails: ['foodDetails'],
              pet__findByStatus: ['pet__findByStatus'],
              pet__findByTags: ['pet__findByTags'],
              store__inventory: ['store__inventory'],
              ...Object.fromEntries(extraTypes.map(type => [type, [type]])),
            },
          },
        )
        expect(Object.keys(allTypes).sort()).toEqual([...expectedTypes, ...extraTypes].sort())
        expect(parsedConfigs).toEqual({ ...expectedParsedConfigs, ...extraConfig })
        // regular response type with reference
        const pet = allTypes.Pet as ObjectType
        expect(pet).toBeInstanceOf(ObjectType)
        expect(_.mapValues(pet.fields, f => f.refType.elemID.getFullName())).toEqual({
          additionalProperties: 'Map<unknown>',
          category: 'myAdapter.Category',
          id: 'number',
          name: 'serviceid',
          photoUrls: 'List<string>',
          status: 'string',
          tags: 'List<myAdapter.Tag>',
        })

        // array response type
        const petArray = allTypes.pet__findByStatus
        expect(petArray).toEqual(new ObjectType({
          elemID: new ElemID(ADAPTER_NAME, 'pet__findByStatus'),
          fields: {
            items: { refType: new ListType(pet) },
          },
          path: [ADAPTER_NAME, 'Types', 'pet__findByStatus'],
        }))

        // field with allOf
        const user = allTypes.User as ObjectType
        expect(user).toBeInstanceOf(ObjectType)
        expect(_.mapValues(user.fields, f => f.refType.elemID.getFullName())).toEqual({
          // directly listed
          email: 'string',
          firstName: 'string',
          id: 'number',
          lastName: 'string',
          password: 'string',
          phone: 'string',
          userStatus: 'number',
          username: 'string',
          // ref to UserAdditional1 in swagger
          middleName: 'string',
          // ref to UserAdditional2 in swagger
          middleName2: 'string',
          // additional properties
          additionalProperties: 'Map<myAdapter.Order>',
        })

        // additionalProperties explicit property combined with enabled additionalProperties
        // should be undefined
        const food = allTypes.Food as ObjectType
        expect(food).toBeInstanceOf(ObjectType)
        expect(_.mapValues(food.fields, f => f.refType.elemID.getFullName())).toEqual({
          brand: 'string',
          id: 'number',
          storage: 'List<string>',
          additionalProperties: 'Map<unknown>',
        })

        return { allTypes, parsedConfigs }
      }

      const validateV3 = async (
        url: string,
      ): ReturnType<typeof generateTypes> => {
        const { allTypes, parsedConfigs } = await validateV2(
          url,
          ['foodOrCategory', 'foodXorCategory', 'FoodOrCategory', 'FoodXorCategory', 'Location'],
          {
            foodOrCategory: { request: { url: '/foodOrCategory' } },
            foodXorCategory: { request: { url: '/foodXorCategory' } },
            Location: { request: { url: '/location/{locationName}' } },
          },
        )

        const food = allTypes.Food as ObjectType
        const category = allTypes.Category as ObjectType
        const foodOrCategory = allTypes.FoodOrCategory as ObjectType
        const foodXorCategory = allTypes.FoodOrCategory as ObjectType
        expect(food).toBeInstanceOf(ObjectType)
        expect(category).toBeInstanceOf(ObjectType)
        expect(foodOrCategory).toBeInstanceOf(ObjectType)
        expect(foodXorCategory).toBeInstanceOf(ObjectType)
        // anyOf
        expect(_.mapValues(foodOrCategory.fields, f => f.refType.elemID.name)).toEqual({
          ..._.mapValues(food.fields, f => f.refType.elemID.name),
          ..._.mapValues(category.fields, f => f.refType.elemID.name),
        })
        // oneOf
        expect(_.mapValues(foodXorCategory.fields, f => f.refType.elemID.name)).toEqual({
          ..._.mapValues(food.fields, f => f.refType.elemID.name),
          ..._.mapValues(category.fields, f => f.refType.elemID.name),
        })

        const location = allTypes.Location as ObjectType
        expect(location).toBeInstanceOf(ObjectType)
        expect(_.mapValues(location.fields, f => f.refType.elemID.name)).toEqual({
          additionalProperties: 'Map<unknown>',
          name: 'serviceid',
          // address is defined as anyOf combining primitive and object - should use unknown
          address: 'unknown',
        })

        return { allTypes, parsedConfigs }
      }

      it('should generate the right types for swagger v2 yaml', async () => {
        await validateV2(`${BASE_DIR}/petstore_swagger.v2.yaml`)
      })
      it('should generate the right types for swagger v2 json', async () => {
        await validateV2(`${BASE_DIR}/petstore_swagger.v2.json`)
      })
      it('should generate the right types for swagger v3 yaml', async () => {
        await validateV3(`${BASE_DIR}/petstore_openapi.v3.yaml`)
      })
      it('should generate the right types for swagger v3 json', async () => {
        await validateV3(`${BASE_DIR}/petstore_openapi.v3.json`)
      })
    })

    describe('with config overrides', () => {
      let allTypes: Record<string, TypeElement>
      let parsedConfigs: Record<string, RequestableTypeSwaggerConfig>
      beforeAll(async () => {
        const res = await generateTypes(
          ADAPTER_NAME,
          {
            swagger: {
              url: `${BASE_DIR}/petstore_swagger.v2.yaml`,
              additionalTypes: [
                { typeName: 'Pet2', cloneFrom: 'Pet__new' },
                { typeName: 'Pet3', cloneFrom: 'Pet__new' },
              ],
              typeNameOverrides: [
                { originalName: 'pet__findByTags', newName: 'PetByTag' },
                { originalName: 'Pet', newName: 'Pet__new' },
              ],
            },
            typeDefaults: { transformation: { idFields: ['name'] } },
            types: {
              Order: {
                transformation: {
                  fieldTypeOverrides: [
                    { fieldName: 'petId', fieldType: 'List<number>' },
                    { fieldName: 'shipDate', fieldType: 'Category' },
                    { fieldName: 'quantity', fieldType: 'map<Category>' },
                    { fieldName: 'newField', fieldType: 'map<Category>' },
                    { fieldName: 'newHiddenField', fieldType: 'Category' },
                    { fieldName: 'additionalTypes', fieldType: 'list<AdditionalType>' },
                  ],
                  fieldsToHide: [
                    { fieldName: 'petId' },
                    { fieldName: 'newHiddenField' },
                  ],
                },
              },
              NewType: {
                transformation: {
                  fieldTypeOverrides: [
                    { fieldName: 'id', fieldType: 'string' },
                  ],
                },
              },
              foodDetails: {
                transformation: {
                  isSingleton: true,
                },
              },
            },
            supportedTypes: {
              Category: ['Category'],
              Food: ['Food'],
              FoodAndCategory: ['FoodAndCategory'],
              Order: ['Order'],
              Pet2: ['Pet2'],
              Pet3: ['Pet3'],
              PetByTag: ['PetByTag'],
              Pet__new: ['Pet__new'],
              Tag: ['Tag'],
              User: ['User'],
              foodDetails: ['foodDetails'],
              pet__findByStatus: ['pet__findByStatus'],
              store__inventory: ['store__inventory'],
            },
          },
        )
        allTypes = res.allTypes
        parsedConfigs = res.parsedConfigs
      })
      it('should generate the right types', () => {
        const updatedExpectedTypes = ['AdditionalType', 'Category', 'Food', 'FoodAndCategory', 'NestedType', 'Order', 'Pet2', 'Pet3', 'PetByTag', 'Pet__new', 'Tag', 'User', 'foodDetails', 'pet__findByStatus', 'store__inventory']
        expect(Object.keys(allTypes).sort()).toEqual(updatedExpectedTypes)
        // no Pet2 because it does not have a request config
        const updatedExpectedParsedConfigs = {
          Order: { request: { url: '/store/order/{orderId}' } },
          // eslint-disable-next-line camelcase
          Pet__new: { request: { url: '/pet/{petId}' } },
          // eslint-disable-next-line camelcase
          pet__findByStatus: { request: { url: '/pet/findByStatus' } },
          // eslint-disable-next-line camelcase
          PetByTag: { request: { url: '/pet/findByTags' } },
          // eslint-disable-next-line camelcase
          store__inventory: { request: { url: '/store/inventory' } },
          User: { request: { url: '/user/{username}' } },
          Food: { request: { url: '/food/{foodId}' } },
          foodDetails: { request: { url: '/foodDetails' } },
          AdditionalType: { request: { url: 'AdditionalType' } },
        }
        expect(parsedConfigs).toEqual(updatedExpectedParsedConfigs)
        // regular response type with reference
        const pet = allTypes.Pet__new
        expect(Object.keys((pet as ObjectType).fields).sort()).toEqual(['additionalProperties', 'category', 'id', 'name', 'photoUrls', 'status', 'tags'])
      })

      it('should not have anything under the original typenames', () => {
        expect(allTypes.Pet).toBeUndefined()
        expect(allTypes.pet__findByTags).toBeUndefined()
      })

      it('should override field types', async () => {
        const order = allTypes.Order as ObjectType
        expect(order).toBeInstanceOf(ObjectType)
        expect(await order.fields.petId.getType()).toBeInstanceOf(ListType)
        expect(await (await order.fields.petId.getType() as ListType)
          .getInnerType()).toEqual(BuiltinTypes.NUMBER)
        expect(await order.fields.shipDate.getType()).toEqual(allTypes.Category)
        expect(await order.fields.quantity.getType()).toBeInstanceOf(MapType)
        expect(await (await order.fields.quantity.getType() as MapType)
          .getInnerType()).toEqual(allTypes.Category)
      })
      it('should add fields that did not already exist', async () => {
        const order = allTypes.Order as ObjectType
        expect(order).toBeInstanceOf(ObjectType)
        expect(order.fields.newField).toBeDefined()
        expect(await order.fields.newField.getType()).toBeInstanceOf(MapType)
        expect(await (await order.fields.newField.getType() as MapType)
          .getInnerType()).toEqual(allTypes.Category)
        expect(order.fields.newHiddenField).toBeDefined()
        expect(await order.fields.newHiddenField.getType()).toEqual(allTypes.Category)
        const additionalType = allTypes.AdditionalType as ObjectType
        expect(additionalType).toBeInstanceOf(ObjectType)
        expect(await order.fields.additionalTypes.getType()).toBeInstanceOf(ListType)
        expect(await (await order.fields.additionalTypes.getType() as ListType)
          .getInnerType()).toEqual(additionalType)
      })
      it('should annotate fields from fieldsToHide with _hidden_value=true', () => {
        const order = allTypes.Order as ObjectType
        expect(order).toBeInstanceOf(ObjectType)
        // eslint-disable-next-line no-underscore-dangle
        expect((order.fields.petId.annotations?._hidden_value)).toBeTruthy()
        // eslint-disable-next-line no-underscore-dangle
        expect((order.fields.newHiddenField.annotations?._hidden_value)).toBeTruthy()
      })

      it('should not add types that did not already exist', () => {
        const order = allTypes.NewType as ObjectType
        expect(order).toBeUndefined()
      })
      it('should mark singleton types as isSettings=true', () => {
        const foodDet = allTypes.foodDetails as ObjectType
        expect(foodDet.isSettings).toEqual(true)
      })
    })

    describe('invalid versions', () => {
      it('should fail on invalid swagger version (v2)', async () => {
        await expect(() => generateTypes(
          ADAPTER_NAME,
          {
            swagger: { url: `${BASE_DIR}/invalid_swagger.yaml` },
            typeDefaults: { transformation: { idFields: ['name'] } },
            types: {},
            supportedTypes: {},
          }
        )).rejects.toThrow(new Error('Unrecognized Swagger version: 1.0. Expected 2.0'))
      })
      it('should fail on invalid swagger version (v3)', async () => {
        await expect(() => generateTypes(
          ADAPTER_NAME,
          {
            swagger: { url: `${BASE_DIR}/invalid_openapi.yaml` },
            typeDefaults: { transformation: { idFields: ['name'] } },
            types: {},
            supportedTypes: {},
          }
        )).rejects.toThrow(new Error('Unsupported OpenAPI version: 4.0.1. Swagger Parser only supports versions 3.0.0, 3.0.1, 3.0.2, 3.0.3'))
      })
    })

    describe('with preParsedDefs', () => {
      it('should use the pre-computed schemas and refs instead of parsing', async () => {
        const { allTypes, parsedConfigs } = await generateTypes(
          ADAPTER_NAME,
          {
            swagger: { url: '/non/existent/path' },
            typeDefaults: { transformation: { idFields: ['name'] } },
            types: {},
            supportedTypes: {
              X: ['X'],
              a__b: ['a__b'],
            },
          },
          {
            schemas: {
              '/a/b': {
                properties: {
                  nested: {
                    $ref: '#/definitions/Str',
                  },
                },
              },
              '/c/d': {
                $ref: '#/definitions/X',
              },
            },
            refs: new Map([
              ['#/definitions/Str', { type: 'string' }],
              ['#/definitions/X', {
                type: 'object',
                properties: {
                  a: { type: 'string' },
                  b: { type: 'number' },
                },
              }],
            ]),
          }
        )
        expect(Object.keys(allTypes).sort()).toEqual(['X', 'a__b'].sort())
        expect(parsedConfigs).toEqual({
          a__b: { request: { url: '/a/b' } },
          X: { request: { url: '/c/d' } },
        })
      })
    })
  })

  describe('with supportedTypes', () => {
    it('should only generate supported types', async () => {
      const res = await generateTypes(
        ADAPTER_NAME,
        {
          swagger: { url: `${BASE_DIR}/petstore_swagger.v2.yaml` },
          typeDefaults: { transformation: { idFields: ['name'] } },
          types: {},
          supportedTypes: { a: ['Pet'] },
        },
      )
      expect(Object.keys(res.allTypes).sort()).toEqual(['Pet', 'Category', 'Tag'].sort())
    })
    it('should include recurseInto types', async () => {
      const res = await generateTypes(
        ADAPTER_NAME,
        {
          swagger: { url: `${BASE_DIR}/petstore_swagger.v2.yaml` },
          typeDefaults: { transformation: { idFields: ['name'] } },
          types: {
            Pet: {
              request: {
                url: '/abc',
                recurseInto: [
                  {
                    type: 'Food',
                    toField: 'food',
                    context: [],
                  },
                ],
              },
            },
            Food: {
              request: {
                url: '/def',
                recurseInto: [
                  {
                    type: 'Order',
                    toField: 'order',
                    context: [],
                  },
                ],
              },
            },
          },
          supportedTypes: { a: ['Pet'] },
        },
      )
      expect(Object.keys(res.allTypes).sort()).toEqual(['Pet', 'Category', 'Tag', 'Food', 'Order'].sort())
    })
  })

  describe('toPrimitiveType', () => {
    it('should return the right primitive type when one is specified', () => {
      expect(toPrimitiveType('string')).toEqual(BuiltinTypes.STRING)
      expect(toPrimitiveType('byte')).toEqual(BuiltinTypes.STRING)
      expect(toPrimitiveType('number')).toEqual(BuiltinTypes.NUMBER)
      expect(toPrimitiveType('date')).toEqual(BuiltinTypes.STRING)
    })
    it('should return unknown when type is not known', () => {
      expect(toPrimitiveType('bla')).toEqual(BuiltinTypes.UNKNOWN)
    })
    it('should return correct type when multiple types that map to the same builtin are specified', () => {
      expect(toPrimitiveType(['string', 'byte'])).toEqual(BuiltinTypes.STRING)
    })
    it('should return unknown when multiple conflicting types are specified', () => {
      expect(toPrimitiveType(['string', 'number'])).toEqual(BuiltinTypes.UNKNOWN)
    })
  })
})
