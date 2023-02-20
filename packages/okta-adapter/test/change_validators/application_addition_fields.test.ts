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
import { applicationFieldsValidator } from '../../src/change_validators/application_addition_fields'
import { OKTA, APPLICATION_TYPE_NAME } from '../../src/constants'

describe('applicationFieldsChangeValidator', () => {
  let type: ObjectType

  beforeEach(() => {
    type = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
  })
  it('should return an error with read only fields if exists', async () => {
    const instance = new InstanceElement(
      'bookmarkApp',
      type,
      {
        label: 'bookmark app',
        status: 'ACTIVE',
        signOnMode: 'SAML_2_0',
        licensing: {
          seatCount: 0,
        },
        SAML_2_0: {
          credentials: {
            userNameTemplate: {
              template: 'user.login',
              type: 'CUSTOM',
              pushStatus: 'DONT_PUSH',
            },
            signing: {
              kid: '123123123',
            },
          },
        },
      },
    )
    expect(await applicationFieldsValidator([
      toChange({
        after: instance,
      }),
    ])).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Cannot create an application with read only fields',
        detailedMessage: `Cannot create an application: ${instance.elemID.getFullName()} with read-only fields: licensing,kid`,
      },
    ])
  })

  it('should notify the user in case of AUTO_LOGIN app', async () => {
    const instance = new InstanceElement(
      'swa',
      type,
      {
        label: 'swa app',
        status: 'ACTIVE',
        signOnMode: 'AUTO_LOGIN',
        AUTO_LOGIN: {
          name: 'swa autologin',
          settings: {
            loginUrl: '213123',
          },
        },
      },
    )
    expect(await applicationFieldsValidator([
      toChange({
        after: instance,
      }),
    ])).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Info',
        message: 'Field \'name\' is created by the service',
        detailedMessage: `In application: ${instance.elemID.getFullName()}, name field will be overridden with the name created by the service`,
      },
    ])
  })
})
