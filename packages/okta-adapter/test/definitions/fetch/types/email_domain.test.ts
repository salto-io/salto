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
import { isNotDeletedEmailDomain } from '../../../../src/definitions/fetch/types/email_domain'

describe('isNotDeletedEmailDomain', () => {
  const activeEmailDomain = {
    id: '111',
    validationStatus: 'ACTIVE',
  }
  const notStartedEmailDomain = {
    id: '111',
    validationStatus: 'ACTIVE',
  }
  const deletedEmailDomain = {
    id: '222',
    validationStatus: 'DELETED',
  }
  const noValidationStatusEmailDomain = {
    id: '333',
  }

  it('should return true when value is an EmailDomain with status ACTIVE', () => {
    expect(isNotDeletedEmailDomain(activeEmailDomain)).toBeTruthy()
    expect(isNotDeletedEmailDomain(notStartedEmailDomain)).toBeTruthy()
  })

  it('should return false when value is an EmailDomain with status DELETED', () => {
    expect(isNotDeletedEmailDomain(deletedEmailDomain)).toBeFalsy()
  })

  it('should return false when value is not an EmailDomain', () => {
    expect(isNotDeletedEmailDomain(noValidationStatusEmailDomain)).toBeFalsy()
  })
})
