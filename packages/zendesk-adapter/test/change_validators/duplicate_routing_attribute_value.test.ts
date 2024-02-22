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
  CORE_ANNOTATIONS,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { elementSource as elementSourceUtils } from '@salto-io/workspace'
import { ROUTING_ATTRIBUTE_TYPE_NAME, ROUTING_ATTRIBUTE_VALUE_TYPE_NAME, ZENDESK } from '../../src/constants'
import { duplicateRoutingAttributeValueValidator } from '../../src/change_validators'

const { createInMemoryElementSource } = elementSourceUtils

const createAttributeValueInstance = (elemName: string, name: string, parent?: InstanceElement): InstanceElement =>
  new InstanceElement(
    elemName,
    new ObjectType({ elemID: new ElemID(ZENDESK, ROUTING_ATTRIBUTE_VALUE_TYPE_NAME) }),
    { name },
    undefined,
    parent ? { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parent.elemID)] } : undefined,
  )

describe('routingAttributeValueNameValidator', () => {
  let routingAttribute1: InstanceElement
  let routingAttribute2: InstanceElement

  beforeEach(() => {
    routingAttribute1 = new InstanceElement(
      'routingAttribute1',
      new ObjectType({ elemID: new ElemID(ZENDESK, ROUTING_ATTRIBUTE_TYPE_NAME) }),
    )
    routingAttribute2 = new InstanceElement(
      'routingAttribute2',
      new ObjectType({ elemID: new ElemID(ZENDESK, ROUTING_ATTRIBUTE_TYPE_NAME) }),
    )
  })

  it('should error on creation of a new routing attribute value with the same name and parent', async () => {
    const attributeValue1 = createAttributeValueInstance('attributeValue1', 'name', routingAttribute1)
    const attributeValue2 = createAttributeValueInstance('attributeValue2', 'name', routingAttribute1)
    const attributeValue3 = createAttributeValueInstance('attributeValue3', 'name', routingAttribute1)

    const elementSource = createInMemoryElementSource([attributeValue1, attributeValue2, attributeValue3])
    const changes = [toChange({ after: attributeValue1 }), toChange({ after: attributeValue2 })]

    const changeErrors = await duplicateRoutingAttributeValueValidator(changes, elementSource)
    expect(changeErrors).toMatchObject([
      {
        elemID: attributeValue1.elemID,
        severity: 'Error',
        message: 'Duplicate routing attribute value',
        detailedMessage: `This routing attribute value has the same name and is under the same routing attribute as '${attributeValue2.elemID.getFullName()}, ${attributeValue3.elemID.getFullName()}'`,
      },
      {
        elemID: attributeValue2.elemID,
        severity: 'Error',
        message: 'Duplicate routing attribute value',
        detailedMessage: `This routing attribute value has the same name and is under the same routing attribute as '${attributeValue1.elemID.getFullName()}, ${attributeValue3.elemID.getFullName()}'`,
      },
    ])
  })

  it('should not error on creation of a new routing attribute value with a different name but same parent', async () => {
    const attributeValue1 = createAttributeValueInstance('attributeValue1', 'name', routingAttribute1)
    const attributeValue2 = createAttributeValueInstance('attributeValue2', 'name2', routingAttribute1)

    const elementSource = createInMemoryElementSource([attributeValue1, attributeValue2])
    const changes = [toChange({ after: attributeValue1 })]

    const changeErrors = await duplicateRoutingAttributeValueValidator(changes, elementSource)
    expect(changeErrors).toMatchObject([])
  })

  it('should not error on creation of a new routing attribute value with a different parent but same name', async () => {
    const attributeValue1 = createAttributeValueInstance('attributeValue1', 'name', routingAttribute1)
    const attributeValue2 = createAttributeValueInstance('attributeValue2', 'name', routingAttribute2)

    const elementSource = createInMemoryElementSource([attributeValue1, attributeValue2])
    const changes = [toChange({ after: attributeValue1 })]

    const changeErrors = await duplicateRoutingAttributeValueValidator(changes, elementSource)
    expect(changeErrors).toMatchObject([])
  })

  it('should not crash when a value has no parent', async () => {
    const attributeValue1 = createAttributeValueInstance('attributeValue1', 'name')
    const attributeValue2 = createAttributeValueInstance('attributeValue2', 'name2')

    const elementSource = createInMemoryElementSource([attributeValue1, attributeValue2])
    const changes = [toChange({ after: attributeValue1 })]

    const changeErrors = await duplicateRoutingAttributeValueValidator(changes, elementSource)
    expect(changeErrors).toMatchObject([])
  })
})
