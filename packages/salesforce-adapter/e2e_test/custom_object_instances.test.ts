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
import {
  Element,
  isObjectType,
  InstanceElement,
  ObjectType,
} from '@salto-io/adapter-api'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { SalesforceRecord } from '../src/client/types'
import SalesforceAdapter from '../index'
import realAdapter from './adapter'
import SalesforceClient from '../src/client/client'
import { UsernamePasswordCredentials } from '../src/types'
import {
  runFiltersOnFetch,
  createElement,
  removeElementAndVerify,
  createInstance,
  getRecordOfInstance,
  fetchTypes,
  getMetadataInstance,
  removeElement,
  removeElementIfAlreadyExists,
  nullProgressReporter,
} from './utils'
import {
  apiName,
  isInstanceOfCustomObject,
} from '../src/transformers/transformer'
import customObjectsFromDescribeFilter from '../src/filters/custom_objects_from_soap_describe'
import customObjectsToObjectTypeFilter from '../src/filters/custom_objects_to_object_type'
import customObjectsInstancesFilter from '../src/filters/custom_objects_instances'
import { createCustomSettingsObject } from '../test/utils'
import { CUSTOM_OBJECT, LIST_CUSTOM_SETTINGS_TYPE } from '../src/constants'
import { buildFetchProfile } from '../src/fetch_profile/fetch_profile'
import { testHelpers } from './jest_environment'

const { awu } = collections.asynciterable
const log = logger(module)

/* eslint-disable camelcase */
describe('custom object instances e2e', () => {
  // Set long timeout as we communicate with salesforce API
  jest.setTimeout(1000000)

  const productTwoMetadataName = 'Product2'

  const productTwoInstanceValue = {
    Name: 'TestProductName',
    ProductCode: 'GC198',
    IsActive: true,
    IsArchived: false,
    SBQQ__Component__c: false,
    SBQQ__CostEditable__c: false,
    SBQQ__CustomConfigurationRequired__c: false,
    SBQQ__DescriptionLocked__c: false,
    SBQQ__EnableLargeConfiguration__c: false,
    SBQQ__ExcludeFromMaintenance__c: false,
    SBQQ__ExcludeFromOpportunity__c: false,
    SBQQ__ExternallyConfigurable__c: false,
    SBQQ__HasConfigurationAttributes__c: false,
    SBQQ__HasConsumptionSchedule__c: false,
    SBQQ__Hidden__c: false,
    SBQQ__HidePriceInSearchResults__c: false,
    SBQQ__IncludeInMaintenance__c: false,
    SBQQ__NewQuoteGroup__c: false,
    SBQQ__NonDiscountable__c: false,
    SBQQ__NonPartnerDiscountable__c: false,
    SBQQ__Optional__c: false,
    SBQQ__PriceEditable__c: false,
    SBQQ__PricingMethodEditable__c: false,
    SBQQ__QuantityEditable__c: true,
    SBQQ__ReconfigurationDisabled__c: false,
    SBQQ__Taxable__c: false,
    fullName: 'TestProductName',
  }

  let client: SalesforceClient
  let adapter: SalesforceAdapter
  let elements: Element[]
  let credLease: CredsLease<UsernamePasswordCredentials>

  const config = {
    fetch: {
      data: {
        includeObjects: [productTwoMetadataName],
        saltoIDSettings: {
          defaultIdFields: ['Id'],
        },
      },
    },
  }

  const filtersContext = {
    fetchProfile: buildFetchProfile({
      fetchParams: config.fetch,
    }),
  }
  beforeAll(async () => {
    log.resetLogCount()
    credLease = await testHelpers().credentials()
    const adapterParams = realAdapter(
      {
        credentials: new UsernamePasswordCredentials(credLease.value),
      },
      config,
    )
    adapter = adapterParams.adapter
    client = adapterParams.client

    const types = await fetchTypes(client, [CUSTOM_OBJECT])
    const instance = await getMetadataInstance(
      client,
      types[0],
      productTwoMetadataName,
    )
    if (instance === undefined) {
      throw new Error(`Failed getting ${productTwoMetadataName} instance`)
    }
    elements = [instance]

    await runFiltersOnFetch(client, filtersContext, elements, [
      customObjectsFromDescribeFilter,
      customObjectsToObjectTypeFilter,
      customObjectsInstancesFilter,
    ])
  })

  it('should fetch custom object instances', async () => {
    const customObjectInstances = await awu(elements)
      .filter(isInstanceOfCustomObject)
      .toArray()
    expect(customObjectInstances.length).toBeGreaterThanOrEqual(1)
  })

  describe('custom settings manipulations', () => {
    let createdInstance: InstanceElement
    let createdElement: ObjectType

    describe('should create new instances', () => {
      it('should create new instances', async () => {
        const settingsType = createCustomSettingsObject(
          'customsetting__c',
          LIST_CUSTOM_SETTINGS_TYPE,
        )
        createdElement = await createElement(adapter, settingsType)
        createdInstance = await createElement(
          adapter,
          createInstance({
            value: {
              Name: 'TestName1',
              fullName: 'customsetting TestName1',
              TestField__c: 'somevalue',
            },
            type: createdElement,
          }),
        )
        const result = await getRecordOfInstance(
          client,
          createdInstance,
          ['TestField__c'],
          'Name',
        )
        expect(result).toBeDefined()
        expect((result as SalesforceRecord).TestField).toEqual(
          createdInstance.value.TestField,
        )
        expect((result as SalesforceRecord).Name).toEqual(
          createdInstance.value.Name,
        )
      })
    })
    describe('should delete custom object setting', () => {
      it('should delete custom object setting', async () => {
        await removeElementAndVerify(adapter, client, createdInstance)
        await removeElementAndVerify(adapter, client, createdElement)
      })
    })
  })

  describe('custom object instances manipulations', () => {
    let createdInstance: InstanceElement

    describe('should create the new instance', () => {
      it('should create the new instance', async () => {
        const productTwoObjectType = await awu(elements).find(
          async (e) =>
            isObjectType(e) &&
            (await apiName(e, true)) === productTwoMetadataName,
        )
        expect(productTwoObjectType).toBeDefined()
        expect(isObjectType(productTwoObjectType)).toBeTruthy()
        const instance = createInstance({
          value: productTwoInstanceValue,
          type: productTwoObjectType as ObjectType,
        })
        createdInstance = await createElement(adapter, instance)
        const result = await getRecordOfInstance(client, createdInstance)
        expect(result).toBeDefined()
        expect((result as SalesforceRecord).Id).toEqual(
          createdInstance.value.Id,
        )
      })
    })

    describe('should update values of a custom object instance', () => {
      it('should update values of a custom object instance', async () => {
        const updatedInstance = createdInstance.clone()
        updatedInstance.value.isActive = false
        updatedInstance.value.ProductCode = 'newCode'
        await adapter.deploy({
          changeGroup: {
            groupID: updatedInstance.elemID.getFullName(),
            changes: [
              {
                action: 'modify',
                data: { before: createdInstance, after: updatedInstance },
              },
            ],
          },
          progressReporter: nullProgressReporter,
        })
        const fields = ['IsActive', 'ProductCode', 'IsArchived']
        const result = await getRecordOfInstance(
          client,
          createdInstance,
          fields,
        )
        expect(result).toBeDefined()
        expect(result).toMatchObject(_.pick(updatedInstance.value, fields))
      })
    })
    describe('should delete custom object instance', () => {
      it('should delete custom object instance', async () => {
        await removeElementAndVerify(adapter, client, createdInstance)
      })

      it('should not fail for a non-existing instance', async () => {
        const productTwoObjectType = await awu(elements).find(
          async (e) =>
            isObjectType(e) &&
            (await apiName(e, true)) === productTwoMetadataName,
        )
        const element = await createElement(
          adapter,
          createInstance({
            value: productTwoInstanceValue,
            type: productTwoObjectType as ObjectType,
          }),
        )
        await removeElementIfAlreadyExists(client, element)

        const result = await removeElement(adapter, element)
        expect(result).toBeDefined()
        expect(result).toMatchObject({ errors: [] })
      })
    })
  })

  afterAll(async () => {
    if (credLease.return) {
      await credLease.return()
    }
    log.info('custom object instances e2e: Log counts = %o', log.getLogCount())
  })
})
