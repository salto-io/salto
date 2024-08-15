/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { assignPolicyIdsToApplication } from '../../../../src/definitions/fetch/types/application'

describe('application', () => {
  it('should replace create new fields from urls with ids', () => {
    const appValue = {
      id: '0oa6987q6jWCCgCQC5d7',
      name: 'workday',
      status: 'ACTIVE',
      settings: {
        app: {
          siteURL: 'https://test.workday.com/acme',
        },
      },
      _links: {
        profileEnrollment: {
          href: 'https://test/api/v1/policies/rst69dxiihma5xwSX5d7',
        },
        policies: {
          href: 'https://test/api/v1/apps/0oa6987q6jWCCgCQC5d7/policies',
          hints: {
            allow: ['PUT'],
          },
        },
        accessPolicy: {
          href: 'https://test/api/v1/policies/rst69c9wqljY2xknk5d7',
        },
        users: {
          href: 'https://test/api/v1/apps/0oa6987q6jWCCgCQC5d7/users',
        },
      },
    }
    const res = assignPolicyIdsToApplication(appValue)
    expect(res.profileEnrollment).toEqual('rst69dxiihma5xwSX5d7')
    expect(res.accessPolicy).toEqual('rst69c9wqljY2xknk5d7')
  })
  it('should do nothing if relevant fields are missing or in different structure', () => {
    const appValue = {
      id: '0oa6987q6jWCCgCQC5d7',
      name: 'workday',
      status: 'ACTIVE',
      settings: {
        app: {
          siteURL: 'https://test.workday.com/acme',
        },
      },
      _links: {
        policies: {
          href: 'https://test/api/v1/apps/0oa6987q6jWCCgCQC5d7/policies',
          hints: {
            allow: ['PUT'],
          },
        },
        accessPolicy: {
          self: 'https://test/api/v1/policies/rst69c9wqljY2xknk5d7',
        },
        users: {
          href: 'https://test/api/v1/apps/0oa6987q6jWCCgCQC5d7/users',
        },
      },
    }
    const res = assignPolicyIdsToApplication(appValue)
    expect(res.profileEnrollment).toBeUndefined()
    expect(res.accessPolicy).toBeUndefined()
  })
})
