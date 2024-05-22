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
import { ACCESS_POLICY_TYPE_NAME, APPLICATION_TYPE_NAME, OKTA } from '../../src/constants'
import deleteRecurseIntoFilter from '../../src/filters/delete_fields'
import { getFilterParams } from '../utils'

describe('deleteFieldsFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  const applicationType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
  const accessType = new ObjectType({ elemID: new ElemID(OKTA, ACCESS_POLICY_TYPE_NAME) })

  beforeEach(() => {
    filter = deleteRecurseIntoFilter(getFilterParams()) as typeof filter
  })

  describe('onFetch', () => {
    it('should replace create new fields from urls with ids', async () => {
      const applicationInstance = new InstanceElement('application', applicationType, {
        label: 'app',
        AppUserSchema: { id: '123' },
      })
      const accessPolicy = new InstanceElement('access', accessType, {
        id: 'BBB',
        policyRules: { someProp: 'something' },
      })
      await filter.onFetch?.([applicationInstance, accessPolicy, accessType])
      expect(applicationInstance.value.AppUserSchema).toEqual(undefined)
      expect(applicationInstance.value).toEqual({ label: 'app' })
      expect(accessPolicy.value).toEqual({ id: 'BBB' })
    })
    it('should do nothing if field is missing', async () => {

      const applicationInstance = new InstanceElement('application', applicationType, {
        label: 'app',
        status: 'ACTIVE',
      })
      await filter.onFetch?.([applicationInstance])
      expect(applicationInstance.value).toEqual({ label: 'app', status: 'ACTIVE' })
    })
  })
})
