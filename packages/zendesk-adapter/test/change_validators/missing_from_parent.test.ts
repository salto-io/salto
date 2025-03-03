/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  AdditionChange,
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { elementSource } from '@salto-io/workspace'
import { definitions as definitionsUtils } from '@salto-io/adapter-components'
import { ZENDESK, CUSTOM_FIELD_OPTIONS_FIELD_NAME } from '../../src/constants'
import { missingFromParentValidatorCreator } from '../../src/change_validators/child_parent/missing_from_parent'
import { createFetchDefinitions } from '../../src/definitions'
import { Options } from '../../src/definitions/types'

describe('missingFromParentValidatorCreator', () => {
  const definitions = {
    fetch: { ...createFetchDefinitions({}) },
  } as unknown as definitionsUtils.ApiDefinitions<Options>
  const ticketFieldType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'ticket_field'),
  })
  const ticketFieldOptionType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'ticket_field__custom_field_options'),
  })
  const option1 = new InstanceElement('option1', ticketFieldOptionType, { name: 'test1', value: 'v1' })
  const option2 = new InstanceElement('option2', ticketFieldOptionType, { name: 'test2', value: 'v2' })
  const option3 = new InstanceElement('option3', ticketFieldOptionType, { name: 'test3', value: 'v3' })
  const ticketField = new InstanceElement('field', ticketFieldType, {
    name: 'test1',
    [CUSTOM_FIELD_OPTIONS_FIELD_NAME]: [new ReferenceExpression(option1.elemID, option1)],
  })
  option1.annotations[CORE_ANNOTATIONS.PARENT] = [new ReferenceExpression(ticketField.elemID, ticketField)]
  option2.annotations[CORE_ANNOTATIONS.PARENT] = [new ReferenceExpression(ticketField.elemID, ticketField)]
  option3.annotations[CORE_ANNOTATIONS.PARENT] = [new ReferenceExpression(ticketField.elemID, ticketField)]
  it('should return an error when we add an option instance but it does not exist in the parent - parent modified', async () => {
    const clonedTicketField = ticketField.clone()
    clonedTicketField.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] = [
      new ReferenceExpression(option1.elemID, option1),
      new ReferenceExpression(option2.elemID, option2),
    ]
    const addOption3 = toChange({ after: option3 }) as AdditionChange<InstanceElement>
    const errors = await missingFromParentValidatorCreator(definitions)(
      [toChange({ after: option2 }), addOption3, toChange({ before: ticketField, after: clonedTicketField })],
      elementSource.createInMemoryElementSource([clonedTicketField, ticketFieldType]),
    )
    expect(errors).toEqual([
      {
        elemID: option3.elemID,
        severity: 'Error',
        message: 'Element needs to be referred from its parent',
        detailedMessage: `To add this ${option3.elemID.typeName}, please make sure ${option3.elemID.getFullName()} is included in ‘${ticketField.elemID.getFullName()}’. You can learn more about this deployment preview error here: https://help.salto.io/en/articles/9582618-element-needs-to-be-referred-from-its-parent`,
      },
    ])
  })
  it('should return an error when we add an option instance but it does not exist in the parent - parent is not modified', async () => {
    const errors = await missingFromParentValidatorCreator(definitions)(
      [toChange({ after: option2 })],
      elementSource.createInMemoryElementSource([ticketField, ticketFieldType]),
    )
    expect(errors).toEqual([
      {
        elemID: option2.elemID,
        severity: 'Error',
        message: 'Element needs to be referred from its parent',
        detailedMessage: `To add this ${option2.elemID.typeName}, please make sure ${option2.elemID.getFullName()} is included in ‘${ticketField.elemID.getFullName()}’. You can learn more about this deployment preview error here: https://help.salto.io/en/articles/9582618-element-needs-to-be-referred-from-its-parent`,
      },
    ])
  })
  it('should not return an error when we add an option and add it to the parent as well', async () => {
    const clonedTicketField = ticketField.clone()
    clonedTicketField.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] = [
      new ReferenceExpression(option1.elemID, option1),
      new ReferenceExpression(option2.elemID, option2),
    ]
    const errors = await missingFromParentValidatorCreator(definitions)(
      [toChange({ after: option2 }), toChange({ before: ticketField, after: clonedTicketField })],
      elementSource.createInMemoryElementSource([clonedTicketField, ticketFieldType]),
    )
    expect(errors).toEqual([])
  })
})
