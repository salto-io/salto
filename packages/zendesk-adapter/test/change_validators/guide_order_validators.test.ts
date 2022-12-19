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
  ChangeValidator,
  CORE_ANNOTATIONS,
  ElemID, getChangeData,
  InstanceElement,
  ObjectType,
  ReferenceExpression, toChange,
} from '@salto-io/adapter-api'
import { getParent } from '@salto-io/adapter-utils'
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
  categoryOrderValidator,
  sectionOrderValidator,
  articleOrderValidator,
  guideOrderValidator,
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
) : InstanceElement =>
  new InstanceElement(
    `${parent.elemID.name}_${orderField}`,
    createOrderType(orderElementType),
    {
      [orderField]: [new ReferenceExpression(childInstance.elemID, childInstance)],
    }, [],
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parent.elemID, parent)] }
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
        message: 'Guide elements order list includes an invalid Salto reference',
        detailedMessage: `One or more elements in ${orderInstance.elemID.getFullName()}'s ${orderField} field are not a valid Salto reference`,
      })
    }

    it('Categories order', async () => {
      await testValidator(categoryOrderInstance, CATEGORIES_FIELD, categoryOrderValidator)
    })
    it('Category sections order', async () => {
      await testValidator(
        categorySectionsOrderInstance, SECTIONS_FIELD, sectionOrderValidator
      )
    })
    it('Section sections order', async () => {
      await testValidator(
        sectionSectionsOrderInstance, SECTIONS_FIELD, sectionOrderValidator
      )
    })
    it('Articles order', async () => {
      await testValidator(articleOrderInstance, ARTICLES_FIELD, articleOrderValidator)
    })
  })
  describe('Order element removal', () => {
    const testValidator = async (orderInstance: InstanceElement) : Promise<void> => {
      const orderWithoutParent = orderInstance.clone()
      const fakeParent = new InstanceElement('test', new ObjectType({ elemID: new ElemID(ZENDESK, 'test') }))
      orderWithoutParent.annotations[CORE_ANNOTATIONS.PARENT] = [{ value: fakeParent }]

      const changes = [
        toChange({ before: orderInstance }),
        toChange({ before: orderWithoutParent }),
        toChange({ before: getParent(orderInstance) }),
      ]
      const instanceName = orderInstance.elemID.getFullName()
      const parentName = fakeParent.elemID.getFullName()

      const errors = await guideOrderValidator(changes)
      expect(errors.length).toBe(1)
      expect(errors[0]).toMatchObject({
        elemID: orderInstance.elemID,
        severity: 'Error',
        message: 'Guide order elements removed without their parent',
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
  describe('Children elements added with and without order element', () => {
    const orderInstances = [
      categoryOrderInstance,
      categorySectionsOrderInstance,
      sectionSectionsOrderInstance,
      articleOrderInstance,
    ]
    const childrenInstances = [categoryInstance, sectionInstance, articleInstance]
    const childChanges = [
      ...childrenInstances.map(child => toChange({ after: child })),
      ...childrenInstances.map(child => toChange({ before: child })),
      ...childrenInstances.map(child => toChange({ before: child, after: child })),
    ]
    const orderChanges = orderInstances.map(order => toChange({ after: order }))

    const testValidatorWithOrderInstances = async (validator: ChangeValidator): Promise<void> => {
      const errors = await validator([...childChanges, ...orderChanges])
      expect(errors).toMatchObject([])
    }

    const testValidatorWithoutOrderInstances = async (
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
        message: `Instance element not specified in ${orderTypeName}`,
        detailedMessage: `Instance ${instance.elemID.name} of type '${instance.elemID.typeName}' is not listed in ${orderTypeName}, and will be added to be first by default. If order is important, please include it under the ${orderTypeName}`,
      }])
    }

    const testValidatorWithUndefinedOrderField = async (
      validator: ChangeValidator,
      orderField: string,
    ): Promise<void> => {
      const emptyOrderChanges = orderChanges.map(change => {
        const emptyOrderInstance = getChangeData(change).clone()
        delete emptyOrderInstance.value[orderField]
        return toChange({ after: emptyOrderInstance })
      })
      const errors = await validator([...childChanges, ...emptyOrderChanges])
      expect(errors).toMatchObject([])
    }

    it('With order element', async () => {
      await testValidatorWithOrderInstances(categoryOrderValidator)
      await testValidatorWithOrderInstances(sectionOrderValidator)
      await testValidatorWithOrderInstances(articleOrderValidator)
    })
    it('Without order element', async () => {
      await testValidatorWithoutOrderInstances(categoryOrderValidator, categoryInstance, CATEGORY_ORDER_TYPE_NAME)
      await testValidatorWithoutOrderInstances(sectionOrderValidator, sectionInstance, SECTION_ORDER_TYPE_NAME)
      await testValidatorWithoutOrderInstances(articleOrderValidator, articleInstance, ARTICLE_ORDER_TYPE_NAME)
    })
    it('with order element with undefined order field', async () => {
      await testValidatorWithUndefinedOrderField(categoryOrderValidator, CATEGORIES_FIELD)
      await testValidatorWithUndefinedOrderField(sectionOrderValidator, SECTIONS_FIELD)
      await testValidatorWithUndefinedOrderField(articleOrderValidator, ARTICLES_FIELD)
    })
  })
})
