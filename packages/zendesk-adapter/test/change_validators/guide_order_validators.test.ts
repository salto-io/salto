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

import {
  ChangeError,
  ChangeValidator,
  CORE_ANNOTATIONS,
  ElemID, getChangeData,
  InstanceElement,
  ObjectType,
  ReferenceExpression, toChange,
} from '@salto-io/adapter-api'
import { getParent, safeJsonStringify } from '@salto-io/adapter-utils'
import {
  BRAND_TYPE_NAME,
  CATEGORY_TYPE_NAME,
  SECTION_TYPE_NAME,
  ZENDESK,
  ARTICLES_FIELD,
  CATEGORIES_FIELD,
  SECTIONS_FIELD,
  ARTICLE_TYPE_NAME,
  CATEGORY_ORDER_TYPE_NAME, SECTION_ORDER_TYPE_NAME, ARTICLE_ORDER_TYPE_NAME,
} from '../../src/constants'
import { createOrderType } from '../../src/filters/guide_order/guide_order_utils'
import {
  childInOrderValidator, childrenReferencesValidator,
  guideOrderDeletionValidator, orderChildrenParentValidator,
} from '../../src/change_validators'

const brandType = new ObjectType({ elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME) })
const categoryType = new ObjectType({ elemID: new ElemID(ZENDESK, CATEGORY_TYPE_NAME) })
const sectionType = new ObjectType({ elemID: new ElemID(ZENDESK, SECTION_TYPE_NAME) })
const articleType = new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) })

const brandInstance = new InstanceElement('brand', brandType)
const categoryInstance = new InstanceElement('category', categoryType)
const sectionInstance = new InstanceElement('section', sectionType)
const articleInstance = new InstanceElement('article', articleType)

const createOrderElement = (
  parent: InstanceElement,
  orderElementType: string,
  orderField: string,
  childInstance: InstanceElement
) : InstanceElement => new InstanceElement(
  `${parent.elemID.name}_${orderField}`,
  createOrderType(orderElementType),
  {
    [orderField]: [new ReferenceExpression(childInstance.elemID, childInstance)],
  }, [],
  { [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(parent.elemID, parent) }
)

const categoryOrderInstance = createOrderElement(
  brandInstance, CATEGORY_TYPE_NAME, CATEGORIES_FIELD, categoryInstance
)
const categorySectionsOrderInstance = createOrderElement(
  categoryInstance, SECTION_TYPE_NAME, SECTIONS_FIELD, sectionInstance
)
const sectionSectionsOrderInstance = createOrderElement(
  sectionInstance, SECTION_TYPE_NAME, SECTIONS_FIELD, sectionInstance
)
const articleOrderInstance = createOrderElement(
  sectionInstance, ARTICLE_TYPE_NAME, ARTICLES_FIELD, articleInstance
)

describe('GuideOrdersValidator', () => {
  const orderInstances = [
    categoryOrderInstance,
    categorySectionsOrderInstance,
    sectionSectionsOrderInstance,
    articleOrderInstance,
  ]
  const childrenInstances = [categoryInstance, sectionInstance, articleInstance]
  describe('Are all children a reference', () => {
    const testValidator = async (
      orderInstance: InstanceElement,
      orderField: string,
      validator: ChangeValidator
    ): Promise<void> => {
      const orderWithoutReferences = orderInstance.clone()
      orderWithoutReferences.value[orderField] = [1]

      const changes = [
        toChange({ before: orderInstance, after: orderWithoutReferences }),
        toChange({ before: orderInstance, after: orderInstance }),
      ]
      const errors = await validator(changes)
      expect(errors.length).toBe(1)
      expect(errors[0]).toMatchObject({
        elemID: orderInstance.elemID,
        severity: 'Error',
        message: `${orderInstance.elemID.typeName}'s field '${orderField}' includes an invalid Salto reference`,
        detailedMessage: `${orderInstance.elemID.typeName} instance ${orderInstance.elemID.name}'s field ${orderField} includes one or more invalid Salto references`,
      })
    }

    it('Categories order', async () => {
      await testValidator(categoryOrderInstance, CATEGORIES_FIELD, childrenReferencesValidator)
    })
    it('Category sections order', async () => {
      await testValidator(
        categorySectionsOrderInstance, SECTIONS_FIELD, childrenReferencesValidator
      )
    })
    it('Section sections order', async () => {
      await testValidator(
        sectionSectionsOrderInstance, SECTIONS_FIELD, childrenReferencesValidator
      )
    })
    it('Articles order', async () => {
      await testValidator(articleOrderInstance, ARTICLES_FIELD, childrenReferencesValidator)
    })
  })
  describe('Order element deletion', () => {
    const testValidator = async (orderInstance: InstanceElement) : Promise<void> => {
      const orderWithoutParent = orderInstance.clone()
      const fakeParent = new InstanceElement('test', new ObjectType({ elemID: new ElemID(ZENDESK, 'test') }))
      orderWithoutParent.annotations[CORE_ANNOTATIONS.PARENT] = [{ value: fakeParent }]

      const changes = [
        toChange({ before: orderInstance }),
        toChange({ before: orderWithoutParent }),
        toChange({ before: getParent(orderInstance) }),
      ]
      const instanceName = orderInstance.elemID.name
      const parentName = fakeParent.elemID.getFullName()

      const errors = await guideOrderDeletionValidator(changes)
      expect(errors.length).toBe(1)
      expect(errors[0]).toMatchObject({
        elemID: orderInstance.elemID,
        severity: 'Error',
        message: 'Guide elements order list removed without its parent',
        detailedMessage: `Deleting ${instanceName} requires deleting its parent (${parentName})`,
      })
    }
    it('Categories order', async () => {
      await testValidator(categoryOrderInstance)
    })
    it('Category sections order', async () => {
      await testValidator(categorySectionsOrderInstance)
    })
    it('Section sections order', async () => {
      await testValidator(sectionSectionsOrderInstance)
    })
    it('Articles order', async () => {
      await testValidator(articleOrderInstance)
    })
  })
  describe('Children in order', () => {
    describe('Children elements added with and without order element', () => {
      const childChanges = [
        ...childrenInstances.map(child => toChange({ after: child })),
        ...childrenInstances.map(child => toChange({ before: child })),
        ...childrenInstances.map(child => toChange({ before: child, after: child })),
      ]
      const orderChanges = orderInstances.map(order => toChange({ after: order }))

      const testWithoutOrderInstances = async (
        validator: ChangeValidator,
        instance: InstanceElement,
        orderTypeName: string,
      ): Promise<void> => {
      // Remove the order change that has the tested element
        const otherOrderChanges = orderChanges.filter(change => getChangeData(change).elemID.typeName !== orderTypeName)
        const errors = await validator([...childChanges, ...otherOrderChanges])
        expect(errors).toMatchObject([{
          elemID: instance.elemID,
          severity: 'Warning',
          message: 'Order not specified',
          detailedMessage: `Element ${instance.elemID.name} of type ${instance.elemID.typeName} is not listed in ${instance.elemID.typeName} sort order.  Therefore, it will be added at the beginning by default.  If the order is important, please include it in ${orderTypeName}`,
        }])
      }

      it('With order element', async () => {
        const errors = await childInOrderValidator([...childChanges, ...orderChanges])
        expect(errors).toMatchObject([])
      })
      it('Without order element', async () => {
        await testWithoutOrderInstances(childInOrderValidator, categoryInstance, CATEGORY_ORDER_TYPE_NAME)
        await testWithoutOrderInstances(childInOrderValidator, sectionInstance, SECTION_ORDER_TYPE_NAME)
        await testWithoutOrderInstances(childInOrderValidator, articleInstance, ARTICLE_ORDER_TYPE_NAME)
      })
    })
    describe('Duplicate child in same order', () => {
      const createDuplicateChildError = (orderInstance: InstanceElement, child: ReferenceExpression): ChangeError => ({
        elemID: orderInstance.elemID,
        severity: 'Warning',
        message: 'Guide elements order list includes the same element more than once',
        detailedMessage: `${orderInstance.elemID.typeName} ${orderInstance.elemID.name} has the same element more than once, order will be determined by the last occurrence of the element, elements: '${child.elemID.getFullName()}'`,
      })

      it('Same child twice', async () => {
        const testOrderInstances = orderInstances.map(instance => instance.clone())
        const errorsToCheck: string[] = []
        // Fill the same child again
        testOrderInstances.forEach(instance => [ARTICLES_FIELD, SECTIONS_FIELD, CATEGORIES_FIELD].forEach(field => {
          if (instance.value[field] !== undefined) {
            // stringify to sort later
            errorsToCheck.push(safeJsonStringify(createDuplicateChildError(instance, instance.value[field][0])))
            instance.value[field].push(instance.value[field][0])
          }
        }))
        const changes = testOrderInstances.map(instance => toChange({ after: instance }))

        const errors = (await childInOrderValidator(changes)).map(error => safeJsonStringify(error))
        expect(errors.length).toBe(errorsToCheck.length)
        // Make sure all warnings were created
        expect(errors.sort()).toMatchObject(errorsToCheck.sort())
      })
    })
  })
  describe('Order and children parent tests', () => {
    const changeChildrenParent = (parent: ReferenceExpression): void =>
      childrenInstances.forEach(child => {
        child.value.section_id = parent
        child.value.brand = parent
        child.value.parent_section_id = parent
        child.value.category_id = parent
      })

    const changes = [
      toChange({ before: articleOrderInstance }),
      toChange({ before: sectionSectionsOrderInstance }),
      toChange({ before: categorySectionsOrderInstance }),
      toChange({ before: categoryOrderInstance }),
      toChange({ before: articleOrderInstance, after: articleOrderInstance }),
      toChange({ before: sectionSectionsOrderInstance, after: sectionSectionsOrderInstance }),
      toChange({ before: categorySectionsOrderInstance, after: categorySectionsOrderInstance }),
      toChange({ before: categoryOrderInstance, after: categoryOrderInstance }),
      toChange({ after: articleOrderInstance }),
      toChange({ after: sectionSectionsOrderInstance }),
      toChange({ after: categorySectionsOrderInstance }),
      toChange({ after: categoryOrderInstance }),
    ]

    const createError = (orderInstance: InstanceElement, wrongParentChildren: InstanceElement[]): ChangeError => ({
      elemID: orderInstance.elemID,
      severity: 'Error',
      message: 'Guide elements order list includes instances that are not of the same parent',
      detailedMessage: `${wrongParentChildren.map(child => child.elemID.getFullName()).join(', ')} are not of the same ${getParent(orderInstance).elemID.typeName} as ${orderInstance.elemID.name}`,
    })

    it('children with same parent as order', async () => {
      const brandRef = new ReferenceExpression(brandInstance.elemID, brandInstance)
      orderInstances.forEach(order => { order.annotations[CORE_ANNOTATIONS.PARENT] = brandRef })
      changeChildrenParent(brandRef)
      const errors = await orderChildrenParentValidator(changes)
      expect(errors.length).toBe(0)
    })
    it('children with different parent from order', async () => {
      changeChildrenParent(new ReferenceExpression(articleInstance.elemID, articleInstance))
      const errors = await orderChildrenParentValidator(changes)
      expect(errors.length).toBe(8)
      expect(errors[0]).toMatchObject(createError(articleOrderInstance, [articleInstance]))
      expect(errors[1]).toMatchObject(createError(articleOrderInstance, [articleInstance]))
      expect(errors[2]).toMatchObject(createError(sectionSectionsOrderInstance, [sectionInstance]))
      expect(errors[4]).toMatchObject(createError(sectionSectionsOrderInstance, [sectionInstance]))
      expect(errors[3]).toMatchObject(createError(categorySectionsOrderInstance, [sectionInstance]))
      expect(errors[5]).toMatchObject(createError(categorySectionsOrderInstance, [sectionInstance]))
      expect(errors[6]).toMatchObject(createError(categoryOrderInstance, [categoryInstance]))
      expect(errors[7]).toMatchObject(createError(categoryOrderInstance, [categoryInstance]))
    })
  })
})
