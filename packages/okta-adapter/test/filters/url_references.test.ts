/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { APPLICATION_TYPE_NAME, OKTA } from '../../src/constants'
import urlReferencesFilter from '../../src/filters/url_references'
import { getFilterParams } from '../utils'

describe('urlReferencesFilter', () => {
  let appType: ObjectType
  let filter: filterUtils.FilterWith<'onFetch'>

  beforeEach(() => {
    filter = urlReferencesFilter(getFilterParams()) as typeof filter
    appType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
  })

  describe('OnFetch', () => {
    it('should replace create new fields from urls with ids', async () => {
      const appInstance = new InstanceElement(
        'instance',
        appType,
        {
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
        },
      )
      await filter.onFetch?.([appType, appInstance])
      expect(appInstance.value.profileEnrollment).toEqual('rst69dxiihma5xwSX5d7')
      expect(appInstance.value.accessPolicy).toEqual('rst69c9wqljY2xknk5d7')
    })
    it('should do nothing if relevant fields are missing or in different structure', async () => {
      const appInstance = new InstanceElement(
        'instance',
        appType,
        {
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
        },
      )
      await filter.onFetch?.([appType, appInstance])
      expect(appInstance.value.profileEnrollment).toBeUndefined()
      expect(appInstance.value.accessPolicy).toBeUndefined()
    })
  })
})
