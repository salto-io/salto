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
import { ObjectType, ElemID, InstanceElement, ReferenceExpression, toChange, getChangeData } from '@salto-io/adapter-api'
import { ZENDESK, BRAND_TYPE_NAME } from '../../src/constants'
import { getBrandsForGuide, updateParentChildrenFromChanges } from '../../src/filters/utils'

describe('Zendesk utils', () => {
  describe('getBrandsForGuide', () => {
    const brandType = new ObjectType({
      elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME),
    })
    const brandInstances = [
      new InstanceElement(
        'guideTest',
        brandType,
        {
          name: 'guideTest',
          has_help_center: true,
        },
      ),
      new InstanceElement(
        'TestforGuide',
        brandType,
        {
          name: 'TestforGuide',
          has_help_center: true,
        },
      ),
      new InstanceElement(
        'BrandBrand',
        brandType,
        {
          name: 'BrandBrand',
          has_help_center: true,
        },
      ),
      new InstanceElement(
        'TestforGuide',
        brandType,
        {
          name: 'NoHelpCenterBrand',
          has_help_center: false,
        },
      ),
    ]

    it('should return all brands with help center', async () => {
      const fetchConfig = {
        include: [{ type: '.*' }],
        exclude: [],
        guide: { brands: ['.*'] },
      }
      const res = getBrandsForGuide(brandInstances, fetchConfig)
      expect(res.map(r => r.elemID.name).sort()).toEqual(['BrandBrand', 'TestforGuide', 'guideTest'])
    })
    it('it should exclude all brands that contain the word Test', async () => {
      const fetchConfig = {
        include: [{ type: '.*' }],
        exclude: [],
        guide: { brands: ['^((?!Test).)*$'] },
      }
      const res = getBrandsForGuide(brandInstances, fetchConfig)
      expect(res.map(r => r.elemID.name)).toEqual(['BrandBrand'])
    })
    it('should return an empty list of brands', async () => {
      const fetchConfig = {
        include: [{ type: '.*' }],
        exclude: [],
        guide: { brands: ['NoBrand', 'SomeBrand'] },
      }
      const res = getBrandsForGuide(brandInstances, fetchConfig)
      expect(res).toEqual([])
    })
  })
  describe('updateParentChildrenFromChanges', () => {
    let parent: InstanceElement
    let child: InstanceElement
    const CHILDREN_FIELD = 'children'
    beforeEach(() => {
      child = new InstanceElement(
        'child',
        new ObjectType({ elemID: new ElemID(ZENDESK, 'child', 'instance', 'child') }),
        { value: 'before' }
      )
      parent = new InstanceElement(
        'parent',
        new ObjectType({ elemID: new ElemID(ZENDESK, 'parent', 'instance', 'parent') }),
        { [CHILDREN_FIELD]: [] }
      )
    })
    it('should update parent children that are reference expressions', async () => {
      parent.value[CHILDREN_FIELD].push(new ReferenceExpression(child.elemID, child))
      const newChild = child.clone()
      newChild.value.value = 'after'
      const parentChange = toChange({ after: parent })
      const childChange = toChange({ before: child, after: newChild })
      updateParentChildrenFromChanges([parentChange], [childChange], CHILDREN_FIELD)

      expect(getChangeData(parentChange).value[CHILDREN_FIELD][0].value.value).toMatchObject({ value: 'after' })
    })
    it('should not update parent children that are reference expression if were are not changed', async () => {
      parent.value[CHILDREN_FIELD].push(new ReferenceExpression(child.elemID, child))
      const parentChange = toChange({ after: parent })
      updateParentChildrenFromChanges([parentChange], [], CHILDREN_FIELD)

      expect(getChangeData(parentChange).value[CHILDREN_FIELD][0].value.value).toMatchObject({ value: 'before' })
    })
    it('should not update parent children that are not reference expressions', async () => {
      parent.value[CHILDREN_FIELD].push(child.value)
      const parentChange = toChange({ after: parent })
      updateParentChildrenFromChanges([parentChange], [], CHILDREN_FIELD)

      expect(getChangeData(parentChange).value[CHILDREN_FIELD][0]).toMatchObject({ value: 'before' })
    })
  })
})
