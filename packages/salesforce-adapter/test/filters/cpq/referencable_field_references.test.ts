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
  BuiltinTypes,
  Change,
  ElemID,
  getChangeData,
  InstanceElement,
  ObjectType,
  toChange,
} from '@salto-io/adapter-api'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { defaultFilterContext } from '../../utils'
import filterCreator from '../../../src/filters/cpq/referencable_field_references'
import {
  API_NAME,
  CPQ_FILTER_SOURCE_FIELD,
  CPQ_FILTER_SOURCE_OBJECT,
  CPQ_HIDDEN_SOURCE_FIELD,
  CPQ_HIDDEN_SOURCE_OBJECT,
  CPQ_QUOTE,
  CPQ_TARGET_FIELD,
  CPQ_TARGET_OBJECT,
  CUSTOM_OBJECT_ID_FIELD,
  SALESFORCE,
} from '../../../src/constants'
import { mockTypes } from '../../mock_elements'
import { FilterWith } from '../mocks'

describe('cpqReferencableFieldReferences', () => {
  const MOCK_TYPE = 'SBQQ__MockType__c'
  const INSTANCE_NAME = 'mockInstance'

  const filter = filterCreator({
    config: defaultFilterContext,
  }) as FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>

  const mockType = new ObjectType({
    elemID: new ElemID(SALESFORCE, MOCK_TYPE),
    fields: {
      [CPQ_FILTER_SOURCE_OBJECT]: { refType: BuiltinTypes.STRING },
      [CPQ_FILTER_SOURCE_FIELD]: { refType: BuiltinTypes.STRING },
      [CPQ_HIDDEN_SOURCE_OBJECT]: { refType: BuiltinTypes.STRING },
      [CPQ_HIDDEN_SOURCE_FIELD]: { refType: BuiltinTypes.STRING },
      [CPQ_TARGET_OBJECT]: { refType: BuiltinTypes.STRING },
      [CPQ_TARGET_FIELD]: { refType: BuiltinTypes.STRING },
    },
    annotations: {
      [API_NAME]: MOCK_TYPE,
    },
  })

  describe('fetch', () => {
    let instance: InstanceElement
    beforeAll(async () => {
      instance = new InstanceElement(INSTANCE_NAME, mockType, {
        // Case 1: of referencable field & controllingField from Product2
        [CPQ_FILTER_SOURCE_OBJECT]: 'Product',
        [CPQ_FILTER_SOURCE_FIELD]: 'ProductCode',
        // Case 2: of referencable field & controllingField from Account standard object
        [CPQ_HIDDEN_SOURCE_OBJECT]: 'Account',
        [CPQ_HIDDEN_SOURCE_FIELD]: 'Name',
        // Case 3: of referencable controllingField and not referencable field from SBQQ__Quote__c
        [CPQ_TARGET_OBJECT]: 'Quote',
        [CPQ_TARGET_FIELD]: 'Primary',
      })
      const elements = [
        instance,
        mockTypes[CPQ_QUOTE],
        mockTypes.Product2,
        mockTypes.Account,
      ]
      await filter.onFetch(elements)
    })

    it('should add references to Case 1: Product2.ProductCode', async () => {
      const { value } = instance
      expect(value[CPQ_FILTER_SOURCE_OBJECT].elemID).toEqual(
        mockTypes.Product2.elemID,
      )
      expect(value[CPQ_FILTER_SOURCE_FIELD].elemID).toEqual(
        mockTypes.Product2.fields.ProductCode.elemID,
      )
    })
    it('should add references to Case 2: Account.Name', async () => {
      const { value } = instance
      expect(value[CPQ_HIDDEN_SOURCE_OBJECT].elemID).toEqual(
        mockTypes.Account.elemID,
      )
      expect(value[CPQ_HIDDEN_SOURCE_FIELD].elemID).toEqual(
        mockTypes.Account.fields.Name.elemID,
      )
    })
    it('should add references to Case 3: SBQQ__Quote__c.SBQQ__Primary__c', async () => {
      const { value } = instance
      expect(value[CPQ_TARGET_OBJECT].elemID).toEqual(
        mockTypes[CPQ_QUOTE].elemID,
      )
      expect(value[CPQ_TARGET_FIELD]).toEqual('Primary')
    })
  })

  describe('deploy flow', () => {
    const CUSTOM_OBJECT_ID = '111B235WQUR'
    let change: Change<InstanceElement>

    beforeEach(async () => {
      const instance = new InstanceElement(INSTANCE_NAME, mockType, {
        // Product2
        [CPQ_FILTER_SOURCE_OBJECT]: 'Product2',
        [CPQ_FILTER_SOURCE_FIELD]: 'Product2.ProductCode',
        // standard CustomObject
        [CPQ_HIDDEN_SOURCE_OBJECT]: 'Account',
        [CPQ_HIDDEN_SOURCE_FIELD]: 'Account.Name',
        // SBQQ__Quote__c
        [CPQ_TARGET_OBJECT]: 'SBQQ__Quote__c',
        [CPQ_TARGET_FIELD]: 'Primary',
      })
      change = toChange({
        after: instance,
      })
    })

    it('should revert the references on preDeploy and enrich the original changes on onDeploy with extra properties from the applied change', async () => {
      const originalChange = await applyFunctionToChangeData(change, (i) =>
        i.clone(),
      )
      const afterPreDeployChanges = [change]
      await filter.preDeploy(afterPreDeployChanges)
      const afterPreDeployInstance = getChangeData(afterPreDeployChanges[0])
      expect(afterPreDeployInstance.value).toEqual({
        [CPQ_FILTER_SOURCE_OBJECT]: 'Product',
        [CPQ_FILTER_SOURCE_FIELD]: 'ProductCode',
        [CPQ_HIDDEN_SOURCE_OBJECT]: 'Account',
        [CPQ_HIDDEN_SOURCE_FIELD]: 'Name',
        [CPQ_TARGET_OBJECT]: 'Quote',
        [CPQ_TARGET_FIELD]: 'Primary',
      })

      const enrichedInstance = afterPreDeployInstance.clone()
      enrichedInstance.value = {
        ...enrichedInstance.value,
        [CUSTOM_OBJECT_ID_FIELD]: CUSTOM_OBJECT_ID,
      }
      const afterOnDeployChanges = [toChange({ after: enrichedInstance })]
      await filter.onDeploy(afterOnDeployChanges)
      const afterOnDeployInstance = getChangeData(afterOnDeployChanges[0])
      expect(afterOnDeployInstance.value).toEqual({
        ...getChangeData(originalChange).value,
        [CUSTOM_OBJECT_ID_FIELD]: CUSTOM_OBJECT_ID,
      })
    })
    it('should only handle applied changes', async () => {
      const afterPreDeployChanges = [change]
      await filter.preDeploy(afterPreDeployChanges)
      const onDeployChanges: Change[] = []
      await filter.onDeploy(onDeployChanges)
      expect(onDeployChanges).toBeEmpty()
    })
  })
})
