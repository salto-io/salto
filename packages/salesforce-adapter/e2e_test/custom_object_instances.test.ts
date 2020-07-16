/*
*                      Copyright 2020 Salto Labs Ltd.
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
  Element, isInstanceElement, isObjectType, ObjectType, InstanceElement,
} from '@salto-io/adapter-api'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import { SalesforceRecord } from '../src/client/types'
import SalesforceAdapter, { testHelpers } from '../index'
import realAdapter from './adapter'
import SalesforceClient, { Credentials } from '../src/client/client'
import { runFiltersOnFetch, createElement, removeElementAndVerify, createInstance, getRecordOfInstance } from './utils'
import { isCustomObject, apiName } from '../src/transformers/transformer'
import customObjectsFilter from '../src/filters/custom_objects'
import customObjectsInstancesFilter from '../src/filters/custom_objects_instances'

/* eslint-disable @typescript-eslint/camelcase */
describe('custom object instances e2e', () => {
  // Set long timeout as we communicate with salesforce API
  jest.setTimeout(1000000)

  const productTwoMetadataName = 'Product2'

  let client: SalesforceClient
  let adapter: SalesforceAdapter
  let elements: Element[]
  let credLease: CredsLease<Credentials>

  const filtersContext = {
    dataManagement: [
      {
        name: 'testDataManagementConfig',
        enabled: true,
        isNameBasedID: false,
        includeObjects: [productTwoMetadataName],
      },
    ],
  }
  beforeAll(async () => {
    credLease = await testHelpers().credentials()
    const adapterParams = realAdapter({ credentials: credLease.value }, filtersContext)
    adapter = adapterParams.adapter
    client = adapterParams.client

    elements = []
    await runFiltersOnFetch(
      client,
      filtersContext,
      elements,
      [customObjectsFilter, customObjectsInstancesFilter],
    )
  })

  it('should fetch custom object instances', () => {
    const customObjectInstances = elements
      .filter(isInstanceElement)
      .filter(e => isCustomObject(e.type))
    expect(customObjectInstances.length).toBeGreaterThanOrEqual(1)
  })

  describe('custom object instances manipulations', () => {
    let createdInstance: InstanceElement

    it('should create the new instance', async () => {
      const productTwoObjectType = elements
        .find(e => isObjectType(e) && (apiName(e, true) === productTwoMetadataName))
      expect(productTwoObjectType).toBeDefined()
      expect(isObjectType(productTwoObjectType)).toBeTruthy()
      const values = {
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
      const instance = await createInstance(client, values, productTwoObjectType as ObjectType)
      createdInstance = await createElement(
        adapter,
        instance,
      )
      const result = await getRecordOfInstance(client, createdInstance)
      expect(result).toBeDefined()
      expect((result as SalesforceRecord).Id).toEqual(createdInstance.value.Id)
    })

    it('should update values of a custom object instance', async () => {
      const updatedInstance = createdInstance.clone()
      updatedInstance.value.isActive = false
      updatedInstance.value.ProductCode = 'newCode'
      await adapter.deploy({
        groupID: updatedInstance.elemID.getFullName(),
        changes: [{ action: 'modify', data: { before: createdInstance, after: updatedInstance } }],
      })
      const fields = ['IsActive', 'ProductCode', 'IsArchived']
      const result = await getRecordOfInstance(client, createdInstance, fields)
      expect(result).toBeDefined()
      expect(result).toMatchObject(_.pick(updatedInstance.value, fields))
    })

    it('should delete custom object instance', async () => {
      await removeElementAndVerify(adapter, client, createdInstance)
    })
  })

  afterAll(async () => {
    if (credLease.return) {
      await credLease.return()
    }
  })
})
