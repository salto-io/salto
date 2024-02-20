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
  InstanceElement,
  ObjectType,
  ElemID,
  toChange,
  ReferenceExpression,
  TemplateExpression,
} from '@salto-io/adapter-api'
import { elementSource } from '@salto-io/workspace'
import {
  AUTOMATION_TYPE_NAME,
  MACRO_TYPE_NAME,
  TRIGGER_TYPE_NAME,
  ZENDESK,
  DYNAMIC_CONTENT_ITEM_TYPE_NAME,
} from '../../src/constants'
import { dynamicContentDeletionValidator } from '../../src/change_validators'

const createDynamicContentInstance = (name: string): InstanceElement =>
  new InstanceElement(name, new ObjectType({ elemID: new ElemID(ZENDESK, DYNAMIC_CONTENT_ITEM_TYPE_NAME) }), {})

const createDynamicContentUserInstance = (
  name: string,
  type: typeof TRIGGER_TYPE_NAME | typeof MACRO_TYPE_NAME | typeof AUTOMATION_TYPE_NAME,
  dynamicContent: InstanceElement,
  shouldTemplateExpression = false,
): InstanceElement =>
  new InstanceElement(name, new ObjectType({ elemID: new ElemID(ZENDESK, type) }), {
    inner: {
      value: shouldTemplateExpression
        ? new TemplateExpression({ parts: ['a', new ReferenceExpression(dynamicContent.elemID), 'c'] })
        : new ReferenceExpression(dynamicContent.elemID),
    },
  })

describe('dynamicContentDeletionValidator', () => {
  let dynamicContent: InstanceElement
  let trigger: InstanceElement
  let macro: InstanceElement
  let automation: InstanceElement
  beforeEach(() => {
    dynamicContent = createDynamicContentInstance('dynamicContent')
    trigger = createDynamicContentUserInstance('trigger', TRIGGER_TYPE_NAME, dynamicContent)
    macro = createDynamicContentUserInstance('macro', MACRO_TYPE_NAME, dynamicContent)
    automation = createDynamicContentUserInstance('automation', AUTOMATION_TYPE_NAME, dynamicContent, true)
  })
  it('should error if the dynamic content is being used', async () => {
    const changes = [toChange({ before: dynamicContent })]
    const elementsSource = elementSource.createInMemoryElementSource([dynamicContent, trigger, macro, automation])
    const errors = await dynamicContentDeletionValidator(changes, elementsSource)
    expect(errors).toMatchObject([
      {
        elemID: dynamicContent.elemID,
        severity: 'Error',
        message: 'Dynamic content is being used',
        detailedMessage:
          'This dynamic content cannot be deleted because it is being used by zendesk.automation.instance.automation, zendesk.macro.instance.macro, zendesk.trigger.instance.trigger',
      },
    ])
  })
  it('should not error if the user of the dynamic content is removed or modified without the dynamic content', async () => {
    const changes = [toChange({ before: dynamicContent })]
    trigger.value = {}
    const elementsSource = elementSource.createInMemoryElementSource([dynamicContent, trigger, macro, automation])
    const errors = await dynamicContentDeletionValidator(changes, elementsSource)

    // Notice there are only 2 used by now, instead of 3
    expect(errors).toMatchObject([
      {
        elemID: dynamicContent.elemID,
        severity: 'Error',
        message: 'Dynamic content is being used',
        detailedMessage:
          'This dynamic content cannot be deleted because it is being used by zendesk.automation.instance.automation, zendesk.macro.instance.macro',
      },
    ])
  })
  it('should not error on other type the use the dynamic content', async () => {
    const changes = [toChange({ before: dynamicContent })]
    const otherType = new InstanceElement('other', new ObjectType({ elemID: new ElemID(ZENDESK, 'other') }), {
      value: new ReferenceExpression(dynamicContent.elemID),
    })
    const elementsSource = elementSource.createInMemoryElementSource([dynamicContent, otherType])
    const errors = await dynamicContentDeletionValidator(changes, elementsSource)
    expect(errors).toMatchObject([])
  })
})
