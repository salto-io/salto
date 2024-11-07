/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, toChange, ReferenceExpression, ObjectType, ElemID } from '@salto-io/adapter-api'
import { references as referencesUtils } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { MACRO_TYPE_NAME, TICKET_FIELD_TYPE_NAME, TRIGGER_TYPE_NAME, ZENDESK } from '../../src/constants'
import { modifiedAndDeletedDependencyChanger } from '../../src/dependency_changers/modified_and_deleted'

const { createMissingInstance } = referencesUtils

describe('macroAndTicketFieldDependencyChanger', () => {
  const macroType = new ObjectType({ elemID: new ElemID(ZENDESK, MACRO_TYPE_NAME) })
  const ticketFieldType = new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FIELD_TYPE_NAME) })
  const macro = new InstanceElement('macro', macroType, {
    actions: [],
  })
  const ticketField1 = new InstanceElement('field1', ticketFieldType, {})
  const ticketField2 = new InstanceElement('field2', ticketFieldType, {})

  it('should add dependency from deleted ticket to the macro', async () => {
    const macroBefore = macro.clone()
    macroBefore.value.actions = [{ field: new ReferenceExpression(ticketField1.elemID) }]
    const macroAfter = macro.clone()
    macroAfter.value.actions = [{ field: new ReferenceExpression(ticketField2.elemID) }]
    const inputChanges = new Map([
      [0, toChange({ before: ticketField1 })],
      [1, toChange({ before: macroBefore, after: macroAfter })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
      [0, new Set()],
      [1, new Set()],
    ])

    const dependencyChanges = [...(await modifiedAndDeletedDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges.length).toBe(1)
    expect(dependencyChanges.every(change => change.action === 'add')).toBe(true)
    expect(dependencyChanges[0].dependency).toMatchObject({ source: 0, target: 1 })
  })
  it('should not add dependency from deleted ticket to the macro if it is a missingReference', async () => {
    const missingTicket = createMissingInstance(ZENDESK, TICKET_FIELD_TYPE_NAME, 'ticket')
    const macroBefore = macro.clone()
    macroBefore.value.actions = [{ field: new ReferenceExpression(missingTicket.elemID) }]
    const macroAfter = macro.clone()
    macroAfter.value.actions = [{ field: new ReferenceExpression(ticketField2.elemID) }]
    const inputChanges = new Map([
      [0, toChange({ before: missingTicket })],
      [1, toChange({ before: macroBefore, after: macroAfter })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
      [0, new Set()],
      [1, new Set()],
    ])

    const dependencyChanges = [...(await modifiedAndDeletedDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges.length).toBe(0)
  })
  it('should not add dependency if there is no reference from the macro', async () => {
    const macroBefore = macro.clone()
    macroBefore.value.actions = []
    const macroAfter = macro.clone()
    macroAfter.value.actions = [{ field: new ReferenceExpression(ticketField2.elemID) }]
    const inputChanges = new Map([
      [0, toChange({ before: ticketField1 })],
      [1, toChange({ before: macroBefore, after: macroAfter })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
      [0, new Set()],
      [1, new Set()],
    ])

    const dependencyChanges = [...(await modifiedAndDeletedDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges.length).toBe(0)
  })
  it('should not add dependency if the reference is not to a ticket field', async () => {
    const trigger = new InstanceElement(
      'trigger',
      new ObjectType({ elemID: new ElemID(ZENDESK, TRIGGER_TYPE_NAME) }),
      {},
    )
    const macroBefore = macro.clone()
    macroBefore.value.actions = [{ field: new ReferenceExpression(trigger.elemID) }]
    const macroAfter = macro.clone()
    macroAfter.value.actions = [{ field: new ReferenceExpression(ticketField2.elemID) }]
    const inputChanges = new Map([
      [0, toChange({ before: trigger })],
      [1, toChange({ before: macroBefore, after: macroAfter })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
      [0, new Set()],
      [1, new Set()],
    ])

    const dependencyChanges = [...(await modifiedAndDeletedDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges.length).toBe(0)
  })
  it('should not add dependency if the actions are not in the right format', async () => {
    const macroBefore = macro.clone()
    macroBefore.value.actions = [{ value: new ReferenceExpression(ticketField1.elemID) }]
    const macroAfter = macro.clone()
    macroAfter.value.actions = [{ field: new ReferenceExpression(ticketField2.elemID) }]
    const inputChanges = new Map([
      [0, toChange({ before: ticketField1 })],
      [1, toChange({ before: macroBefore, after: macroAfter })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
      [0, new Set()],
      [1, new Set()],
    ])

    const dependencyChanges = [...(await modifiedAndDeletedDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges.length).toBe(0)
  })
  it('should not add dependency if there are no actions', async () => {
    const macroBefore = macro.clone()
    const macroAfter = macro.clone()
    macroAfter.value.actions = [{ field: new ReferenceExpression(ticketField2.elemID) }]
    const inputChanges = new Map([
      [0, toChange({ before: ticketField1 })],
      [1, toChange({ before: macroBefore, after: macroAfter })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
      [0, new Set()],
      [1, new Set()],
    ])

    const dependencyChanges = [...(await modifiedAndDeletedDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges.length).toBe(0)
  })
})
