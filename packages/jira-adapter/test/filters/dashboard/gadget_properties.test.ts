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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, Values, toChange } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { getFilterParams } from '../../utils'
import gadgetPropertiesFilter from '../../../src/filters/dashboard/gadget_properties'
import { DASHBOARD_GADGET_TYPE, JIRA } from '../../../src/constants'


describe('gadgetPropertiesFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let dashboardGadgetType: ObjectType
  let instance: InstanceElement

  let originalProperties: Values
  let convertedProperties: Values

  beforeEach(async () => {
    filter = gadgetPropertiesFilter(getFilterParams({})) as filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>

    dashboardGadgetType = new ObjectType({
      elemID: new ElemID(JIRA, DASHBOARD_GADGET_TYPE),
      fields: {
        properties: {
          refType: BuiltinTypes.STRING,
        },
      },
    })

    originalProperties = {
      key1: 'value1',
      key2: {
        innerKey: 'value2',
      },
    }

    convertedProperties = [
      { key: 'key1', value: 'value1' },
      { key: 'key2', values: [{ key: 'innerKey', value: 'value2' }] },
    ]

    instance = new InstanceElement(
      'instance',
      dashboardGadgetType,
      {
        properties: originalProperties,
      },
    )
  })

  describe('onFetch', () => {
    it('should return the dashboard properties type', async () => {
      const elements = [dashboardGadgetType]
      await filter.onFetch(elements)
      expect(dashboardGadgetType.fields.properties.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      const propertiesType = elements[1] as ObjectType

      expect(propertiesType.fields.key.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(propertiesType.fields.value.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(propertiesType.fields.values.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })

    it('should convert properties from map to list', async () => {
      await filter.onFetch([instance])
      expect(instance.value.properties).toEqual(convertedProperties)
    })
  })

  describe('preDeploy', () => {
    it('should convert properties from list to map', async () => {
      instance.value.properties = convertedProperties
      await filter.preDeploy([toChange({ after: instance })])
      expect(instance.value.properties).toEqual(originalProperties)
    })
  })

  describe('onDeploy', () => {
    it('should convert properties from map to list', async () => {
      await filter.onDeploy([toChange({ after: instance })])
      expect(instance.value.properties).toEqual(convertedProperties)
    })
  })
})
