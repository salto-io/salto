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
import _ from 'lodash'
import {
  Element, isObjectType, InstanceElement, ObjectType,
} from '@salto-io/adapter-api'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import { SalesforceRecord } from '../src/client/types'
import SalesforceAdapter, { testHelpers } from '../index'
import realAdapter from './adapter'
import SalesforceClient from '../src/client/client'
import { UsernamePasswordCredentials } from '../src/types'
import { runFiltersOnFetch, createElement, removeElementAndVerify, createInstance, getRecordOfInstance, fetchTypes, getMetadataInstance } from './utils'
import { apiName, isInstanceOfCustomObject } from '../src/transformers/transformer'
import customObjectsFilter from '../src/filters/custom_objects'
import customObjectsInstancesFilter from '../src/filters/custom_objects_instances'
import { createCustomSettingsObject } from '../test/utils'
import { CUSTOM_OBJECT, LIST_CUSTOM_SETTINGS_TYPE } from '../src/constants'
import { buildFetchProfile } from '../src/fetch_profile/fetch_profile'

/* eslint-disable @typescript-eslint/camelcase */
describe('custom object instances e2e', () => {
  // Set long timeout as we communicate with salesforce API
  jest.setTimeout(1000000)

  const productTwoMetadataName = 'Product2'

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
    const instance = await getMetadataInstance(client, types[0], productTwoMetadataName)
    if (instance === undefined) {
      throw new Error(`Failed getting ${productTwoMetadataName} instance`)
    }
    elements = [instance]

    await runFiltersOnFetch(
      client,
      filtersContext,
      elements,
      [customObjectsFilter, customObjectsInstancesFilter],
    )
  })

  it('should fetch custom object instances', () => {
    const customObjectInstances = elements.filter(isInstanceOfCustomObject)
    expect(customObjectInstances.length).toBeGreaterThanOrEqual(1)
  })

  describe('custom settings manipulations', () => {
    let createdInstance: InstanceElement
    let createdElement: ObjectType
    it('should create new instances', async () => {
      const settingsType = createCustomSettingsObject('customsetting__c', LIST_CUSTOM_SETTINGS_TYPE)
      createdElement = await createElement(adapter, settingsType)
      createdInstance = await createElement(adapter, await createInstance({
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
    it('should delete custom object setting', async () => {
      await removeElementAndVerify(adapter, client, createdInstance)
      await removeElementAndVerify(adapter, client, createdElement)
    })
  })

  describe('custom object instances manipulations', () => {
    let createdInstance: InstanceElement

    it('should create the new instance', async () => {
      const productTwoObjectType = elements
        .find(e => isObjectType(e) && (apiName(e, true) === productTwoMetadataName))
      expect(productTwoObjectType).toBeDefined()
      expect(isObjectType(productTwoObjectType)).toBeTruthy()
      const value = {
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
      const instance = await createInstance({
        value,
        type: productTwoObjectType as ObjectType,
      })
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
        changeGroup: {
          groupID: updatedInstance.elemID.getFullName(),
          changes: [{ action: 'modify', data: { before: createdInstance, after: updatedInstance } }],
        },
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
