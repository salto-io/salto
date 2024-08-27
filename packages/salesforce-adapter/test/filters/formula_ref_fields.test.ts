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
import { BuiltinTypes, ElemID, InstanceElement, ListType, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { FLEXI_PAGE_TYPE, LIGHTNING_PAGE_TYPE, METADATA_TYPE, SALESFORCE } from '../../src/constants'
import { mockTypes } from '../mock_elements'
import { FilterWith } from './mocks'
import { defaultFilterContext } from '../utils'
import filterCreator from '../../src/filters/formula_ref_fields'

describe('Formula reference fields', () => {
  let filter: FilterWith<'onFetch'>

  beforeAll(() => {
    const config = { ...defaultFilterContext }
    filter = filterCreator({ config }) as FilterWith<'onFetch'>
  })

  describe('Flow', () => {
    const flowConditionObjectType = new ObjectType({
      elemID: new ElemID(SALESFORCE, 'FlowCondition'),
      annotations: { [METADATA_TYPE]: 'FlowCondition' },
      fields: {
        leftValueReference: {
          refType: BuiltinTypes.STRING,
        },
      },
    })

    const flowRuleObjectType = new ObjectType({
      elemID: new ElemID(SALESFORCE, 'FlowRule'),
      annotations: { [METADATA_TYPE]: 'FlowRule' },
      fields: { conditions: { refType: new ListType(flowConditionObjectType) } },
    })

    const flowDecisionObjectType = new ObjectType({
      elemID: new ElemID(SALESFORCE, 'FlowDecision'),
      annotations: { [METADATA_TYPE]: 'FlowDecision' },
      fields: { rules: { refType: new ListType(flowRuleObjectType) } },
    })

    const flowType = new ObjectType({
      elemID: new ElemID(SALESFORCE, 'Flow'),
      annotations: { [METADATA_TYPE]: 'Flow' },
      fields: {
        decisions: { refType: flowDecisionObjectType },
      },
    })

    const referringInstance = new InstanceElement('SomeFlow', flowType, {
      decisions: [
        {
          rules: [
            {
              conditions: [
                {
                  leftValueReference: '$Label.SomeLabel',
                },
              ],
            },
          ],
        },
      ],
    })

    describe('when there is a valid reference', () => {
      const referredInstance = new InstanceElement('SomeLabel', mockTypes.CustomLabel, { fullName: 'SomeLabel' })
      const elements = [flowConditionObjectType, referringInstance, referredInstance].map(element => element.clone())

      beforeEach(async () => {
        await filter.onFetch(elements)
      })

      it('should replace the field value with a reference expression', () => {
        const referringInstanceAfterTest = elements.find(elem =>
          elem.elemID.isEqual(referringInstance.elemID),
        ) as InstanceElement
        expect(referringInstanceAfterTest.value.decisions?.[0].rules?.[0].conditions?.[0].leftValueReference).toEqual(
          new ReferenceExpression(referredInstance.elemID),
        )
      })
    })
    describe('when the reference is not valid', () => {
      const elements = [flowConditionObjectType, referringInstance].map(element => element.clone())

      beforeEach(async () => {
        await filter.onFetch(elements)
      })

      it('should replace the field value with a reference expression', () => {
        const referringInstanceAfterTest = elements.find(elem =>
          elem.elemID.isEqual(referringInstance.elemID),
        ) as InstanceElement
        expect(referringInstanceAfterTest.value.leftValueReference).toEqual(referringInstance.value.leftValueReference)
      })
    })
  })

  describe('LightningPage', () => {
    const componentInstancePropertyListItemType = new ObjectType({
      elemID: new ElemID(SALESFORCE, 'ComponentInstancePropertyListItem'),
      annotations: { [METADATA_TYPE]: 'ComponentInstancePropertyListItem' },
      fields: {
        value: { refType: BuiltinTypes.STRING },
      },
    })
    const componentInstancePropertyListType = new ObjectType({
      elemID: new ElemID(SALESFORCE, 'ComponentInstancePropertyList'),
      annotations: { [METADATA_TYPE]: 'ComponentInstancePropertyList' },
      fields: {
        valueListItems: { refType: new ListType(componentInstancePropertyListItemType) },
      },
    })
    const componentInstancePropertyType = new ObjectType({
      elemID: new ElemID(SALESFORCE, 'ComponentInstanceProperty'),
      annotations: { [METADATA_TYPE]: 'ComponentInstanceProperty' },
      fields: {
        valueList: { refType: new ListType(componentInstancePropertyListType) },
      },
    })
    const componentInstanceType = new ObjectType({
      elemID: new ElemID(SALESFORCE, 'ComponentInstance'),
      annotations: { [METADATA_TYPE]: 'ComponentInstance' },
      fields: {
        componentInstanceProperties: { refType: new ListType(componentInstancePropertyType) },
      },
    })
    const itemInstanceType = new ObjectType({
      elemID: new ElemID(SALESFORCE, 'ItemInstance'),
      annotations: { [METADATA_TYPE]: 'ItemInstance' },
      fields: {
        componentInstances: { refType: new ListType(componentInstanceType) },
      },
    })
    const flexiPageRegionType = new ObjectType({
      elemID: new ElemID(SALESFORCE, 'FlexiPageRegion'),
      annotations: { [METADATA_TYPE]: 'FlexiPageRegion' },
      fields: {
        itemInstances: { refType: new ListType(itemInstanceType) },
      },
    })
    const lightningPageType = new ObjectType({
      elemID: new ElemID(SALESFORCE, LIGHTNING_PAGE_TYPE),
      annotations: { [METADATA_TYPE]: FLEXI_PAGE_TYPE },
      fields: {
        flexiPageRegions: { refType: new ListType(flexiPageRegionType) },
      },
    })

    const referringInstance = new InstanceElement('SomePage', lightningPageType, {
      flexiPageRegions: [
        {
          itemInstances: [
            {
              componentInstances: [
                {
                  componentInstanceProperties: [
                    {
                      valueList: {
                        valueListItems: [{ value: '$Label.SomeLabel' }],
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })
    describe('when there is a valid reference', () => {
      const referredInstance = new InstanceElement('SomeLabel', mockTypes.CustomLabel, { fullName: 'SomeLabel' })
      const elements = [lightningPageType, referringInstance, referredInstance].map(element => element.clone())

      beforeEach(async () => {
        await filter.onFetch(elements)
      })

      it('should replace the field value with a reference expression', () => {
        const referringInstanceAfterTest = elements.find(elem =>
          elem.elemID.isEqual(referringInstance.elemID),
        ) as InstanceElement
        expect(
          referringInstanceAfterTest.value.flexiPageRegions?.[0].itemInstances?.[0].componentInstances?.[0]
            .componentInstanceProperties?.[0].valueList?.valueListItems?.[0].value,
        ).toEqual(new ReferenceExpression(referredInstance.elemID))
      })
    })
  })
})
