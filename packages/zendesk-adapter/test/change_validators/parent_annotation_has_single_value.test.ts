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
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { ZENDESK } from '../../src/constants'
import {
  parentAnnotationToHaveSingleValueValidatorCreator,
} from '../../src/change_validators/child_parent/parent_annotation_has_single_value'
import { CUSTOM_FIELD_OPTIONS_FIELD_NAME } from '../../src/filters/custom_field_options/creator'
import { API_DEFINITIONS_CONFIG, DEFAULT_CONFIG } from '../../src/config'

describe('parentAnnotationToHaveSingleValueValidatorCreator', () => {
  const ticketFieldType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'ticket_field'),
  })
  const ticketFieldOptionType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'ticket_field__custom_field_options'),
  })
  const anotherType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'test'),
  })
  const option1 = new InstanceElement(
    'option1', ticketFieldOptionType, { name: 'test1', value: 'v1' },
  )
  const ticketField1 = new InstanceElement(
    'field1',
    ticketFieldType,
    {
      name: 'test1',
      [CUSTOM_FIELD_OPTIONS_FIELD_NAME]: [
        new ReferenceExpression(option1.elemID, option1),
      ],
    },
  )
  const ticketField2 = new InstanceElement(
    'field2',
    ticketFieldType,
    {
      name: 'test2',
      [CUSTOM_FIELD_OPTIONS_FIELD_NAME]: [
        new ReferenceExpression(option1.elemID, option1),
      ],
    },
  )
  const anotherInstance = new InstanceElement('test', anotherType)
  it('should return an error when there are more than one parent', async () => {
    const clonedOption = option1.clone()
    clonedOption.annotations[CORE_ANNOTATIONS.PARENT] = [
      new ReferenceExpression(ticketField1.elemID, ticketField1),
      new ReferenceExpression(ticketField2.elemID, ticketField2),
    ]
    const errors = await parentAnnotationToHaveSingleValueValidatorCreator(
      DEFAULT_CONFIG[API_DEFINITIONS_CONFIG]
    )([
      toChange({ after: clonedOption }),
    ])
    expect(errors).toEqual([{
      elemID: clonedOption.elemID,
      severity: 'Error',
      message: 'Cannot change an element with zero or multiple parents',
      detailedMessage: 'Please make sure to set exactly one parent for this element',
    }])
  })
  it('should return an error when the parent annotation is an empty list', async () => {
    const clonedOption = option1.clone()
    clonedOption.annotations[CORE_ANNOTATIONS.PARENT] = []
    const errors = await parentAnnotationToHaveSingleValueValidatorCreator(
      DEFAULT_CONFIG[API_DEFINITIONS_CONFIG]
    )([
      toChange({ after: clonedOption }),
    ])
    expect(errors).toEqual([{
      elemID: clonedOption.elemID,
      severity: 'Error',
      message: 'Cannot change an element with zero or multiple parents',
      detailedMessage: 'Please make sure to set exactly one parent for this element',
    }])
  })
  it('should return an error when there is no parent annotation', async () => {
    const clonedOption = option1.clone()
    delete clonedOption.annotations[CORE_ANNOTATIONS.PARENT]
    const errors = await parentAnnotationToHaveSingleValueValidatorCreator(
      DEFAULT_CONFIG[API_DEFINITIONS_CONFIG]
    )([
      toChange({ after: clonedOption }),
    ])
    expect(errors).toEqual([{
      elemID: clonedOption.elemID,
      severity: 'Error',
      message: 'Cannot change an element with zero or multiple parents',
      detailedMessage: 'Please make sure to set exactly one parent for this element',
    }])
  })
  it('should return an error when there is one parent annotation but it is not a reference', async () => {
    const clonedOption = option1.clone()
    clonedOption.annotations[CORE_ANNOTATIONS.PARENT] = [123]
    const errors = await parentAnnotationToHaveSingleValueValidatorCreator(
      DEFAULT_CONFIG[API_DEFINITIONS_CONFIG]
    )([
      toChange({ after: clonedOption }),
    ])
    expect(errors).toEqual([{
      elemID: clonedOption.elemID,
      severity: 'Error',
      message: 'Cannot change an element with zero or multiple parents',
      detailedMessage: 'Please make sure to set exactly one parent for this element',
    }])
  })
  it('should not return an error when there is exactly one parent annotation', async () => {
    const clonedOption = option1.clone()
    clonedOption.annotations[CORE_ANNOTATIONS.PARENT] = [
      new ReferenceExpression(ticketField1.elemID, ticketField1),
    ]
    const errors = await parentAnnotationToHaveSingleValueValidatorCreator(
      DEFAULT_CONFIG[API_DEFINITIONS_CONFIG]
    )([
      toChange({ after: clonedOption }),
    ])
    expect(errors).toEqual([])
  })
  it('should not return an error when there is no parent annotations on a type that should not have one', async () => {
    const errors = await parentAnnotationToHaveSingleValueValidatorCreator(
      DEFAULT_CONFIG[API_DEFINITIONS_CONFIG]
    )([
      toChange({ after: anotherInstance }),
    ])
    expect(errors).toEqual([])
  })
})
