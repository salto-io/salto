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
import _ from 'lodash'
import { CORE_ANNOTATIONS, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { OpenAPIDefinition } from '../../../../src/definitions/system/sources'
import { generateOpenApiTypes } from '../../../../src/openapi/type_elements/type_elements'
import { queryWithDefault } from '../../../../src/definitions'
import { InstanceFetchApiDefinitions } from '../../../../src/definitions/system/fetch'

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

describe('generateOpenApiTypes', () => {
  const defQuery = queryWithDefault<InstanceFetchApiDefinitions, string>({
    customizations: {
      Pet: { element: { topLevel: { isTopLevel: true }, fieldCustomizations: { omitThis: { omit: true } } } },
    },
  })
  describe('V3 OpenAPI', () => {
    const expectedTypes = [
      'Address',
      'ApiResponse',
      'Category',
      'Food',
      'FoodAndCategory',
      'Order',
      'Pet',
      'Tag',
      'User',
      'FoodOrCategory',
      'FoodXorCategory',
      'Location',
      'UserAdditional1',
      'UserAdditional2',
    ]

    it.each([`${BASE_DIR}/petstore_openapi.v3.yaml`, `${BASE_DIR}/petstore_openapi.v3.json`])(
      'should generate types from all schemas',
      async url => {
        const createdTypes = await generateOpenApiTypes({ adapterName: ADAPTER_NAME, openApiDefs: { url }, defQuery })
        expect(Object.keys(createdTypes).sort()).toEqual(expectedTypes.sort())

        // regular response type with reference
        const pet = createdTypes.Pet as ObjectType
        expect(pet).toBeInstanceOf(ObjectType)
        expect(_.mapValues(pet.fields, f => f.refType.elemID.getFullName())).toEqual({
          category: 'myAdapter.Category',
          id: 'number',
          name: 'string',
          photoUrls: 'List<string>',
          status: 'string',
          tags: 'List<myAdapter.Tag>',
        })
        expect(pet.annotations[CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]).toEqual({
          refType: expect.any(ReferenceExpression),
        })
        expect(pet.path).toEqual([ADAPTER_NAME, 'Types', 'Pet'])

        // field with allOf
        const user = createdTypes.User as ObjectType
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
        })
        expect(user.path).toEqual([ADAPTER_NAME, 'Types', 'Subtypes', 'User', 'User'])

        const food = createdTypes.Food as ObjectType
        expect(food).toBeInstanceOf(ObjectType)
        expect(_.mapValues(food.fields, f => f.refType.elemID.getFullName())).toEqual({
          brand: 'string',
          id: 'number',
          storage: 'List<string>',
          additionalProperties: 'myAdapter.Category',
        })
        expect(food.annotations[CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]).toEqual({
          refType: expect.any(ReferenceExpression),
        })
        expect(food.path).toEqual([ADAPTER_NAME, 'Types', 'Subtypes', 'Food', 'Food'])

        const category = createdTypes.Category as ObjectType
        const foodOrCategory = createdTypes.FoodOrCategory as ObjectType
        expect(_.mapValues(foodOrCategory.fields, f => f.refType.elemID.name)).toEqual({
          ..._.mapValues(food.fields, f => f.refType.elemID.name),
          ..._.mapValues(category.fields, f => f.refType.elemID.name),
        })

        // oneOf
        const foodXorCategory = createdTypes.FoodXorCategory as ObjectType
        expect(_.mapValues(foodXorCategory.fields, f => f.refType.elemID.name)).toEqual({
          ..._.mapValues(food.fields, f => f.refType.elemID.name),
          ..._.mapValues(category.fields, f => f.refType.elemID.name),
        })

        const location = createdTypes.Location as ObjectType
        expect(location).toBeInstanceOf(ObjectType)
        expect(_.mapValues(location.fields, f => f.refType.elemID.name)).toEqual({
          name: 'string',
          // address is defined as anyOf combining primitive and object - should use unknown
          address: 'unknown',
        })
        expect(location.annotations[CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]).toEqual({
          refType: expect.any(ReferenceExpression),
        })
      },
    )
  })

  describe('V2 swagger', () => {
    const expectedTypes = [
      'ApiResponse',
      'Category',
      'Food',
      'FoodAndCategory',
      'Order',
      'Pet',
      'Tag',
      'User',
      'UserAdditional1',
      'UserAdditional2',
    ]

    it.each([`${BASE_DIR}/petstore_swagger.v2.json`])('should generate types from all schemas', async url => {
      const createdTypes = await generateOpenApiTypes({ adapterName: ADAPTER_NAME, openApiDefs: { url }, defQuery })
      expect(Object.keys(createdTypes).sort()).toEqual(expectedTypes.sort())

      // regular response type with reference
      const pet = createdTypes.Pet as ObjectType
      expect(pet).toBeInstanceOf(ObjectType)
      expect(_.mapValues(pet.fields, f => f.refType.elemID.getFullName())).toEqual({
        category: 'myAdapter.Category',
        id: 'number',
        name: 'string',
        photoUrls: 'List<string>',
        status: 'string',
        tags: 'List<myAdapter.Tag>',
      })
      expect(pet.annotations[CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]).toEqual({
        refType: expect.any(ReferenceExpression),
      })
      expect(pet.path).toEqual([ADAPTER_NAME, 'Types', 'Pet'])

      // field with allOf
      const user = createdTypes.User as ObjectType
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
      })
      expect(user.annotations[CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]).toEqual({
        refType: expect.any(ReferenceExpression),
      })
      expect(user.path).toEqual([ADAPTER_NAME, 'Types', 'Subtypes', 'User', 'User'])

      const food = createdTypes.Food as ObjectType
      expect(food).toBeInstanceOf(ObjectType)
      expect(_.mapValues(food.fields, f => f.refType.elemID.getFullName())).toEqual({
        brand: 'string',
        id: 'number',
        storage: 'List<string>',
        additionalProperties: 'myAdapter.Category',
      })
      expect(food.path).toEqual([ADAPTER_NAME, 'Types', 'Subtypes', 'Food', 'Food'])
    })
  })

  describe('with type adjustments', () => {
    it('should clone types based on definitions', async () => {
      const openApiDefs: Omit<OpenAPIDefinition<never>, 'toClient'> = {
        url: `${BASE_DIR}/petstore_openapi.v3.yaml`,
        typeAdjustments: {
          ClonedPet: { originalTypeName: 'Pet', rename: false },
          AnotherPet: { originalTypeName: 'Pet', rename: false },
        },
      }
      const createdTypes = await generateOpenApiTypes({ adapterName: ADAPTER_NAME, openApiDefs, defQuery })
      const expectedPetFields = {
        category: 'myAdapter.Category',
        id: 'number',
        name: 'string',
        photoUrls: 'List<string>',
        status: 'string',
        tags: 'List<myAdapter.Tag>',
      }

      const pet = createdTypes.Pet as ObjectType
      expect(pet).toBeInstanceOf(ObjectType)
      expect(_.mapValues(pet.fields, f => f.refType.elemID.getFullName())).toEqual(expectedPetFields)

      const clonedPet = createdTypes.ClonedPet as ObjectType
      expect(clonedPet).toBeInstanceOf(ObjectType)
      expect(_.mapValues(clonedPet.fields, f => f.refType.elemID.getFullName())).toEqual(expectedPetFields)

      const anotherPet = createdTypes.AnotherPet as ObjectType
      expect(anotherPet).toBeInstanceOf(ObjectType)
      expect(_.mapValues(anotherPet.fields, f => f.refType.elemID.getFullName())).toEqual(expectedPetFields)
    })

    it('should rename types based on definitions', async () => {
      const openApiDefs: Omit<OpenAPIDefinition<never>, 'toClient'> = {
        url: `${BASE_DIR}/petstore_openapi.v3.yaml`,
        typeAdjustments: {
          RenamedPet: { originalTypeName: 'Pet', rename: true },
        },
      }
      const createdTypes = await generateOpenApiTypes({ adapterName: ADAPTER_NAME, openApiDefs, defQuery })
      expect(createdTypes.Pet).toBeUndefined()
      const renamedPet = createdTypes.RenamedPet as ObjectType
      expect(renamedPet).toBeInstanceOf(ObjectType)
      expect(_.mapValues(renamedPet.fields, f => f.refType.elemID.getFullName())).toEqual({
        category: 'myAdapter.Category',
        id: 'number',
        name: 'string',
        photoUrls: 'List<string>',
        status: 'string',
        tags: 'List<myAdapter.Tag>',
      })
      expect(renamedPet.annotations[CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]).toEqual({
        refType: expect.any(ReferenceExpression),
      })
    })

    it('should throw same type is both cloned and renamed', async () => {
      const openApiDefs: Omit<OpenAPIDefinition<never>, 'toClient'> = {
        url: `${BASE_DIR}/petstore_openapi.v3.yaml`,
        typeAdjustments: {
          ClonedPet: { originalTypeName: 'Pet', rename: false },
          AnotherPet: { originalTypeName: 'Pet', rename: true },
        },
      }
      await expect(() => generateOpenApiTypes({ adapterName: ADAPTER_NAME, openApiDefs, defQuery })).rejects.toThrow(
        new Error('type Pet cannot be both renamed and cloned'),
      )
    })
  })

  describe('invalid versions', () => {
    it('should fail on invalid swagger version (v2)', async () => {
      await expect(() =>
        generateOpenApiTypes({
          adapterName: ADAPTER_NAME,
          openApiDefs: { url: `${BASE_DIR}/invalid_swagger.yaml` },
          defQuery,
        }),
      ).rejects.toThrow(new Error('Unrecognized Swagger version: 1.0. Expected 2.0'))
    })
    it('should fail on invalid swagger version (v3)', async () => {
      await expect(() =>
        generateOpenApiTypes({
          adapterName: ADAPTER_NAME,
          openApiDefs: { url: `${BASE_DIR}/invalid_openapi.yaml` },
          defQuery,
        }),
      ).rejects.toThrow(
        new Error(
          'Unsupported OpenAPI version: 4.0.1. Swagger Parser only supports versions 3.0.0, 3.0.1, 3.0.2, 3.0.3',
        ),
      )
    })
  })
})
