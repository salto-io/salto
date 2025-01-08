/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { getAdminUrl } from '../../src/client/admin'

describe('admin', () => {
  describe('getAdminUrl', () => {
    it('should return base url with -admin', () => {
      const baseUrl = 'https://dev-num1.okta.com/'
      const previewUrl = 'https://okta123.oktapreview.com/'
      const baseUrlOfPage = 'https://subdomain1.oktapreview.com/login/default'
      expect(getAdminUrl(baseUrl)).toEqual('https://dev-num1-admin.okta.com/')
      expect(getAdminUrl(previewUrl)).toEqual('https://okta123-admin.oktapreview.com/')
      expect(getAdminUrl(baseUrlOfPage)).toEqual('https://subdomain1-admin.oktapreview.com/login/default')
    })
    it('should not try to add another -admin suffix if it already exists', () => {
      const baseUrl = 'https://some-company-admin.okta.com/'
      expect(getAdminUrl(baseUrl)).toEqual(baseUrl)
    })
    it('should return undefined if base url is in unexpected format', () => {
      const baseUrl = 'https://dev-num1okta.com/'
      expect(getAdminUrl(baseUrl)).toEqual(undefined)
    })
  })
})
