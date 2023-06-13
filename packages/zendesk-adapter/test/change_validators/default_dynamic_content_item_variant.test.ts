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

import { ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { ZENDESK } from '../../src/constants'
import {
  DYNAMIC_CONTENT_ITEM_TYPE_NAME,
  DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME,
} from '../../src/filters/dynamic_content'
import { defaultDynamicContentItemVariantValidator } from '../../src/change_validators'

const dynamicContentItem = new InstanceElement(
  'item',
  new ObjectType({ elemID: new ElemID(ZENDESK, DYNAMIC_CONTENT_ITEM_TYPE_NAME) }),
  { variants: [] }
)

const defaultVariant = new InstanceElement(
  'defaultVariant',
  new ObjectType({ elemID: new ElemID(ZENDESK, DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME) }),
  { default: true },
  [],
  {
    _parent: new ReferenceExpression(dynamicContentItem.elemID, dynamicContentItem),
  }
)

const notDefaultVariant = new InstanceElement(
  'notDefaultVariant',
  new ObjectType({ elemID: new ElemID(ZENDESK, DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME) }),
  { default: false },
  [],
  {
    _parent: new ReferenceExpression(dynamicContentItem.elemID, dynamicContentItem),
  }
)

const setDynamicContentItemVariants = (variants: InstanceElement[]): void => {
  dynamicContentItem.value.variants = variants.map(variant => new ReferenceExpression(variant.elemID, variant))
}

describe('defaultDynamicContentItemVariantValidator', () => {
  beforeEach(() => {
    dynamicContentItem.value.variants = []
  })
  it('should error when the default variant was removed without a new one', async () => {
    const changes = [
      toChange({ before: defaultVariant, after: notDefaultVariant }),
      toChange({ before: defaultVariant }),
    ]
    setDynamicContentItemVariants([notDefaultVariant])
    const errors = await defaultDynamicContentItemVariantValidator(changes)
    expect(errors).toMatchObject([
      {
        elemID: notDefaultVariant.elemID,
        severity: 'Error',
        message: 'Dynamic content item must have a default variant',
        detailedMessage: 'This variant was set as default, you must set another variant as default before removing this one',
      },
      {
        elemID: defaultVariant.elemID,
        severity: 'Error',
        message: 'Dynamic content item must have a default variant',
        detailedMessage: 'This variant was set as default, you must set another variant as default before removing this one',
      },
    ])
  })
  it('should not error when the default variant was removed and a new one was added', async () => {
    const changes = [
      toChange({ before: defaultVariant, after: notDefaultVariant }),
      toChange({ before: notDefaultVariant, after: defaultVariant }),
    ]
    setDynamicContentItemVariants([defaultVariant, notDefaultVariant])
    const errors = await defaultDynamicContentItemVariantValidator(changes)
    expect(errors.length).toBe(0)
  })
  it('should do nothing on removal and modification of non-default variants', async () => {
    const changes = [
      toChange({ before: notDefaultVariant, after: notDefaultVariant }),
      toChange({ before: notDefaultVariant }),
    ]
    setDynamicContentItemVariants([notDefaultVariant])
    const errors = await defaultDynamicContentItemVariantValidator(changes)
    expect(errors.length).toBe(0)
  })
  it('should do nothing on modification of a default variant the stays default', async () => {
    const changes = [
      toChange({ before: defaultVariant, after: defaultVariant }),
    ]
    // notDefaultVariant to make sure it doesn't reach the error case
    setDynamicContentItemVariants([notDefaultVariant])
    const errors = await defaultDynamicContentItemVariantValidator(changes)
    expect(errors.length).toBe(0)
  })
})
