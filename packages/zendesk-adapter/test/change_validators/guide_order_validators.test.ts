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
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression, toChange,
} from '@salto-io/adapter-api'
import { getParent } from '@salto-io/adapter-utils'
import { ARTICLE_TYPE_NAME, BRAND_TYPE_NAME, CATEGORY_TYPE_NAME, SECTION_TYPE_NAME, ZENDESK } from '../../src/constants'
import {
  ARTICLES_FIELD,
  CATEGORIES_FIELD,
  createOrderType,
  SECTIONS_FIELD,
} from '../../src/filters/guide_order/guide_orders_utils'
import {
  categoriesOrderValidator,
  sectionsOrderValidator,
  articlesOrderValidator,
  guideOrderDeletionValidator,
} from '../../src/change_validators'

const brandType = new ObjectType({ elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME) })
const categoryType = new ObjectType({ elemID: new ElemID(ZENDESK, CATEGORY_TYPE_NAME) })
const sectionType = new ObjectType({ elemID: new ElemID(ZENDESK, SECTION_TYPE_NAME) })

const brandInstance = new InstanceElement('brand', brandType)
const categoryInstance = new InstanceElement('category', categoryType)
const sectionInstance = new InstanceElement('section', sectionType)

const createOrderElement = (
  parent: InstanceElement,
  orderElementType: string,
  orderField: string
) : InstanceElement =>
  new InstanceElement(
    `${parent.elemID.name}_${orderField}`,
    createOrderType(orderElementType),
    {
      [orderField]: [new ReferenceExpression(sectionInstance.elemID, sectionInstance)],
    }, [],
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parent.elemID, parent)] }
  )

const categoriesOrderInstance = createOrderElement(
  brandInstance, CATEGORY_TYPE_NAME, CATEGORIES_FIELD
)
const categorySectionsOrderInstance = createOrderElement(
  categoryInstance, SECTION_TYPE_NAME, SECTIONS_FIELD
)
const sectionSectionsOrderInstance = createOrderElement(
  sectionInstance, SECTION_TYPE_NAME, SECTIONS_FIELD
)
const articlesOrderInstance = createOrderElement(
  sectionInstance, ARTICLE_TYPE_NAME, ARTICLES_FIELD
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
        message: `${orderField} field error`,
        detailedMessage: `Some ${orderField} elements are not a reference`,
      })
    }

    it('Categories order', async () => {
      await testValidator(categoriesOrderInstance, CATEGORIES_FIELD, categoriesOrderValidator)
    })
    it('Category sections order', async () => {
      await testValidator(
        categorySectionsOrderInstance, SECTIONS_FIELD, sectionsOrderValidator
      )
    })
    it('Section sections order', async () => {
      await testValidator(
        sectionSectionsOrderInstance, SECTIONS_FIELD, sectionsOrderValidator
      )
    })
    it('Articles order', async () => {
      await testValidator(articlesOrderInstance, ARTICLES_FIELD, articlesOrderValidator)
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

      const errors = await guideOrderDeletionValidator(changes)
      expect(errors.length).toBe(1)
      expect(errors[0]).toMatchObject({
        elemID: orderInstance.elemID,
        severity: 'Error',
        message: `Error removing ${instanceName}`,
        detailedMessage: `Unable to remove this element without removing it's parent (${parentName})`,
      })
    }
    it('Categories order', async () => {
      await testValidator(categoriesOrderInstance)
    })
    it('Category sections order', async () => {
      await testValidator(categorySectionsOrderInstance)
    })
    it('Section sections order', async () => {
      await testValidator(sectionSectionsOrderInstance)
    })
    it('Articles order', async () => {
      await testValidator(articlesOrderInstance)
    })
  })
})
