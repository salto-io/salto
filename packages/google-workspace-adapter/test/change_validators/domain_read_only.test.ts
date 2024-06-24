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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { DOMAIN_TYPE_NAME, ADAPTER_NAME } from '../../src/constants'
import { domainReadOnlyValidator } from '../../src/change_validators'

describe('domainReadOnlyValidator', () => {
  const domainInstance = new InstanceElement(
    'testDomain',
    new ObjectType({ elemID: new ElemID(ADAPTER_NAME, DOMAIN_TYPE_NAME) }),
    {
      domainName: 'domain-test.com',
      isPrimary: false,
      verified: true,
    },
  )
  it('should return an error if the domain has tried to set any of the read only fields', async () => {
    const errors = await domainReadOnlyValidator([toChange({ after: domainInstance })])
    expect(errors).toEqual([
      {
        elemID: domainInstance.elemID,
        severity: 'Info',
        message: 'The verified, isPrimary and domainAliases fields are read-only',
        detailedMessage:
          'Google workspace does not support setting the verified, isPrimary and domainAliases fields trough the API, please set domain-test.com fields in the admin console',
      },
    ])
  })
  it('should not return an error if the domain has not tried to set any of the read only fields', async () => {
    const clonedDomain = domainInstance.clone()
    clonedDomain.value.verified = false
    const errors = await domainReadOnlyValidator([toChange({ after: clonedDomain })])
    expect(errors).toHaveLength(0)
  })
})
