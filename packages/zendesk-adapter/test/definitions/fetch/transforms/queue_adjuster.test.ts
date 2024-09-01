/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { transformQueueItem } from '../../../../src/definitions/fetch/transforms'

describe('queue_adjuster', () => {
  it('should extract the primary group ids into a separate field', async () => {
    const value = {
      primary_groups: {
        groups: [{ id: 1 }, { id: 2 }, { id: 3 }],
      },
    }
    const finalValue = await transformQueueItem({ value, context: {}, typeName: 'queue' })
    expect(finalValue).toEqual({
      value: {
        primary_groups_id: [1, 2, 3],
      },
    })
  })

  it('should do nothing if primary groups are not defined', async () => {
    const value = {
      a: 1,
    }
    const finalValue = await transformQueueItem({ value, context: {}, typeName: 'queue' })
    expect(finalValue).toEqual({
      value: {
        a: 1,
      },
    })
  })

  it('should extract the secondary group ids into a separate field', async () => {
    const value = {
      secondary_groups: {
        groups: [{ id: 1 }, { id: 2 }, { id: 3 }],
      },
    }
    const finalValue = await transformQueueItem({ value, context: {}, typeName: 'queue' })
    expect(finalValue).toEqual({
      value: {
        secondary_groups_id: [1, 2, 3],
      },
    })
  })

  it('should extract both primary and secondary group ids', async () => {
    const value = {
      primary_groups: {
        groups: [{ id: 1 }, { id: 2 }, { id: 3 }],
      },
      secondary_groups: {
        groups: [{ id: 4 }, { id: 5 }],
      },
    }
    const finalValue = await transformQueueItem({ value, context: {}, typeName: 'queue' })
    expect(finalValue).toEqual({
      value: {
        primary_groups_id: [1, 2, 3],
        secondary_groups_id: [4, 5],
      },
    })
  })
})
