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

import { filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { CORE_ANNOTATIONS, InstanceElement, ReferenceExpression, isInstanceElement } from '@salto-io/adapter-api'
import { getDefaultConfig } from '../../../src/config/config'
import fetchAssetsObjectTypeOrderFilter from '../../../src/filters/assets/fetch_assets_object_type_order'
import { createEmptyType, getFilterParams } from '../../utils'
import { ASSESTS_SCHEMA_TYPE, ASSETS_OBJECT_TYPE, ASSETS_OBJECT_TYPE_ORDER_TYPE, JIRA } from '../../../src/constants'
import JiraClient from '../../../src/client/client'

const createAssetsObjectTypeInstance = (
  id: number,
  suffix: string,
  assetSchema: InstanceElement,
  parentObjectTypeInstance: InstanceElement
): InstanceElement => new InstanceElement(
  `assetsObjectType${suffix}`,
  createEmptyType(ASSETS_OBJECT_TYPE),
  {
    id,
    name: `assetsObjectType${suffix}`,
    position: id - 1,
    parentObjectTypeId: new ReferenceExpression(parentObjectTypeInstance.elemID, parentObjectTypeInstance),
  },
  [JIRA, elementUtils.RECORDS_PATH, ASSESTS_SCHEMA_TYPE, 'assetsSchema', 'assetsObjectTypes', 'parentObjectTypeInstance', `assetsObjectType${suffix}`, `assetsObjectType${suffix}`],
  {
    [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(assetSchema.elemID, assetSchema)],
  }
)

describe('fetchAttributesFilter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  let client: JiraClient
  const assetSchema = new InstanceElement(
    'assetsSchema',
    createEmptyType(ASSESTS_SCHEMA_TYPE),
    {
      name: 'AssetsSchema',
    },
    [JIRA, elementUtils.RECORDS_PATH, ASSESTS_SCHEMA_TYPE, 'assetsSchema'],
  )
  const parentObjectTypeInstance = new InstanceElement(
    'parentObjectTypeInstance',
    createEmptyType(ASSETS_OBJECT_TYPE),
    {
      id: 'p1',
      name: 'AssetsObjectTypeP1',
      parentObjectTypeId: new ReferenceExpression(assetSchema.elemID, assetSchema),
    },
    [JIRA, elementUtils.RECORDS_PATH, ASSESTS_SCHEMA_TYPE, 'assetsSchema', 'assetsObjectTypes', 'parentObjectTypeInstance', 'parentObjectTypeInstance'],
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(assetSchema.elemID, assetSchema)],
    }
  )
  const assetsObjectTypeInstanceOne = createAssetsObjectTypeInstance(1, 'One', assetSchema, parentObjectTypeInstance)
  const assetsObjectTypeInstanceTwo = createAssetsObjectTypeInstance(2, 'Two', assetSchema, parentObjectTypeInstance)
  const assetsObjectTypeInstanceThree = createAssetsObjectTypeInstance(3, 'Three', assetSchema, parentObjectTypeInstance)
  describe('fetch', () => {
    beforeEach(() => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      config.fetch.enableJsmExperimental = true
      filter = fetchAssetsObjectTypeOrderFilter(getFilterParams({ config, client })) as typeof filter
    })
    it('should add assetsObjectTypeOrder to the elements', async () => {
      const elements = [
        parentObjectTypeInstance,
        assetsObjectTypeInstanceOne,
        assetsObjectTypeInstanceTwo,
        assetsObjectTypeInstanceThree,
      ]
      await filter.onFetch(elements)
      expect(elements).toHaveLength(7)
      const orderInstances = elements
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === ASSETS_OBJECT_TYPE_ORDER_TYPE)
      expect(orderInstances[1]).toBeDefined()
      expect(orderInstances[1].elemID.name).toEqual('parentObjectTypeInstance_order')
      expect(orderInstances[1].value.objectTypes).toEqual([
        new ReferenceExpression(assetsObjectTypeInstanceOne.elemID, assetsObjectTypeInstanceOne),
        new ReferenceExpression(assetsObjectTypeInstanceTwo.elemID, assetsObjectTypeInstanceTwo),
        new ReferenceExpression(assetsObjectTypeInstanceThree.elemID, assetsObjectTypeInstanceThree),
      ])
    })
    it('should do nothing for instnaces without parentObjectTypeId', async () => {
      const elements = [
        parentObjectTypeInstance,
        assetsObjectTypeInstanceOne,
        assetsObjectTypeInstanceTwo,
        assetsObjectTypeInstanceThree,
      ]
      delete parentObjectTypeInstance.value.parentObjectTypeId
      await filter.onFetch(elements)
      expect(elements).toHaveLength(6)
    })
  })
})
