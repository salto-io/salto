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
import { ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { OKTA, EMAIL_DOMAIN_TYPE_NAME } from '../../src/constants'
import omitDeletedEmailDomain from '../../src/filters/omit_deleted_email_domain'
import { getFilterParams } from '../utils'

describe('omitDeletedEmailDomain', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  const filter = omitDeletedEmailDomain(getFilterParams()) as FilterType
  const emailDomainType = new ObjectType({ elemID: new ElemID(OKTA, EMAIL_DOMAIN_TYPE_NAME) })

  it('should delete email domain instances that are marked as deleted', async () => {
    const activeEmailDomain = new InstanceElement('EmailDomain1', emailDomainType, { validationStatus: 'ACTIVE' })
    const deletedEmailDomain = new InstanceElement('EmailDomain2', emailDomainType, { validationStatus: 'DELETED' })
    const elements = [activeEmailDomain, deletedEmailDomain]
    await filter.onFetch(elements)
    expect(elements).toEqual([activeEmailDomain])
  })
})
