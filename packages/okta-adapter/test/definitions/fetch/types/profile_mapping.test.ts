/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
