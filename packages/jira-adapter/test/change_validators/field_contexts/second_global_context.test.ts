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
import { ObjectType, ElemID, ReadOnlyElementsSource, InstanceElement, ReferenceExpression, toChange, Change, ChangeDataType, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { FIELD_CONTEXT_TYPE_NAME, FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'
import { JIRA } from '../../../src/constants'
import { fieldSecondGlobalContextValidator } from '../../../src/change_validators/field_contexts/second_global_context'

const mockLogError = jest.fn()
jest.mock('@salto-io/logging', () => ({
  ...jest.requireActual<{}>('@salto-io/logging'),
  logger: jest.fn()
    .mockReturnValue({
      error: jest.fn((...args) => mockLogError(...args)),
    }),
}))

describe('Field second global contexts', () => {
  let contextType: ObjectType
  let fieldType: ObjectType
  let elementsSource: ReadOnlyElementsSource
  let elements: InstanceElement[]
  let firstGlobalContextInstance: InstanceElement
  let secondGlobalContextInstance: InstanceElement
  let fieldInstance: InstanceElement
  let changes: ReadonlyArray<Change<ChangeDataType>>

  beforeEach(() => {
    jest.clearAllMocks()
    contextType = new ObjectType({ elemID: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME) })
    fieldType = new ObjectType({ elemID: new ElemID(JIRA, FIELD_TYPE_NAME) })

    fieldInstance = new InstanceElement(
      'field_name',
      fieldType,
    )

    firstGlobalContextInstance = new InstanceElement(
      'instance',
      contextType,
      {
        isGlobalContext: true,
      },
      undefined,
      { _parent: [new ReferenceExpression(fieldInstance.elemID, fieldInstance)] }
    )
    fieldInstance.value.contexts = [
      new ReferenceExpression(firstGlobalContextInstance.elemID, firstGlobalContextInstance),
    ]

    secondGlobalContextInstance = new InstanceElement(
      'instance2',
      contextType,
      {
        isGlobalContext: true,
      },
      undefined,
      { _parent: [new ReferenceExpression(fieldInstance.elemID, fieldInstance)] }
    )

    elements = [fieldInstance, firstGlobalContextInstance]
    elementsSource = buildElementsSourceFromElements(elements)
    changes = elements.map(element => toChange({ after: element }))
  })

  it('should not return error when setting one global context to the field', async () => {
    expect(await fieldSecondGlobalContextValidator(
      changes,
      elementsSource
    )).toEqual([])
  })
  it('should not return changes when its not global context change', async () => {
    const notGlobalContextInstance = new InstanceElement(
      'notGlobal',
      contextType,
      undefined,
      undefined,
      { _parent: [new ReferenceExpression(fieldInstance.elemID, fieldInstance)] }
    )
    elements = [notGlobalContextInstance]
    elementsSource = buildElementsSourceFromElements(elements)
    changes = [toChange({ after: notGlobalContextInstance })]
    expect(await fieldSecondGlobalContextValidator(
      changes,
      elementsSource
    )).toEqual([])
  })
  it('should log error if elementSource is undefined', async () => {
    expect(await fieldSecondGlobalContextValidator(
      changes,
    )).toEqual([])
    expect(mockLogError).toHaveBeenCalledWith('Failed to run fieldSecondGlobalContextValidator because element source is undefined')
  })

  it('should return error when setting two global contexts to a field', async () => {
    fieldInstance.value.contexts.push(
      new ReferenceExpression(secondGlobalContextInstance.elemID, secondGlobalContextInstance)
    )
    elements = [fieldInstance, firstGlobalContextInstance, secondGlobalContextInstance]
    elementsSource = buildElementsSourceFromElements(elements)
    changes = elements.map(element => toChange({ after: element }))
    expect(await fieldSecondGlobalContextValidator(
      changes,
      elementsSource
    )).toEqual([
      {
        elemID: firstGlobalContextInstance.elemID,
        severity: 'Error',
        message: 'A field can only have a single global context',
        detailedMessage: 'Can\'t deploy this global context because the deployment will result in more than a single global context for field jira.Field.instance.field_name.',
      },
      {
        elemID: secondGlobalContextInstance.elemID,
        severity: 'Error',
        message: 'A field can only have a single global context',
        detailedMessage: 'Can\'t deploy this global context because the deployment will result in more than a single global context for field jira.Field.instance.field_name.',
      },
    ])
  })
  it('should return error when setting two global contexts to a field with alias', async () => {
    fieldInstance.annotations[CORE_ANNOTATIONS.ALIAS] = 'beautiful name'
    fieldInstance.value.contexts.push(
      new ReferenceExpression(secondGlobalContextInstance.elemID, secondGlobalContextInstance)
    )
    elements = [fieldInstance, firstGlobalContextInstance, secondGlobalContextInstance]
    elementsSource = buildElementsSourceFromElements(elements)
    changes = elements.map(element => toChange({ after: element }))
    expect(await fieldSecondGlobalContextValidator(
      changes,
      elementsSource
    )).toEqual([
      {
        elemID: firstGlobalContextInstance.elemID,
        severity: 'Error',
        message: 'A field can only have a single global context',
        detailedMessage: 'Can\'t deploy this global context because the deployment will result in more than a single global context for field beautiful name.',
      },
      {
        elemID: secondGlobalContextInstance.elemID,
        severity: 'Error',
        message: 'A field can only have a single global context',
        detailedMessage: 'Can\'t deploy this global context because the deployment will result in more than a single global context for field beautiful name.',
      },
    ])
  })
  it('should return error when adding two global contexts to a field without global context', async () => {
    fieldInstance.value.contexts = []
    elements = [firstGlobalContextInstance, secondGlobalContextInstance]
    elementsSource = buildElementsSourceFromElements(elements)
    changes = elements.map(element => toChange({ after: element }))
    expect(await fieldSecondGlobalContextValidator(
      changes,
      elementsSource
    )).toEqual([
      {
        elemID: firstGlobalContextInstance.elemID,
        severity: 'Error',
        message: 'A field can only have a single global context',
        detailedMessage: 'Can\'t deploy this global context because the deployment will result in more than a single global context for field jira.Field.instance.field_name.',
      },
      {
        elemID: secondGlobalContextInstance.elemID,
        severity: 'Error',
        message: 'A field can only have a single global context',
        detailedMessage: 'Can\'t deploy this global context because the deployment will result in more than a single global context for field jira.Field.instance.field_name.',
      },
    ])
  })
})
