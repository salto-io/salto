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
import { CORE_ANNOTATIONS, Element, InstanceElement } from '@salto-io/adapter-api'
import { FileProperties } from 'jsforce-types'
import { collections } from '@salto-io/lowerdash'
import filterCreator from '../../src/filters/create_missing_installed_packages_instances'
import { FilterWith } from '../../src/filter'
import { SalesforceClient } from '../../index'
import mockAdapter from '../adapter'
import { defaultFilterContext } from '../utils'
import * as fetchModule from '../../src/fetch'
import { mockTypes } from '../mock_elements'
import { apiName, createInstanceElement } from '../../src/transformers/transformer'
import { INSTALLED_PACKAGE_METADATA, INSTANCE_FULL_NAME_FIELD, RECORDS_PATH, SALESFORCE } from '../../src/constants'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'

const { awu } = collections.asynciterable

describe('createMissingInstalledPackagesInstancesFilter', () => {
  let client: SalesforceClient
  let filter: FilterWith<'onFetch'>

  beforeEach(() => {
    client = mockAdapter().client
    filter = filterCreator({ client, config: defaultFilterContext }) as FilterWith<'onFetch'>
  })
  describe('onFetch', () => {
    const EXISTING_NAMESPACES = ['namespace1', 'namespace2']

    let listMetadataObjectsSpy: jest.SpyInstance
    let beforeElements: Element[]
    let afterElements: Element[]

    const createInstalledPackageFileProperties = (namespace: string): FileProperties => ({
      createdById: '0058d0000059MEVAA2',
      createdByName: 'Test User',
      createdDate: '2023-02-14T16:58:37.000Z',
      fileName: `installedPackages/${namespace}.installedPackage`,
      fullName: namespace,
      id: '0A38d000000kaRoCAI',
      lastModifiedById: '0058d0000059MEVAA2',
      lastModifiedByName: 'Test User',
      lastModifiedDate: '2023-02-14T16:58:38.000Z',
      namespacePrefix: namespace,
      type: 'InstalledPackage',
    })

    const createInstalledPackageInstance = (namespace: string): InstanceElement => (
      createInstanceElement(
        {
          [INSTANCE_FULL_NAME_FIELD]: namespace,
          version: '1.0.0',
        },
        mockTypes.InstalledPackage,
      )
    )


    beforeEach(() => {
      listMetadataObjectsSpy = jest.spyOn(fetchModule, 'listMetadataObjects')
      listMetadataObjectsSpy.mockResolvedValue({
        elements: EXISTING_NAMESPACES.map(createInstalledPackageFileProperties),
      })
      beforeElements = [
        mockTypes.InstalledPackage,
        ...EXISTING_NAMESPACES.map(createInstalledPackageInstance),
      ]
      afterElements = beforeElements.map(e => e.clone())
    })

    describe('when no InstalledPackage is missing', () => {
      beforeEach(async () => {
        await filter.onFetch(afterElements)
      })
      it('should not create any new instances', () => {
        expect(afterElements).toEqual(beforeElements)
      })
    })

    describe('when InstalledPackage is missing', () => {
      const MISSING_NAMESPACE = 'missingNamespace'
      beforeEach(async () => {
        listMetadataObjectsSpy.mockResolvedValue({
          elements: EXISTING_NAMESPACES
            .concat(MISSING_NAMESPACE)
            .map(createInstalledPackageFileProperties),
        })
      })
      describe('when the missing InstalledPackage is excluded from the fetch config', () => {
        beforeEach(async () => {
          const filterContext = {
            ...defaultFilterContext,
            fetchProfile: buildFetchProfile({
              metadata: {
                exclude: [
                  {
                    metadataType: 'InstalledPackage',
                    namespace: MISSING_NAMESPACE,
                  },
                ],
              },
            }),
          }
          filter = filterCreator({ client, config: filterContext }) as FilterWith<'onFetch'>
          await filter.onFetch(afterElements)
        })

        it('should not create any new instances', () => {
          expect(afterElements).toEqual(beforeElements)
        })
      })
      describe('when the missing InstalledPackage is not excluded from the fetch config', () => {
        beforeEach(async () => {
          await filter.onFetch(afterElements)
        })
        it('should create an InstalledPackage instance', async () => {
          expect(afterElements).not.toEqual(beforeElements)
          const missingNamespaceInstance = await awu(afterElements)
            .find(async e => await apiName(e) === MISSING_NAMESPACE)
          expect(missingNamespaceInstance).toEqual(expect.objectContaining({
            path: [SALESFORCE, RECORDS_PATH, INSTALLED_PACKAGE_METADATA, MISSING_NAMESPACE],
            value: {
              [INSTANCE_FULL_NAME_FIELD]: MISSING_NAMESPACE,
            },
            // Validates author information
            annotations: {
              [CORE_ANNOTATIONS.CHANGED_AT]: expect.toBeString(),
              [CORE_ANNOTATIONS.CHANGED_BY]: expect.toBeString(),
              [CORE_ANNOTATIONS.CREATED_AT]: expect.toBeString(),
              [CORE_ANNOTATIONS.CREATED_BY]: expect.toBeString(),
            },
          }))
        })
      })
    })
  })
})
