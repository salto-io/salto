
/*
*                      Copyright 2022 Salto Labs Ltd.
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
  ElemID,
  InstanceElement,
  ObjectType,
  Change,
  toChange,
  getChangeData,
} from '@salto-io/adapter-api'
import { defaultFilterContext } from '../../utils'
import { FilterWith } from '../../../src/filter'
import filterCreator from '../../../src/filters/cpq/custom_field_references'
import {
  CPQ_FILTER_SOURCE_FIELD,
  CPQ_FILTER_SOURCE_OBJECT, CPQ_HIDDEN_SOURCE_FIELD,
  CPQ_HIDDEN_SOURCE_OBJECT, CPQ_TARGET_FIELD, CPQ_TARGET_OBJECT,
  SALESFORCE,
} from '../../../src/constants'
import { mockTypes } from '../../mock_elements'

describe('cpqCustomFieldReferencesFilter', () => {
  const MOCK_TYPE = 'MockType'
  const INSTANCE_NAME = 'mockInstance'

  let instance: InstanceElement

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
  })

  beforeEach(() => {
    instance = new InstanceElement(
      INSTANCE_NAME,
      mockType,
      {
        [CPQ_FILTER_SOURCE_OBJECT]: 'Product',
        [CPQ_FILTER_SOURCE_FIELD]: 'Product Code',
        [CPQ_HIDDEN_SOURCE_OBJECT]: 'Quote',
        [CPQ_HIDDEN_SOURCE_FIELD]: 'Status',
        [CPQ_TARGET_OBJECT]: 'Quote',
        [CPQ_TARGET_FIELD]: 'Product Option',
      },
    )
  })

  describe('fetch', () => {
    beforeEach(async () => {
      const elements = [instance, mockTypes.Quote, mockTypes.Product2]
      await filter.onFetch(elements)
    })

    it('should create references to custom fields', async () => {
      expect(instance.value[CPQ_FILTER_SOURCE_FIELD].elemID).toEqual(mockTypes.Product2.fields.ProductCode.elemID)
      expect(instance.value[CPQ_HIDDEN_SOURCE_FIELD].elemID).toEqual(mockTypes.Quote.fields.Status.elemID)
      expect(instance.value[CPQ_TARGET_FIELD].elemID).toEqual(mockTypes.Quote.fields.ProductOption.elemID)
    })
    it('should omit referenced object fields', async () => {
      expect(instance.value).not.toContainAnyKeys([
        CPQ_FILTER_SOURCE_OBJECT,
        CPQ_HIDDEN_SOURCE_OBJECT,
        CPQ_TARGET_OBJECT,
      ])
    })
  })

  describe('deploy', () => {
    let change: Change<InstanceElement>

    beforeEach(async () => {
      instance.value = {
        [CPQ_FILTER_SOURCE_FIELD]: 'Product2.ProductCode',
        [CPQ_HIDDEN_SOURCE_FIELD]: 'Quote.Status',
        [CPQ_TARGET_FIELD]: 'Quote.ProductOption',
      }
      change = toChange({
        after: instance,
      })
    })
    it('should revert the references on preDeploy and restore the original changes on onDeploy', async () => {
      const originalChange = toChange({
        after: instance.clone(),
      })
      const changes = [change]
      await filter.preDeploy(changes)
      const afterPreDeployInstance = getChangeData(changes[0])
      expect(afterPreDeployInstance.value).toEqual({
        [CPQ_FILTER_SOURCE_OBJECT]: 'Product',
        [CPQ_FILTER_SOURCE_FIELD]: 'Product Code',
        [CPQ_HIDDEN_SOURCE_OBJECT]: 'Quote',
        [CPQ_HIDDEN_SOURCE_FIELD]: 'Status',
        [CPQ_TARGET_OBJECT]: 'Quote',
        [CPQ_TARGET_FIELD]: 'Product Option',
      })

      await filter.onDeploy(changes)
      expect(changes).toEqual([originalChange])
    })
  })
})
