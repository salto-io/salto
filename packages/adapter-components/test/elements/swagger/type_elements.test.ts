
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
import { ObjectType, ElemID, ListType } from '@salto-io/adapter-api'
import { generateTypes } from '../../../src/elements/swagger'

const ADAPTER_NAME = 'myAdapter'
const BASE_DIR = __dirname.replace('/dist', '')

// TODO check all variants, add special cases

describe('swagger_type_elements', () => {
  describe('generateTypes', () => {
    // TODO add full elements
    const expectedTypes = ['Category', 'Order', 'Pet', 'Tag', 'User', 'pet__findByStatus', 'pet__findByTags', 'store__inventory']
    const expectedParsedConfigs = {
      Order: { request: { url: '/store/order/{orderId}' } },
      Pet: { request: { url: '/pet/{petId}' } },
      // eslint-disable-next-line @typescript-eslint/camelcase
      pet__findByStatus: { request: { url: '/pet/findByStatus' } },
      // eslint-disable-next-line @typescript-eslint/camelcase
      pet__findByTags: { request: { url: '/pet/findByTags' } },
      // eslint-disable-next-line @typescript-eslint/camelcase
      store__inventory: { request: { url: '/store/inventory' } },
      User: { request: { url: '/user/{username}' } },
    }

    describe('no config overrides', () => {
      it('should generate the right types for swagger v2 yaml', async () => {
        const { allTypes, parsedConfigs } = await generateTypes(
          ADAPTER_NAME,
          {
            swagger: { url: `${BASE_DIR}/petstore_swagger.v2.yaml` },
            typeDefaults: { transformation: { idFields: ['name'] } },
            types: {},
          }
        )
        expect(Object.keys(allTypes).sort()).toEqual(expectedTypes)
        expect(parsedConfigs).toEqual(expectedParsedConfigs)
        // regular response type with reference
        const pet = allTypes.Pet
        expect(Object.keys((pet as ObjectType).fields).sort()).toEqual(['category', 'id', 'name', 'photoUrls', 'status', 'tags'])

        // array response type
        const petArray = allTypes.pet__findByStatus
        expect(petArray).toEqual(new ObjectType({
          elemID: new ElemID(ADAPTER_NAME, 'pet__findByStatus'),
          fields: {
            items: { type: new ListType(pet) },
          },
          path: [ADAPTER_NAME, 'Types', 'pet__findByStatus'],
        }))
      })
      it('should generate the right types for swagger v2 json', async () => {
        const { allTypes, parsedConfigs } = await generateTypes(
          ADAPTER_NAME,
          {
            swagger: { url: `${BASE_DIR}/petstore_swagger.v2.json` },
            typeDefaults: { transformation: { idFields: ['name'] } },
            types: {},
          }
        )
        expect(Object.keys(allTypes).sort()).toEqual(expectedTypes)
        expect(parsedConfigs).toEqual(expectedParsedConfigs)
      })
      it('should generate the right types for swagger v3 yaml', async () => {
        const { allTypes, parsedConfigs } = await generateTypes(
          ADAPTER_NAME,
          {
            swagger: { url: `${BASE_DIR}/petstore_openapi.v3.yaml` },
            typeDefaults: { transformation: { idFields: ['name'] } },
            types: {},
          }
        )
        expect(Object.keys(allTypes).sort()).toEqual(expectedTypes)
        expect(parsedConfigs).toEqual(expectedParsedConfigs)
      })
      it('should generate the right types for swagger v3 json', async () => {
        const { allTypes, parsedConfigs } = await generateTypes(
          ADAPTER_NAME,
          {
            swagger: { url: `${BASE_DIR}/petstore_openapi.v3.json` },
            typeDefaults: { transformation: { idFields: ['name'] } },
            types: {},
          }
        )
        expect(Object.keys(allTypes).sort()).toEqual(expectedTypes)
        expect(parsedConfigs).toEqual(expectedParsedConfigs)
      })
    })
    // TODO continue, override config, check with sample allOf and recursion
  })
})
