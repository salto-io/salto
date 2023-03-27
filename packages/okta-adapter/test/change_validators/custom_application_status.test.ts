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
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { customApplicationStatusValidator } from '../../src/change_validators/custom_application_status'
import { OKTA, APPLICATION_TYPE_NAME, INACTIVE_STATUS } from '../../src/constants'

describe('customApplicationStatusValidator', () => {
  const applicationType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
  const appInstance = new InstanceElement(
    'app',
    applicationType,
    { label: 'bookmark app', status: INACTIVE_STATUS, signOnMode: 'BOOKMARK', name: 'name' },
  )
  const customAppInstance = new InstanceElement(
    'custom',
    applicationType,
    { customName: 'oktaSubdomain_saml_link', signOnMode: 'SAML_2_0', status: INACTIVE_STATUS }
  )

  it('should return change error when modifying custom app in status INACTIVE', async () => {
    const errors = await customApplicationStatusValidator([
      toChange({ before: customAppInstance, after: customAppInstance }),
    ])
    expect(errors).toHaveLength(1)
    expect(errors).toEqual([
      {
        elemID: customAppInstance.elemID,
        severity: 'Error',
        message: 'Cannot change custom application in status INACTIVE',
        detailedMessage: 'Modifications of custom applications in status INACTIVE is not supported via the Okta API. Please make this change in Okta and fetch, or activate the application and try again.',
      },
    ])
  })
  it('should not return change error when modifying regular app in status INACTIVE', async () => {
    const errors = await customApplicationStatusValidator([
      toChange({ before: appInstance, after: appInstance }),
    ])
    expect(errors).toHaveLength(0)
  })
})
