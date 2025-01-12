/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ObjectType, InstanceElement, ElemID, toChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { customFieldOptionDependencyChanger } from '../../src/dependency_changers/custom_field_option_change'
import { ZENDESK } from '../../src/constants'

describe('customFieldsOptionsDependencyChanger', () => {
  const ticketFieldType = new ObjectType({ elemID: new ElemID(ZENDESK, 'ticket_field') })
  const ticketFieldOptionType = new ObjectType({ elemID: new ElemID(ZENDESK, 'ticket_field__custom_field_options') })
  const ticketFieldOption1 = new InstanceElement('option1', ticketFieldOptionType, { name: 'v1', value: 'v1' })
  const ticketFieldOption2 = new InstanceElement('option2', ticketFieldOptionType, { name: 'v2', value: 'v2' })

  it('should add dependency from the modified instance to the other in the right order', async () => {
    const ticketFieldOption1After = ticketFieldOption1.clone()
    ticketFieldOption1After.value.value = 'v3'
    const ticketFieldOption2After = ticketFieldOption2.clone()
    ticketFieldOption2After.value.value = 'v1'
    const checkboxTicketField = new InstanceElement('checkbox', ticketFieldType, {
      type: 'checkbox',
      title: 'myCheckbox',
      tag: 'v2',
    })
    const inputChanges = new Map([
      [0, toChange({ before: ticketFieldOption2, after: ticketFieldOption2After })],
      [1, toChange({ before: ticketFieldOption1, after: ticketFieldOption1After })],
      [2, toChange({ after: checkboxTicketField })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
      [0, new Set()],
      [1, new Set()],
      [2, new Set()],
    ])

    const dependencyChanges = [...(await customFieldOptionDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(2)
    expect([
      dependencyChanges[0].action,
      dependencyChanges[0].dependency.source,
      dependencyChanges[0].dependency.target,
    ]).toEqual(['add', 2, 0])
    expect([
      dependencyChanges[1].action,
      dependencyChanges[1].dependency.source,
      dependencyChanges[1].dependency.target,
    ]).toEqual(['add', 0, 1])
  })

  it('should add dependency from the removed to the modified instance', async () => {
    const ticketFieldOption2After = ticketFieldOption2.clone()
    ticketFieldOption2After.value.value = 'v1'
    const inputChanges = new Map([
      [0, toChange({ before: ticketFieldOption1 })],
      [1, toChange({ before: ticketFieldOption2, after: ticketFieldOption2After })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
      [0, new Set()],
      [1, new Set()],
    ])

    const dependencyChanges = [...(await customFieldOptionDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(1)
    expect(dependencyChanges[0].action).toEqual('add')
    expect(dependencyChanges[0].dependency.source).toEqual(1)
    expect(dependencyChanges[0].dependency.target).toEqual(0)
  })
})
