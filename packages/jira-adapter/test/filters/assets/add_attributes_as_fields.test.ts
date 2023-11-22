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
import { filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { InstanceElement, ReferenceExpression, Element, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { getDefaultConfig } from '../../../src/config/config'
import addAttributesAsFieldsFilter from '../../../src/filters/assets/add_attributes_as_fields'
import { createEmptyType, getFilterParams } from '../../utils'
import { ASSESTS_SCHEMA_TYPE, ASSETS_ATTRIBUTE_TYPE, ASSETS_OBJECT_TYPE } from '../../../src/constants'

describe('AddAttributesAsFields', () => {
    type FilterType = filterUtils.FilterWith<'onFetch'>
    let filter: FilterType
    let elements: Element[]
    let parentInstance: InstanceElement
    let sonOneInstance: InstanceElement
    let attributeInstance: InstanceElement
    let attributeInstance2: InstanceElement
    let attributeInstance3: InstanceElement
    let attributeInstance4: InstanceElement
    const assetSchemaInstance = new InstanceElement(
      'assetsSchema1',
      createEmptyType(ASSESTS_SCHEMA_TYPE),
      {
        idAsInt: 5,
        name: 'assetsSchema',
      },
    )
    describe('on fetch', () => {
      beforeEach(async () => {
        const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
        config.fetch.enableJSM = true
        config.fetch.enableJsmExperimental = true
        filter = addAttributesAsFieldsFilter(getFilterParams({ config })) as typeof filter
        parentInstance = new InstanceElement(
          'parentInstance',
          createEmptyType(ASSETS_OBJECT_TYPE),
          {
            name: 'parentInstance',
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(assetSchemaInstance.elemID, assetSchemaInstance)],
          }
        )
        sonOneInstance = new InstanceElement(
          'sonOneInstance',
          createEmptyType(ASSETS_OBJECT_TYPE),
          {
            name: 'sonOneInstance',
            parentObjectTypeId: new ReferenceExpression(parentInstance.elemID, parentInstance),
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(assetSchemaInstance.elemID, assetSchemaInstance)],
          }
        )
        attributeInstance = new InstanceElement(
          'attributeInstance',
          createEmptyType(ASSETS_ATTRIBUTE_TYPE),
          {
            name: 'attributeInstance',
            objectType: new ReferenceExpression(parentInstance.elemID, parentInstance),
          },
          undefined,
        )
        attributeInstance2 = new InstanceElement(
          'attributeInstance2',
          createEmptyType(ASSETS_ATTRIBUTE_TYPE),
          {
            name: 'attributeInstance2',
            objectType: new ReferenceExpression(parentInstance.elemID, parentInstance),
          },
          undefined,
        )
        attributeInstance3 = new InstanceElement(
          'attributeInstance3',
          createEmptyType(ASSETS_ATTRIBUTE_TYPE),
          {
            name: 'attributeInstance3',
            objectType: new ReferenceExpression(sonOneInstance.elemID, sonOneInstance),
          },
          undefined,
        )
        attributeInstance4 = new InstanceElement(
          'attributeInstance4',
          createEmptyType(ASSETS_ATTRIBUTE_TYPE),
          {
            name: 'attributeInstance4',
            objectType: new ReferenceExpression(sonOneInstance.elemID, sonOneInstance),
          },
          undefined,
        )

        elements = [
          parentInstance,
          sonOneInstance,
          assetSchemaInstance,
          attributeInstance,
          attributeInstance2,
          attributeInstance3,
          attributeInstance4,
        ]
      })
      it('should add each attribute to the objectType that created it', async () => {
        await filter.onFetch(elements)
        expect(parentInstance.value.attributes).toEqual([
          new ReferenceExpression(attributeInstance.elemID, attributeInstance),
          new ReferenceExpression(attributeInstance2.elemID, attributeInstance2),
        ])
        expect(sonOneInstance.value.attributes).toEqual([
          new ReferenceExpression(attributeInstance3.elemID, attributeInstance3),
          new ReferenceExpression(attributeInstance4.elemID, attributeInstance4),
        ])
      })
    })
})
