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
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  Element,
  Field,
} from '@salto-io/adapter-api'
import { multiIndex, collections } from '@salto-io/lowerdash'
import { DASHBOARD_GADGET_TYPE, FILTER_TYPE_NAME, JIRA } from '../../src/constants'
import {
  gadgetValuesContextFunc,
  gadgetValueSerialize,
  gadgetDashboradValueLookup,
} from '../../src/references/dashboard_gadget_properties'

const { awu } = collections.asynciterable

describe('DashboardGadgetReferences', () => {
  let dashboardGadgetType: ObjectType
  let filterType: ObjectType
  let instance: InstanceElement
  let filterInst: InstanceElement
  let filterRef: ReferenceExpression
  let instanceWithRefs: InstanceElement

  beforeEach(() => {
    dashboardGadgetType = new ObjectType({
      elemID: new ElemID(JIRA, DASHBOARD_GADGET_TYPE),
      fields: {},
    })

    filterType = new ObjectType({
      elemID: new ElemID(JIRA, FILTER_TYPE_NAME),
      fields: {
        id: { refType: BuiltinTypes.STRING },
      },
    })

    filterInst = new InstanceElement('filter', filterType, { id: '123' })
    filterRef = new ReferenceExpression(filterInst.elemID, filterInst)

    instance = new InstanceElement('instance', dashboardGadgetType, {
      properties: {
        key: 'config',
        values: [
          { key: 'filterId', value: 'filter-123' },
          { key: 'filterId', value: '123' },
          { key: 'projectOrFilterId', value: 'project-123' },
          { key: 'projectOrFilterId', value: 'filter-123' },
          { key: 'statType', value: 'customfield_123' },
        ],
      },
    })

    instanceWithRefs = new InstanceElement('instance', dashboardGadgetType, {
      properties: {
        key: 'config',
        values: [
          { key: 'filterId', value: filterRef },
          { key: 'filterId', value: filterRef },
          { key: 'projectOrFilterId', value: 'project-123' },
          { key: 'projectOrFilterId', value: filterRef },
        ],
      },
    })
  })

  describe('gadgetValuesCont{extFunc', () => {
    let field: Field
    let elemByElemID: multiIndex.Index<[string], Element>

    beforeEach(async () => {
      // field are elemByElemID are only needed because it is mandatory in ContextFunc, but are not going to be used
      field = new Field(filterType, 'mock', filterType)
      const indexer = multiIndex.buildMultiIndex<Element>().addIndex({
        name: 'elemByElemID',
        key: elem => [elem.elemID.getFullName()],
      })
      elemByElemID = (await indexer.process(awu([]))).elemByElemID
    })

    it('should return undefined if fieldPath is undefined', async () => {
      const result = await gadgetValuesContextFunc({ instance, elemByElemID, field })
      expect(result).toBeUndefined()
    })

    it('should return FIELD_TYPE_NAME for valid keys: ystattype, xstattype, statistictype, statType', async () => {
      const fieldPath = instance.elemID.createNestedID('properties', 'values', '4', 'value')
      const result1 = await gadgetValuesContextFunc({ instance, elemByElemID, field, fieldPath })
      expect(result1).toEqual('Field')
    })
    it('should determine type based on value prefix for the key: projectOrFilterId', async () => {
      const projectPath = instance.elemID.createNestedID('properties', 'values', '2', 'value')
      const filterPath = instance.elemID.createNestedID('properties', 'values', '3', 'value')
      const result1 = await gadgetValuesContextFunc({ instance, elemByElemID, field, fieldPath: projectPath })
      expect(result1).toEqual('Project')
      const result2 = await gadgetValuesContextFunc({ instance, elemByElemID, field, fieldPath: filterPath })
      expect(result2).toEqual('Filter')
    })
  })

  describe('gadgetValueSerialize', () => {
    it('should resolve filter references correctly', async () => {
      const elemId1 = instanceWithRefs.elemID.createNestedID('properties', 'values', '1', 'value')
      const elemId3 = instanceWithRefs.elemID.createNestedID('properties', 'values', '3', 'value')
      const result1 = await gadgetValueSerialize({ ref: filterRef, path: elemId1, element: instanceWithRefs })
      expect(result1).toEqual('123')
      const result3 = await gadgetValueSerialize({ ref: filterRef, path: elemId3, element: instanceWithRefs })
      expect(result3).toEqual('filter-123')
    })
    it('should return id if path is undefined', () => {
      const result = gadgetValueSerialize({ ref: filterRef, path: undefined, element: instanceWithRefs })
      expect(result).toEqual('123')
    })
  })

  describe('gadgetDashboradValueLookup', () => {
    it('should return the correct values', () => {
      const test1 = 'filter-123'
      const result1 = gadgetDashboradValueLookup(test1)
      expect(result1).toEqual('123')

      const test2 = 'project-234'
      const result2 = gadgetDashboradValueLookup(test2)
      expect(result2).toEqual('234')

      const test3 = 15
      const result3 = gadgetDashboradValueLookup(test3)
      expect(result3).toEqual(15)
    })
  })
})
