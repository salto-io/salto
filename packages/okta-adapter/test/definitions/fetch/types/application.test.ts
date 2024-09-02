/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { assignPolicyIdsToApplication, isCustomApp } from '../../../../src/definitions/fetch/types/application'

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

  describe('isCustomApp', () => {
    const appValue = {
      name: 'oie-123_myAppName_2',
      signOnMode: 'AUTO_LOGIN',
      settings: {
        url: 'https://test.salto.com/acme',
      },
    }
    describe('with subdomain', () => {
      const subdomain = 'oie-123'
      it('should return true when name match subdomain', () => {
        expect(isCustomApp(appValue, subdomain)).toEqual(true)
      })
      it('should return false when name does not match subdomain and does not match custom app name pattern', () => {
        const app = { ...appValue }
        app.name = 'jira_cloud2'
        expect(isCustomApp(app, subdomain)).toEqual(false)
      })
    })
    describe('without subdomain', () => {
      it('should return true when name match custom app pattern and application signOnMode is AUTO_LOGIN', () => {
        expect(isCustomApp(appValue)).toEqual(true)
      })
      it('should return true when name match custom app pattern and application signOnMode is SAML_2_0', () => {
        appValue.signOnMode = 'SAML_2_0'
        expect(isCustomApp(appValue)).toEqual(true)
      })
      it('should return false when name does not match custom app pattern', () => {
        appValue.name = 'myAppName_2'
        expect(isCustomApp(appValue)).toEqual(false)
      })
      it('should return false when name match custom app pattern but application signOnMode is not AUTO_LOGIN or SAML_2_0', () => {
        appValue.signOnMode = 'BROWSER_PLUGIN'
        expect(isCustomApp(appValue)).toEqual(false)
      })
    })
  })
})
