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
  AdditionChange,
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  Field,
  InstanceElement,
  ListType,
  ObjectType,
  ReferenceExpression,
  Values,
  getChangeData,
  toChange,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { getFilterParams } from '../../utils'
import gadgetPropertiesFilter from '../../../src/filters/dashboard/gadget_properties'
import { DASHBOARD_GADGET_TYPE, DASHBOARD_TYPE, FILTER_TYPE_NAME, JIRA } from '../../../src/constants'

const getConvertedGadgetType = (): ObjectType => {
  const gadgetType = new ObjectType({
    elemID: new ElemID(JIRA, DASHBOARD_GADGET_TYPE),
  })
  const gadgetPropertyType = new ObjectType({
    elemID: new ElemID(JIRA, 'DashboardGadgetProperty'),
    fields: {
      key: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true, [CORE_ANNOTATIONS.UPDATABLE]: true },
      },
      value: {
        refType: BuiltinTypes.UNKNOWN,
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true, [CORE_ANNOTATIONS.UPDATABLE]: true },
      },
    },
  })
  gadgetPropertyType.fields.values = new Field(gadgetPropertyType, 'values', new ListType(gadgetPropertyType), {
    [CORE_ANNOTATIONS.CREATABLE]: true,
    [CORE_ANNOTATIONS.UPDATABLE]: true,
  })

  gadgetType.fields.properties = new Field(gadgetType, 'properties', new ListType(gadgetPropertyType), {
    [CORE_ANNOTATIONS.CREATABLE]: true,
    [CORE_ANNOTATIONS.UPDATABLE]: true,
  })
  return gadgetType
}

describe('gadgetPropertiesFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let dashboardGadgetType: ObjectType
  let dashboardType: ObjectType
  let filterType: ObjectType
  let instance: InstanceElement
  let dashboard: InstanceElement
  let filterInst: InstanceElement

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

    dashboardType = new ObjectType({
      elemID: new ElemID(JIRA, DASHBOARD_TYPE),
      fields: {
        id: { refType: BuiltinTypes.STRING },
      },
    })

    filterType = new ObjectType({
      elemID: new ElemID(JIRA, FILTER_TYPE_NAME),
      fields: {
        id: { refType: BuiltinTypes.STRING },
      },
    })

    originalProperties = {
      key1: 'value1',
      key2: {
        innerKey: 'value2',
      },
      key3: {
        innerKey: {
          inner2: 'value3',
        },
      },
    }

    convertedProperties = [
      { key: 'key1', value: 'value1' },
      { key: 'key2', values: [{ key: 'innerKey', value: 'value2' }] },
      { key: 'key3', values: [{ key: 'innerKey', values: [{ key: 'inner2', value: 'value3' }] }] },
    ]

    dashboard = new InstanceElement('dashboard', dashboardType, { id: '0' })

    instance = new InstanceElement('instance', dashboardGadgetType, {
      properties: originalProperties,
    })
    filterInst = new InstanceElement('filter', filterType, { id: '1' })
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

    it('should omit empty values', async () => {
      instance.value.properties = {
        ...instance.value.properties,
        key4: {},
      }
      await filter.onFetch([instance])
      expect(instance.value.properties).toEqual(convertedProperties)
    })

    it('should omit empty inner values', async () => {
      instance.value.properties.key2.inner2 = {}
      await filter.onFetch([instance])
      expect(instance.value.properties).toEqual(convertedProperties)
    })

    it('should omit null values', async () => {
      instance.value.properties = {
        ...instance.value.properties,
        key4: null,
      }
      await filter.onFetch([instance])
      expect(instance.value.properties).toEqual(convertedProperties)
    })
  })

  describe('preDeploy', () => {
    it('should convert properties from list to map', async () => {
      instance.value.properties = convertedProperties
      const changes = [toChange({ after: instance })]
      await filter.preDeploy(changes)
      const relevantChange = changes.find(
        change => getChangeData(change).elemID.getFullName() === instance.elemID.getFullName(),
      ) as AdditionChange<InstanceElement>
      expect(relevantChange.data.after.value.properties).toEqual(originalProperties)
    })
    it('should resolve any existing references', async () => {
      const convertedPropertiesWithRefs = [
        { key: 'key2', values: [{ key: 'filterId', value: new ReferenceExpression(filterInst.elemID, filterInst) }] },
      ]
      const inst = new InstanceElement(
        'test',
        getConvertedGadgetType(),
        { properties: convertedPropertiesWithRefs },
        undefined,
        { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(dashboard.elemID, dashboard)] },
      )
      const changes = [toChange({ after: inst })]
      await filter.preDeploy(changes)
      const relevantChange = changes.find(
        change => getChangeData(change).elemID.getFullName() === inst.elemID.getFullName(),
      ) as AdditionChange<InstanceElement>
      expect(relevantChange?.data?.after.value.properties.key2.filterId).toEqual('1')
      expect(relevantChange?.data?.after.annotations[CORE_ANNOTATIONS.PARENT][0]).toEqual({ id: '0' })
    })
  })

  describe('onDeploy', () => {
    it('should convert properties from map to list', async () => {
      instance.value.properties = convertedProperties
      const changes = [toChange({ after: instance })]
      // We call preDeploy as it sets the mappings
      await filter.preDeploy(changes)
      await filter.onDeploy(changes)
      const relevantChange = changes.find(
        change => getChangeData(change).elemID.getFullName() === instance.elemID.getFullName(),
      ) as AdditionChange<InstanceElement>
      expect(relevantChange?.data?.after.value.properties).toEqual(convertedProperties)
    })
    it('should restore references', async () => {
      const convertedPropertiesWithRefs = [
        { key: 'key2', values: [{ key: 'filterId', value: new ReferenceExpression(filterInst.elemID, filterInst) }] },
      ]
      const inst = new InstanceElement(
        'test',
        getConvertedGadgetType(),
        { properties: convertedPropertiesWithRefs },
        undefined,
        { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(dashboard.elemID, dashboard)] },
      )
      const changes = [toChange({ after: inst })]
      // We call preDeploy as it sets the mappings
      await filter.preDeploy(changes)
      await filter.onDeploy(changes)
      const relevantChange = changes.find(
        change => getChangeData(change).elemID.getFullName() === inst.elemID.getFullName(),
      ) as AdditionChange<InstanceElement>
      expect(getChangeData(relevantChange).annotations[CORE_ANNOTATIONS.PARENT]).toEqual([
        new ReferenceExpression(dashboard.elemID, dashboard),
      ])
      expect(getChangeData(relevantChange).value.properties[0].values[0].value).toEqual(
        new ReferenceExpression(filterInst.elemID, filterInst),
      )
    })
  })
})
