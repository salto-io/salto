/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, toChange } from '@salto-io/adapter-api'
import { createEmptyType, getFilterParams } from '../utils'
import filtersFilter from '../../src/filters/filter'
import { Filter } from '../../src/filter'

describe('filtersFilter', () => {
  let filter: Filter

  beforeEach(async () => {
    filter = filtersFilter(getFilterParams())
  })
  it('should replace user field on pre deploy', async () => {
    const instance = new InstanceElement('instance', createEmptyType('Filter'), {
      sharePermissions: [
        {
          type: 'user',
          user: {
            id: 'someone',
          },
        },
        {
          type: 'user',
          user: {
            id: 'someone2',
          },
        },
      ],

      editPermissions: [
        {
          type: 'user',
          user: {
            id: 'noOne',
          },
        },
        {
          type: 'user',
          user: {
            id: 'noOne2',
          },
        },
      ],
    })
    await filter.preDeploy?.([toChange({ after: instance })])
    expect(instance.value.editPermissions).toEqual([
      {
        type: 'user',
        user: {
          accountId: {
            id: 'noOne',
          },
        },
      },
      {
        type: 'user',
        user: {
          accountId: {
            id: 'noOne2',
          },
        },
      },
    ])
    expect(instance.value.sharePermissions).toEqual([
      {
        type: 'user',
        user: {
          accountId: {
            id: 'someone',
          },
        },
      },
      {
        type: 'user',
        user: {
          accountId: {
            id: 'someone2',
          },
        },
      },
    ])
  })
  it('should return user field after deploy', async () => {
    const instance = new InstanceElement('instance', createEmptyType('Filter'), {
      sharePermissions: [
        {
          type: 'user',
          user: {
            accountId: {
              id: 'someone',
            },
          },
        },
        {
          type: 'user',
          user: {
            accountId: {
              id: 'someone2',
            },
          },
        },
      ],
      editPermissions: [
        {
          type: 'user',
          user: {
            accountId: {
              id: 'noOne',
            },
          },
        },
        {
          type: 'user',
          user: {
            accountId: {
              id: 'noOne2',
            },
          },
        },
      ],
    })
    await filter.onDeploy?.([toChange({ after: instance })])
    expect(instance.value.editPermissions).toEqual([
      {
        type: 'user',
        user: {
          id: 'noOne',
        },
      },
      {
        type: 'user',
        user: {
          id: 'noOne2',
        },
      },
    ])
    expect(instance.value.sharePermissions).toEqual([
      {
        type: 'user',
        user: {
          id: 'someone',
        },
      },
      {
        type: 'user',
        user: {
          id: 'someone2',
        },
      },
    ])
  })

  it('should do nothing if not a filter type', async () => {
    const instance = new InstanceElement('instance', createEmptyType('Other'), {
      editPermissions: [
        {
          type: 'user',
          user: {
            id: 'noOne',
          },
        },
        {
          type: 'user',
          user: {
            id: 'noOne2',
          },
        },
      ],
    })
    await filter.preDeploy?.([toChange({ after: instance })])
    expect(instance.value).toEqual({
      editPermissions: [
        {
          type: 'user',
          user: {
            id: 'noOne',
          },
        },
        {
          type: 'user',
          user: {
            id: 'noOne2',
          },
        },
      ],
    })
    const instance2 = new InstanceElement('instance2', createEmptyType('Other'), {
      editPermissions: [
        {
          type: 'user',
          user: {
            accountId: {
              id: 'noOne',
            },
          },
        },
        {
          type: 'user',
          user: {
            accountId: {
              id: 'noOne2',
            },
          },
        },
      ],
    })
    await filter.onDeploy?.([toChange({ after: instance2 })])
    expect(instance2.value).toEqual({
      editPermissions: [
        {
          type: 'user',
          user: {
            accountId: {
              id: 'noOne',
            },
          },
        },
        {
          type: 'user',
          user: {
            accountId: {
              id: 'noOne2',
            },
          },
        },
      ],
    })
  })
})
