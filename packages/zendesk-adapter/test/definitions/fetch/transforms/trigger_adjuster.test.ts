/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { transformTriggerItem } from '../../../../src/definitions/fetch/transforms'

describe('trigger_adjuster', () => {
  describe('without priority', () => {
    it('should not update trigger item with add_skills or set_skills field', async () => {
      const value = {
        actions: [
          {
            field: 'add_skills',
            value: 'skillWithoutPriority',
          },
          {
            field: 'set_skills',
            value: 'skillWithoutPriority',
          },
        ],
      }
      const transformedItem = await transformTriggerItem({ value, context: {}, typeName: 'trigger' })
      expect(transformedItem).toEqual({ value })
    })
  })

  describe('with priority', () => {
    it('should transform trigger item with skill priority', async () => {
      const value = {
        actions: [
          {
            field: 'add_skills',
            value: 'requiredSkill#0',
          },
          {
            field: 'set_skills',
            value: 'optionalSkill#1',
          },
        ],
      }
      const transformedItem = await transformTriggerItem({ value, context: {}, typeName: 'trigger' })
      expect(transformedItem).toEqual({
        value: {
          actions: [
            {
              field: 'add_skills',
              value: 'requiredSkill',
              priority: 'required',
            },
            {
              field: 'set_skills',
              value: 'optionalSkill',
              priority: 'optional',
            },
          ],
        },
      })
    })

    it('should transform trigger item with mixed skill priority and non-priority skills', async () => {
      const value = {
        actions: [
          {
            field: 'add_skills',
            value: 'requiredSkill#0',
          },
          {
            field: 'set_skills',
            value: 'skillWithoutPriority',
          },
        ],
      }
      const transformedItem = await transformTriggerItem({ value, context: {}, typeName: 'trigger' })
      expect(transformedItem).toEqual({
        value: {
          actions: [
            {
              field: 'add_skills',
              value: 'requiredSkill',
              priority: 'required',
            },
            {
              field: 'set_skills',
              value: 'skillWithoutPriority',
            },
          ],
        },
      })
    })
  })

  it('should not update trigger item without actions', async () => {
    const value = { a: 1 }
    const transformedItem = await transformTriggerItem({ value, context: {}, typeName: 'trigger' })
    expect(transformedItem).toEqual({ value: { a: 1 } })
  })
})
