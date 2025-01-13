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
import {
  GUIDE_THEME_TYPE_NAME,
  MACRO_TYPE_NAME,
  THEME_SETTINGS_TYPE_NAME,
  TICKET_FIELD_TYPE_NAME,
  TRIGGER_CATEGORY_TYPE_NAME,
  TRIGGER_TYPE_NAME,
  ZENDESK,
} from '../../src/constants'
import { modifiedAndDeletedDependencyChanger } from '../../src/dependency_changers/modified_and_deleted'

const { createMissingInstance } = referencesUtils

describe('modifiedAndDeletedDependencyChanger', () => {
  describe('macro and ticket field', () => {
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
    it('should not add dependency if the reference is not from a macro', async () => {
      const trigger = new InstanceElement(
        'trigger',
        new ObjectType({ elemID: new ElemID(ZENDESK, TRIGGER_TYPE_NAME) }),
        {
          actions: [{ field: new ReferenceExpression(ticketField1.elemID) }],
        },
      )
      const triggerAfter = trigger.clone()
      trigger.value.actions = []
      const inputChanges = new Map([
        [0, toChange({ before: ticketField1 })],
        [1, toChange({ before: trigger, after: triggerAfter })],
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
  describe('trigger and ticket field', () => {
    const triggerType = new ObjectType({ elemID: new ElemID(ZENDESK, TRIGGER_TYPE_NAME) })
    const ticketFieldType = new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FIELD_TYPE_NAME) })
    const trigger = new InstanceElement('trigger', triggerType, {
      conditions: [],
    })
    const ticketField1 = new InstanceElement('field1', ticketFieldType, {})
    const ticketField2 = new InstanceElement('field2', ticketFieldType, {})
    it('should add dependency from deleted ticket to the trigger', async () => {
      const triggerBefore = trigger.clone()
      triggerBefore.value.conditions = { all: [{ field: new ReferenceExpression(ticketField1.elemID) }] }
      const triggerAfter = trigger.clone()
      triggerAfter.value.conditions = { all: [{ field: new ReferenceExpression(ticketField2.elemID) }] }
      const inputChanges = new Map([
        [0, toChange({ before: ticketField1 })],
        [1, toChange({ before: triggerBefore, after: triggerAfter })],
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
    it('should not add dependency from deleted ticket to the trigger if it is a missingReference', async () => {
      const missingTicket = createMissingInstance(ZENDESK, TICKET_FIELD_TYPE_NAME, 'ticket')
      const triggerBefore = trigger.clone()
      triggerBefore.value.conditions = { all: [{ field: new ReferenceExpression(missingTicket.elemID) }] }
      const triggerAfter = trigger.clone()
      triggerAfter.value.conditions = { all: [{ field: new ReferenceExpression(ticketField2.elemID) }] }

      const inputChanges = new Map([
        [0, toChange({ before: missingTicket })],
        [1, toChange({ before: triggerBefore, after: triggerAfter })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
        [0, new Set()],
        [1, new Set()],
      ])

      const dependencyChanges = [...(await modifiedAndDeletedDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges.length).toBe(0)
    })
    it('should not add dependency if there is no reference from the trigger', async () => {
      const triggerBefore = trigger.clone()
      triggerBefore.value.conditions = {}
      const triggerAfter = trigger.clone()
      triggerAfter.value.conditions = { all: [{ field: new ReferenceExpression(ticketField2.elemID) }] }
      const inputChanges = new Map([
        [0, toChange({ before: ticketField1 })],
        [1, toChange({ before: triggerBefore, after: triggerAfter })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
        [0, new Set()],
        [1, new Set()],
      ])

      const dependencyChanges = [...(await modifiedAndDeletedDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges.length).toBe(0)
    })
    it('should not add dependency if the reference is not to a ticket field', async () => {
      const macro = new InstanceElement('macro', new ObjectType({ elemID: new ElemID(ZENDESK, MACRO_TYPE_NAME) }), {})
      const triggerBefore = trigger.clone()
      triggerBefore.value.conditions = { all: [{ field: new ReferenceExpression(macro.elemID) }] }
      const triggerAfter = trigger.clone()
      triggerAfter.value.conditions = { all: [{ field: new ReferenceExpression(ticketField2.elemID) }] }
      const inputChanges = new Map([
        [0, toChange({ before: trigger })],
        [1, toChange({ before: triggerBefore, after: triggerAfter })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
        [0, new Set()],
        [1, new Set()],
      ])

      const dependencyChanges = [...(await modifiedAndDeletedDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges.length).toBe(0)
    })
    it('should not add dependency if the reference is not from a trigger', async () => {
      const macro = new InstanceElement('macro', new ObjectType({ elemID: new ElemID(ZENDESK, MACRO_TYPE_NAME) }), {
        conditions: { all: [{ field: new ReferenceExpression(ticketField1.elemID) }] },
      })
      const macroAfter = macro.clone()
      macroAfter.value.conditions = {}
      const inputChanges = new Map([
        [0, toChange({ before: ticketField1 })],
        [1, toChange({ before: macro, after: macroAfter })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
        [0, new Set()],
        [1, new Set()],
      ])

      const dependencyChanges = [...(await modifiedAndDeletedDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges.length).toBe(0)
    })
    it('should not add dependency if the conditions are not in the right format', async () => {
      const triggerBefore = trigger.clone()
      triggerBefore.value.conditions = { all: [{ value: new ReferenceExpression(ticketField1.elemID) }] }
      const triggerAfter = trigger.clone()
      triggerAfter.value.conditions = { all: [{ field: new ReferenceExpression(ticketField2.elemID) }] }
      const inputChanges = new Map([
        [0, toChange({ before: ticketField1 })],
        [1, toChange({ before: triggerBefore, after: triggerAfter })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
        [0, new Set()],
        [1, new Set()],
      ])

      const dependencyChanges = [...(await modifiedAndDeletedDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges.length).toBe(0)
    })
    it('should not add dependency if there are no conditions', async () => {
      const triggerBefore = trigger.clone()
      const triggerAfter = trigger.clone()
      triggerAfter.value.conditions = { all: [{ field: new ReferenceExpression(ticketField2.elemID) }] }
      const inputChanges = new Map([
        [0, toChange({ before: ticketField1 })],
        [1, toChange({ before: triggerBefore, after: triggerAfter })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
        [0, new Set()],
        [1, new Set()],
      ])

      const dependencyChanges = [...(await modifiedAndDeletedDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges.length).toBe(0)
    })
  })
  describe('trigger and trigger category', () => {
    const triggerType = new ObjectType({ elemID: new ElemID(ZENDESK, TRIGGER_TYPE_NAME) })
    const triggerCategoryType = new ObjectType({ elemID: new ElemID(ZENDESK, TRIGGER_CATEGORY_TYPE_NAME) })
    const trigger = new InstanceElement('trigger', triggerType, {
      actions: [],
    })
    const triggerCategory1 = new InstanceElement('category1', triggerCategoryType, {})
    const triggerCategory2 = new InstanceElement('category2', triggerCategoryType, {})
    it('should add dependency from deleted category to the trigger', async () => {
      const triggerBefore = trigger.clone()
      triggerBefore.value.category_id = new ReferenceExpression(triggerCategory1.elemID)
      const triggerAfter = trigger.clone()
      triggerAfter.value.category_id = new ReferenceExpression(triggerCategory2.elemID)
      const inputChanges = new Map([
        [0, toChange({ before: triggerCategory1 })],
        [1, toChange({ before: triggerBefore, after: triggerAfter })],
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
      const missingCategory = createMissingInstance(ZENDESK, TRIGGER_CATEGORY_TYPE_NAME, 'trigger')
      const triggerBefore = trigger.clone()
      triggerBefore.value.category_id = new ReferenceExpression(missingCategory.elemID)
      const triggerAfter = trigger.clone()
      triggerAfter.value.category_id = new ReferenceExpression(triggerCategory2.elemID)
      const inputChanges = new Map([
        [0, toChange({ before: missingCategory })],
        [1, toChange({ before: triggerBefore, after: triggerAfter })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
        [0, new Set()],
        [1, new Set()],
      ])

      const dependencyChanges = [...(await modifiedAndDeletedDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges.length).toBe(0)
    })
    it('should not add dependency if there is no reference from the trigger', async () => {
      const triggerBefore = trigger.clone()
      const triggerAfter = trigger.clone()
      triggerAfter.value.category_id = new ReferenceExpression(triggerCategory2.elemID)
      const inputChanges = new Map([
        [0, toChange({ before: triggerCategory1 })],
        [1, toChange({ before: triggerBefore, after: triggerAfter })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
        [0, new Set()],
        [1, new Set()],
      ])

      const dependencyChanges = [...(await modifiedAndDeletedDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges.length).toBe(0)
    })
    it('should not add dependency if the reference is not to a category', async () => {
      const macro = new InstanceElement('macro', new ObjectType({ elemID: new ElemID(ZENDESK, MACRO_TYPE_NAME) }), {})
      const triggerBefore = trigger.clone()
      triggerBefore.value.category_id = new ReferenceExpression(macro.elemID)
      const triggerAfter = trigger.clone()
      triggerAfter.value.category_id = new ReferenceExpression(triggerCategory2.elemID)
      const inputChanges = new Map([
        [0, toChange({ before: trigger })],
        [1, toChange({ before: triggerBefore, after: triggerAfter })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
        [0, new Set()],
        [1, new Set()],
      ])

      const dependencyChanges = [...(await modifiedAndDeletedDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges.length).toBe(0)
    })
    it('should not add dependency if the reference is not from a trigger', async () => {
      const macro = new InstanceElement('macro', new ObjectType({ elemID: new ElemID(ZENDESK, MACRO_TYPE_NAME) }), {
        category_id: new ReferenceExpression(triggerCategory1.elemID),
      })

      const macroAfter = macro.clone()
      macro.value.category_id = new ReferenceExpression(triggerCategory2.elemID)
      const inputChanges = new Map([
        [0, toChange({ before: triggerCategory1 })],
        [1, toChange({ before: macro, after: macroAfter })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
        [0, new Set()],
        [1, new Set()],
      ])

      const dependencyChanges = [...(await modifiedAndDeletedDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges.length).toBe(0)
    })
    it('should not add dependency if the category id is not in the right format', async () => {
      const triggerBefore = trigger.clone()
      triggerBefore.value.category_ids = new ReferenceExpression(triggerCategory1.elemID)
      const triggerAfter = trigger.clone()
      triggerAfter.value.category_ids = new ReferenceExpression(triggerCategory2.elemID)
      const inputChanges = new Map([
        [0, toChange({ before: triggerCategory1 })],
        [1, toChange({ before: triggerBefore, after: triggerAfter })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
        [0, new Set()],
        [1, new Set()],
      ])

      const dependencyChanges = [...(await modifiedAndDeletedDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges.length).toBe(0)
    })
    it('should not add dependency if it is not a reference', async () => {
      const triggerBefore = trigger.clone()
      triggerBefore.value.category_id = 123
      const triggerAfter = trigger.clone()
      triggerAfter.value.category_id = 1234
      const inputChanges = new Map([
        [0, toChange({ before: triggerCategory1 })],
        [1, toChange({ before: triggerBefore, after: triggerAfter })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
        [0, new Set()],
        [1, new Set()],
      ])

      const dependencyChanges = [...(await modifiedAndDeletedDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges.length).toBe(0)
    })
  })
  describe('theme settings and guide theme', () => {
    const themeSettingsType = new ObjectType({ elemID: new ElemID(ZENDESK, THEME_SETTINGS_TYPE_NAME) })
    const guideThemeType = new ObjectType({ elemID: new ElemID(ZENDESK, GUIDE_THEME_TYPE_NAME) })
    const themeSettings = new InstanceElement('themeSettings', themeSettingsType, {
      liveTheme: new ReferenceExpression(new ElemID(ZENDESK, 'guide_theme')),
    })
    const guideTheme1 = new InstanceElement('theme1', guideThemeType, {})
    const guideTheme2 = new InstanceElement('theme2', guideThemeType, {})
    it('should add dependency from deleted theme to the theme settings', async () => {
      const themeSettingsBefore = themeSettings.clone()
      themeSettingsBefore.value.liveTheme = new ReferenceExpression(guideTheme1.elemID)
      const themeSettingsAfter = themeSettings.clone()
      themeSettingsAfter.value.liveTheme = new ReferenceExpression(guideTheme2.elemID)
      const inputChanges = new Map([
        [0, toChange({ before: guideTheme1 })],
        [1, toChange({ before: themeSettingsBefore, after: themeSettingsAfter })],
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
  })
})
