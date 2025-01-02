/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { filterUtils } from '@salto-io/adapter-components'
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import removedApplicationGrants from '../../src/filters/remove_application_grants'
import { APPLICATION_TYPE_NAME, OKTA } from '../../src/constants'
import { getFilterParams } from '../utils'

const mockRequestAllForResource = jest.fn()

jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    fetch: {
      ...actual.fetch,
      request: {
        ...actual.fetch.request,
        getRequester: jest.fn(() => ({
          requestAllForResource: mockRequestAllForResource,
        })),
      },
    },
  }
})

describe('removedApplicationGrants', () => {
  type FilterType = filterUtils.FilterWith<'preDeploy'>
  let filter: FilterType
  let applicationType: ObjectType
  let sharedContext: Record<string, unknown> | undefined
  beforeEach(() => {
    sharedContext = {}
    mockRequestAllForResource
      .mockResolvedValueOnce([
        {
          value: { id: '1', scopeId: 'okta.scope' },
        },
        { value: { id: '2', scopeId: 'okta.otherScope' } },
      ])
      .mockResolvedValueOnce([
        {
          value: { id: '3', scopeId: 'okta.anotherOtherScope' },
        },
      ])
    filter = removedApplicationGrants(getFilterParams({ sharedContext })) as typeof filter
    applicationType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
  })

  it('should assign current grant ids to the shared context', async () => {
    const instA = new InstanceElement('a', applicationType, {
      signOnMode: 'OPENID_CONNECT',
      apiScopes: [{ scopeId: 'okta.scope' }, { scopeId: 'okta.otherScope' }],
    })
    const instB = new InstanceElement('b', applicationType, {
      signOnMode: 'OPENID_CONNECT',
      apiScopes: [{ scopId: 'okta.anotherOtherScope' }],
    })
    const changes = [toChange({ before: instA }), toChange({ before: instB, after: instB })]
    await filter.preDeploy(changes)
    expect(sharedContext).toEqual({
      [instA.elemID.getFullName()]: {
        'okta.scope': '1',
        'okta.otherScope': '2',
      },
      [instB.elemID.getFullName()]: {
        'okta.anotherOtherScope': '3',
      },
    })
  })
  it("should not assign current grant ids to the shared context if the application signOnMode isn't OPENID_CONNECT", async () => {
    const instA = new InstanceElement('a', applicationType, {
      signOnMode: 'BROWSER_PLUGIN',
      apiScopes: [{ scopeId: 'okta.scope' }, { scopeId: 'okta.otherScope' }],
    })
    const instB = new InstanceElement('b', applicationType, {
      signOnMode: 'BROWSER_PLUGIN',
      apiScopes: [{ scopId: 'okta.anotherOtherScope' }],
    })
    const changes = [toChange({ before: instA }), toChange({ before: instB, after: instB })]
    await filter.preDeploy(changes)
    expect(sharedContext).toEqual({})
  })
})
