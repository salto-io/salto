/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { isNotMappingToAuthenticatorApp } from '../../../../src/definitions/fetch/types/profile_mapping'

describe('isNotMappingToAuthenticatorApp', () => {
  const valueA = {
    id: '111',
    source: {
      name: 'oidc_idp',
      type: 'appuser',
    },
    target: {
      name: 'user',
      type: 'user',
    },
  }
  const valueB = {
    id: '222',
    source: {
      name: 'Okta_Authenticator',
      type: 'appuser',
    },
    target: {
      name: 'user',
      type: 'user',
    },
  }
  const valueC = {
    id: '222',
    source: {
      name: 'user',
      type: 'user',
    },
    target: {
      name: 'Okta_Authenticator',
      type: 'appuser',
    },
  }

  it('should return false when value is a ProfileMapping to Okta_Authenticator app', () => {
    expect(isNotMappingToAuthenticatorApp(valueB)).toBeFalsy()
    expect(isNotMappingToAuthenticatorApp(valueC)).toBeFalsy()
  })

  it('should return true when value is a ProfileMapping to any other app', () => {
    expect(isNotMappingToAuthenticatorApp(valueA)).toBeTruthy()
  })
})
