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
import {
  Element, isObjectType, InstanceElement, ObjectType,
} from '@salto-io/adapter-api'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import { collections } from '@salto-io/lowerdash'
import { SalesforceRecord } from '../src/client/types'
import SalesforceAdapter from '../index'
import realAdapter from './adapter'
import SalesforceClient from '../src/client/client'
import { UsernamePasswordCredentials } from '../src/types'
import { runFiltersOnFetch, createElement, removeElementAndVerify, createInstance, getRecordOfInstance, fetchTypes, getMetadataInstance, removeElement, removeElementIfAlreadyExists } from './utils'
import { apiName, isInstanceOfCustomObject } from '../src/transformers/transformer'
import customObjectsFromDescribeFilter from '../src/filters/custom_objects_from_soap_describe'
import customObjectsToObjectTypeFilter from '../src/filters/custom_objects_to_object_type'
import customObjectsInstancesFilter from '../src/filters/custom_objects_instances'
import { createCustomSettingsObject } from '../test/utils'
import {
  CUSTOM_OBJECT,
  LIST_CUSTOM_SETTINGS_TYPE,
  OWNER_ID,
} from '../src/constants'
import { buildFetchProfile } from '../src/fetch_profile/fetch_profile'
import { testHelpers } from './jest_environment'

const { awu } = collections.asynciterable

/* eslint-disable camelcase */
describe('custom object instances e2e', () => {
  // Set long timeout as we communicate with salesforce API
  jest.setTimeout(1000000)

  const productTwoMetadataName = 'Product2'
  const accountMetadataName = 'Account'

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

  const accountInstanceValue = {
    AccountNumber: '12345',
    Name: 'Test Account',
    fullName: 'TestAccount',
    // TODO OwnerId
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
    fetchProfile: buildFetchProfile(config.fetch),
  }
  beforeAll(async () => {
    credLease = await testHelpers().credentials()
    const adapterParams = realAdapter({
      credentials: new UsernamePasswordCredentials(credLease.value),
    }, config)
    adapter = adapterParams.adapter
    client = adapterParams.client

    const types = await fetchTypes(client, [CUSTOM_OBJECT])
    const product2Instance = await getMetadataInstance(client, types[0], productTwoMetadataName)
    if (product2Instance === undefined) {
      throw new Error(`Failed getting ${productTwoMetadataName} instance`)
    }
    const accountInstance = await getMetadataInstance(client, types[0], accountMetadataName)
    if (accountInstance === undefined) {
      throw new Error(`Failed getting ${accountMetadataName} instance`)
    }
    elements = [product2Instance, accountInstance]

    await runFiltersOnFetch(
      client,
      filtersContext,
      elements,
      [
        customObjectsFromDescribeFilter,
        customObjectsToObjectTypeFilter,
        customObjectsInstancesFilter,
      ],
    )
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
        const settingsType = createCustomSettingsObject('customsetting__c', LIST_CUSTOM_SETTINGS_TYPE)
        createdElement = await createElement(adapter, settingsType)
        createdInstance = await createElement(adapter, createInstance({
          value: {
            Name: 'TestName1',
            fullName: 'customsetting TestName1',
            TestField__c: 'somevalue',
          },
          type: createdElement,
        }))
        const result = await getRecordOfInstance(client, createdInstance, ['TestField__c'], 'Name')
        expect(result).toBeDefined()
        expect((result as SalesforceRecord).TestField).toEqual(createdInstance.value.TestField)
        expect((result as SalesforceRecord).Name).toEqual(createdInstance.value.Name)
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
    let createdProduct2Instance: InstanceElement
    let createdAccountInstance: InstanceElement

    describe('should create the new instance', () => {
      it('should create the new instance', async () => {
        const productTwoObjectType = await awu(elements)
          .find(async e => isObjectType(e) && (await apiName(e, true) === productTwoMetadataName))
        expect(productTwoObjectType).toBeDefined()
        expect(isObjectType(productTwoObjectType)).toBeTruthy()
        const instance = createInstance({
          value: productTwoInstanceValue,
          type: productTwoObjectType as ObjectType,
        })
        createdProduct2Instance = await createElement(
          adapter,
          instance,
        )
        const result = await getRecordOfInstance(client, createdProduct2Instance)
        expect(result).toBeDefined()
        expect((result as SalesforceRecord).Id).toEqual(createdProduct2Instance.value.Id)
      })
    })

    describe('instances with OwnerId', () => {
      it('should create the new instance', async () => {
        const accountObjectType = await awu(elements)
          .find(async e => isObjectType(e) && (await apiName(e, true) === accountMetadataName))
        expect(accountObjectType).toBeDefined()
        expect(isObjectType(accountObjectType)).toBeTruthy()
        expect((accountObjectType as ObjectType).fields).toHaveProperty(OWNER_ID)
        const instance = createInstance({
          value: accountInstanceValue,
          type: accountObjectType as ObjectType,
        })
        createdAccountInstance = await createElement(
          adapter,
          instance,
        )
        const result = await getRecordOfInstance(client, createdAccountInstance, ['OwnerId'])
        expect(result).toBeDefined()
        expect((result as SalesforceRecord).Id).toEqual(createdAccountInstance.value.Id)
        expect(result).toHaveProperty('OwnerId')
        expect((result as SalesforceRecord).OwnerId).not.toBeEmpty()
      })
      it('should update values of a custom object instance', async () => {
        const updatedInstance = createdAccountInstance.clone()
        updatedInstance.value.AccountNumber = '5678'
        updatedInstance.value.OwnerId = null
        const deployResult = await adapter.deploy({
          changeGroup: {
            groupID: updatedInstance.elemID.getFullName(),
            changes: [{ action: 'modify', data: { before: createdAccountInstance, after: updatedInstance } }],
          },
        })
        expect(deployResult.errors).toBeEmpty()
        const fields = ['AccountNumber']
        const result = await getRecordOfInstance(client, createdAccountInstance, fields)
        expect(result).toBeDefined()
        expect(result).toMatchObject(_.pick(updatedInstance.value, fields))
      })
    })
    describe('should update values of a custom object instance', () => {
      it('should update values of a custom object instance', async () => {
        const updatedInstance = createdProduct2Instance.clone()
        updatedInstance.value.isActive = false
        updatedInstance.value.ProductCode = 'newCode'
        await adapter.deploy({
          changeGroup: {
            groupID: updatedInstance.elemID.getFullName(),
            changes: [{ action: 'modify', data: { before: createdProduct2Instance, after: updatedInstance } }],
          },
        })
        const fields = ['IsActive', 'ProductCode', 'IsArchived']
        const result = await getRecordOfInstance(client, createdProduct2Instance, fields)
        expect(result).toBeDefined()
        expect(result).toMatchObject(_.pick(updatedInstance.value, fields))
      })
    })

    describe('should delete custom object instance', () => {
      it('should delete custom object instance', async () => {
        await removeElementAndVerify(adapter, client, createdProduct2Instance)
        await removeElementAndVerify(adapter, client, createdAccountInstance)
      })

      it('should not fail for a non-existing instance', async () => {
        const productTwoObjectType = await awu(elements)
          .find(async e => isObjectType(e) && (await apiName(e, true) === productTwoMetadataName))
        const element = await createElement(adapter, createInstance({
          value: productTwoInstanceValue,
          type: productTwoObjectType as ObjectType,
        }))
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
  })
})
