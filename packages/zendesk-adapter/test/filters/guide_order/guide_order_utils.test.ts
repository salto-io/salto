/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { getParent } from '@salto-io/adapter-utils'
import { ZENDESK } from '../../../src/constants'
import { createOrderInstance } from '../../../src/filters/guide_order/guide_order_utils'

describe('guide_order_utils', () => {
  describe('createOrderInstance', () => {
    const childType = new ObjectType({ elemID: new ElemID(ZENDESK, 'child') })
    const parent = new InstanceElement('parent', new ObjectType({ elemID: new ElemID(ZENDESK, 'parent') }), {
      parent_id: 'parent_id',
      brand: 'brandRef',
    })
    const parentField = 'parent_id'
    const orderField = 'children'
    it('should create an instance element with the correct values', () => {
      const childrenElements = [
        new InstanceElement('child1', childType, {
          order_field: 1,
        }),
        new InstanceElement('child2', childType, {
          order_field: 2,
        }),
      ]
      const orderType = new ObjectType({ elemID: new ElemID(ZENDESK, 'order_type') })
      const instance = createOrderInstance({
        parent,
        parentField,
        orderField,
        childrenElements,
        orderType,
      })
      expect(instance.elemID.name).toEqual('parent')
      expect(instance.value.brand).toEqual('brandRef')
      expect(instance.value[orderField]).toEqual(
        childrenElements.map(child => new ReferenceExpression(child.elemID, child)),
      )
      expect(getParent(instance)).toEqual(parent)
    })
    it('should create an instance element with the correct values when there are no children', () => {
      const childrenElements: InstanceElement[] = []
      const orderType = new ObjectType({ elemID: new ElemID(ZENDESK, 'order_type') })
      const instance = createOrderInstance({
        parent,
        parentField,
        orderField,
        childrenElements,
        orderType,
      })
      expect(instance.elemID.name).toEqual('parent')
      expect(instance.value.brand).toEqual('brandRef')
      expect(instance.value[orderField]).toBeUndefined()
      expect(getParent(instance)).toEqual(parent)
    })
    it('should create an instance element with the correct values when the parent is a brand', () => {
      const childrenElements = [
        new InstanceElement('child1', childType, {
          order_field: 1,
        }),
        new InstanceElement('child2', childType, {
          order_field: 2,
        }),
      ]
      const orderType = new ObjectType({ elemID: new ElemID(ZENDESK, 'order_type') })
      const brand = new InstanceElement('brand', new ObjectType({ elemID: new ElemID(ZENDESK, 'brand') }), {
        brand_id: 'brand_id',
      })
      const instance = createOrderInstance({
        parent: brand,
        parentField,
        orderField,
        childrenElements,
        orderType,
      })
      expect(instance.elemID.name).toEqual('brand')
      expect(instance.value.brand).toEqual(new ReferenceExpression(brand.elemID, brand))
      expect(instance.value[orderField]).toEqual(
        childrenElements.map(child => new ReferenceExpression(child.elemID, child)),
      )
      expect(getParent(instance)).toEqual(brand)
    })
  })
})
