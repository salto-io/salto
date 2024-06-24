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
import {
  ObjectType,
  isInstanceElement,
  InstanceElement,
} from '@salto-io/adapter-api'
import { makeArray } from '@salto-io/lowerdash/src/collections/array'
import {
  INSTALLED_PACKAGE_METADATA,
  INSTANCE_FULL_NAME_FIELD,
} from '../src/constants'
import mockClient from './client'
import { fetchMetadataInstances } from '../src/fetch'
import { buildMetadataQuery } from '../src/fetch_profile/metadata_query'
import { mockFileProperties, MockFilePropertiesInput } from './connection'
import { mockTypes } from './mock_elements'

describe('Test fetching installed package metadata', () => {
  type MockFetchArgs = {
    fileProp: MockFilePropertiesInput
    mockType: ObjectType
    addNamespacePrefixToFullName?: boolean
  }

  const fetch = async ({
    fileProp,
    mockType,
    addNamespacePrefixToFullName = true,
  }: MockFetchArgs): Promise<InstanceElement | undefined> => {
    const { client, connection } = mockClient()
    connection.metadata.read.mockImplementation(async (_type, fullNames) =>
      makeArray(fullNames).map((fullName) => ({ fullName })),
    )

    const metadataQuery = buildMetadataQuery({
      fetchParams: { metadata: { include: [{ metadataType: '.*' }] } },
    })

    const { elements } = await fetchMetadataInstances({
      client,
      fileProps: [mockFileProperties(fileProp)],
      metadataType: mockType,
      metadataQuery,
      addNamespacePrefixToFullName,
    })
    return elements.filter(isInstanceElement)[0]
  }

  describe('when fetching PermissionSets of installed packages', () => {
    describe('API name includes namespacePrefix', () => {
      it('should not add prefix to PermissionSet', async () => {
        const fullNameFromList = 'Test__TestPermissionSet'
        const fileProp = mockFileProperties({
          fullName: fullNameFromList,
          type: 'PermissionSet',
          namespacePrefix: 'Test',
        })
        const instance = await fetch({
          fileProp,
          mockType: mockTypes.PermissionSet,
        })

        expect(instance).toEqual(
          expect.objectContaining({
            value: expect.objectContaining({
              [INSTANCE_FULL_NAME_FIELD]: fullNameFromList,
            }),
          }),
        )
      })
    })
    describe('API name does not include namespacePrefix', () => {
      describe('addNamespacePrefixToFullName is false', () => {
        it('should not add prefix to PermissionSet', async () => {
          const fullNameFromList = 'TestPermissionSet'
          const addNamespacePrefixToFullName = false
          const fileProp = mockFileProperties({
            fullName: fullNameFromList,
            type: 'PermissionSet',
            namespacePrefix: 'Test',
          })
          const instance = await fetch({
            fileProp,
            mockType: mockTypes.PermissionSet,
            addNamespacePrefixToFullName,
          })

          expect(instance).toEqual(
            expect.objectContaining({
              value: expect.objectContaining({
                [INSTANCE_FULL_NAME_FIELD]: fullNameFromList,
              }),
            }),
          )
        })
      })
      describe('name has API_NAME_SEPARATOR in its fullName', () => {
        it("should add prefix to the object's name correctly", async () => {
          const fullNameFromList = 'Account.TestObject'
          const expectedFullName = 'Account.Test__TestObject'
          const fileProp = mockFileProperties({
            fullName: fullNameFromList,
            type: 'Account',
            namespacePrefix: 'Test',
          })
          const instance = await fetch({
            fileProp,
            mockType: mockTypes.Account,
          })

          expect(instance).toEqual(
            expect.objectContaining({
              value: expect.objectContaining({
                [INSTANCE_FULL_NAME_FIELD]: expectedFullName,
              }),
            }),
          )
        })
      })
      describe('name does not have API_NAME_SEPARATOR in its fullName', () => {
        it("should add prefix to the PermissionSet's name", async () => {
          const fullNameFromList = 'TestPermissionSet'
          const expectedFullName = 'Test__TestPermissionSet'
          const fileProp = mockFileProperties({
            fullName: fullNameFromList,
            type: 'PermissionSet',
            namespacePrefix: 'Test',
          })
          const instance = await fetch({
            fileProp,
            mockType: mockTypes.PermissionSet,
          })

          expect(instance).toEqual(
            expect.objectContaining({
              value: expect.objectContaining({
                [INSTANCE_FULL_NAME_FIELD]: expectedFullName,
              }),
            }),
          )
        })
      })
    })
  })
  describe('when fetching instances of installed packages', () => {
    it('should return the name of the managed package without any changes', async () => {
      const fullNameFromList = 'TestNamespace'
      const fileProp = mockFileProperties({
        fullName: fullNameFromList,
        type: INSTALLED_PACKAGE_METADATA,
      })
      const instance = await fetch({
        fileProp,
        mockType: mockTypes.PermissionSet,
      })

      expect(instance).toEqual(
        expect.objectContaining({
          value: expect.objectContaining({
            [INSTANCE_FULL_NAME_FIELD]: fullNameFromList,
          }),
        }),
      )
    })
  })
  describe('Test fetching layouts of installed packages', () => {
    describe('if the API name already includes namespacePrefix', () => {
      describe('if layout name does not include prefix', () => {
        it('should add prefix to layout name', async () => {
          const objectName = 'SBQQ__TestApiName__c'
          const fullNameFromList = `${objectName}-Test Layout`
          const expectedFullName = `${objectName}-SBQQ__Test Layout`
          const fileProp = mockFileProperties({
            fullName: fullNameFromList,
            type: 'Layout',
            namespacePrefix: 'SBQQ',
          })
          const instance = await fetch({ fileProp, mockType: mockTypes.Layout })

          expect(instance).toBeDefined()
          expect(instance?.value).toHaveProperty('fullName', expectedFullName)
        })
      })
      describe('if layout name already includes prefix', () => {
        it('should not add prefix to layout name', async () => {
          const objectName = 'SBQQ__TestApiName__c'
          const fullNameFromList = `${objectName}-SBQQ__Test Layout`
          const expectedFullName = `${objectName}-SBQQ__Test Layout`
          const fileProp = mockFileProperties({
            fullName: fullNameFromList,
            type: 'Layout',
            namespacePrefix: 'SBQQ',
          })
          const instance = await fetch({ fileProp, mockType: mockTypes.Layout })

          expect(instance).toBeDefined()
          expect(instance?.value).toHaveProperty('fullName', expectedFullName)
        })
      })
    })
    describe('if the API name does not include namespacePrefix', () => {
      describe('if layout  name does not include prefix', () => {
        it("should add prefix to the layout's name", async () => {
          const objectName = 'TestApiName__c'
          const fullNameFromList = `${objectName}-Test Layout`
          const expectedFullName = `${objectName}-SBQQ__Test Layout`
          const fileProp = mockFileProperties({
            fullName: fullNameFromList,
            type: 'Layout',
            namespacePrefix: 'SBQQ',
          })
          const instance = await fetch({ fileProp, mockType: mockTypes.Layout })

          expect(instance).toBeDefined()
          expect(instance?.value).toHaveProperty('fullName', expectedFullName)
        })
      })
      describe('if layout name already includes namespacePrefix', () => {
        it("should not add prefix to the layout's name", async () => {
          const objectName = 'TestApiName__c'
          const fullNameFromList = `${objectName}-SBQQ__Test Layout`
          const expectedFullName = `${objectName}-SBQQ__Test Layout`
          const fileProp = mockFileProperties({
            fullName: fullNameFromList,
            type: 'Layout',
            namespacePrefix: 'SBQQ',
          })
          const instance = await fetch({ fileProp, mockType: mockTypes.Layout })

          expect(instance).toBeDefined()
          expect(instance?.value).toHaveProperty('fullName', expectedFullName)
        })
      })
    })
  })
})
