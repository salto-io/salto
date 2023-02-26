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

import _ from 'lodash'
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { APP_OWNED_TYPE_NAME, ZENDESK } from '../../src/constants'
import { requiredAppOwnedParametersValidator } from '../../src/change_validators'
import { APP_INSTALLATION_TYPE_NAME } from '../../src/filters/app'

describe('requiredAppOwnedParametersValidator', () => {
  const AppOwnedType = new ObjectType({
    elemID: new ElemID(ZENDESK, APP_OWNED_TYPE_NAME),
  })

  const AppInstallationType = new ObjectType({
    elemID: new ElemID(ZENDESK, APP_INSTALLATION_TYPE_NAME),
  })

  const appOwnedNoParameters = new InstanceElement(
    'Test1',
    AppOwnedType,
    {
      id: 1,
    },
  )

  const appOwnedWithParameters = new InstanceElement(
    'Test2',
    AppOwnedType,
    {
      id: 2,
      parameters: {
        name: {
          required: true,
          kind: 'text',
        },
        checkNotRequired: {
          required: false,
          kind: 'text',
        },
        checkRequired: {
          required: true,
          kind: 'text',
        },
      },
      other: 'bye',
    },
  )
  const appInstallationValidSettings = new InstanceElement(
    'Test3',
    AppInstallationType,
    {
      app_id: 2,
      settings: {
        name: 'my name',
        checkRequired: 'blabla',
      },
    },
  )

  it('should not return an error when app owned does not contain parameters', async () => {
    const appInstallationForInvalidAppOwned = new InstanceElement(
      'Test6',
      AppInstallationType,
      {
        app_id: 1,
        settings: {
          checkNotRequired: 'my name',
        },
      },
    )
    const errors = await requiredAppOwnedParametersValidator(
      [toChange({ after: appInstallationForInvalidAppOwned })],
      buildElementsSourceFromElements([appOwnedNoParameters, appOwnedWithParameters])

    )
    expect(errors).toHaveLength(0)
  })
  it('should return an error when app installation does not contain setting', async () => {
    const appInstallationNoSettings = new InstanceElement(
      'Test4',
      AppInstallationType,
      {
        app_id: 2,
      },
    )
    const errors = await requiredAppOwnedParametersValidator(
      [toChange({ after: appInstallationNoSettings })],
      buildElementsSourceFromElements([appOwnedNoParameters, appOwnedWithParameters])
    )
    expect(errors).toEqual([{
      elemID: appInstallationNoSettings.elemID,
      severity: 'Error',
      message: 'Cannot change app installation since some required parameters are missing',
      detailedMessage: `The following parameters are required: ${Object.keys(_.pickBy(appOwnedWithParameters.value.parameters, val => val.required))}`,
    }])
  })
  it('should not return an error when app installation contains all required parameters', async () => {
    const errors = await requiredAppOwnedParametersValidator(
      [toChange({ after: appInstallationValidSettings })],
      buildElementsSourceFromElements([appOwnedNoParameters, appOwnedWithParameters])
    )
    expect(errors).toHaveLength(0)
  })
  it('should return an error when app installation does not contain all required parameters', async () => {
    const appInstallationInvalidSettings = new InstanceElement(
      'Test5',
      AppInstallationType,
      {
        app_id: 2,
        settings: {
          name: 'my name',
          checkNotRequired: 'bla',
        },
      },
    )
    const errors = await requiredAppOwnedParametersValidator(
      [toChange({ after: appInstallationInvalidSettings })],
      buildElementsSourceFromElements([appOwnedNoParameters, appOwnedWithParameters])

    )
    expect(errors).toEqual([{
      elemID: appInstallationInvalidSettings.elemID,
      severity: 'Error',
      message: 'Cannot change app installation since some required parameters are missing',
      detailedMessage: `The following parameters are required: ${['checkRequired']}`,
    }])
  })
  it('should not return an error when app installation does not have a corresponding app owned', async () => {
    const appInstallationNoAppOwned = new InstanceElement(
      'Test7',
      AppInstallationType,
      {
        app_id: 3,
        settings: {
          check: 'my name',
        },
      },
    )
    const errors = await requiredAppOwnedParametersValidator(
      [toChange({ after: appInstallationNoAppOwned })],
      buildElementsSourceFromElements([appOwnedNoParameters, appOwnedWithParameters])
    )
    expect(errors).toHaveLength(0)
  })
  it('should return error when the change is "remove"', async () => {
    const errors = await requiredAppOwnedParametersValidator(
      [toChange({ after: appInstallationValidSettings })],
      buildElementsSourceFromElements([appOwnedNoParameters, appOwnedWithParameters])
    )
    expect(errors).toHaveLength(0)
  })
})
