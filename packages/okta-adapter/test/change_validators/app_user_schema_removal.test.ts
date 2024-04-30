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
import {
  toChange,
  ObjectType,
  ElemID,
  InstanceElement,
  ReferenceExpression,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { appUserSchemaAndApplicationValidator } from '../../src/change_validators/app_user_schema_and_application'
import { OKTA, APPLICATION_TYPE_NAME, APP_USER_SCHEMA_TYPE_NAME } from '../../src/constants'

describe('appUserSchemaRemovalValidator', () => {
  const appType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
  const appUserSchemaType = new ObjectType({ elemID: new ElemID(OKTA, APP_USER_SCHEMA_TYPE_NAME) })

  const app = new InstanceElement('app', appType, { name: 'A', default: false })
  const appUserSchema1 = new InstanceElement(
    'appUserSchema',
    appUserSchemaType,
    {
      name: 'B',
    },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(app.elemID, app, app)],
    },
  )
  const appUserSchema2 = new InstanceElement(
    'appUserSchema',
    appUserSchemaType,
    {
      name: 'B',
    },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [
        new ReferenceExpression(app.elemID, app, app),
        new ReferenceExpression(app.elemID, app, app),
      ],
    },
  )
  it('should return an error when AppUserSchema is deleted without its parent Application', async () => {
    const changeErrors = await appUserSchemaAndApplicationValidator([toChange({ before: appUserSchema1 })])
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors).toEqual([
      {
        elemID: appUserSchema1.elemID,
        severity: 'Error',
        message: 'Cannot remove app user schema without its parent application',
        detailedMessage: `In order to remove ${appUserSchema1.elemID.name} of type ${APP_USER_SCHEMA_TYPE_NAME}, the instance ${app.elemID.name} of type ${APPLICATION_TYPE_NAME} must be removed as well.`,
      },
    ])
  })
  it('should log an error when AppUserSchema with 2 parents is deleted', async () => {
    const logging = logger('okta-adapter/src/change_validators/app_user_schema_and_application')
    const e = new Error(
      `Expected ${appUserSchema2.elemID.getFullName()} to have exactly one parent, found ${appUserSchema2.annotations[CORE_ANNOTATIONS.PARENT].length}`,
    )
    const logErrorSpy = jest.spyOn(logging, 'error')
    await appUserSchemaAndApplicationValidator([toChange({ before: appUserSchema2 })])
    expect(logErrorSpy).toHaveBeenCalledWith(
      'Could not run appUserSchemaAndApplicationValidator validator for instance %s: %s',
      appUserSchema2.elemID.getFullName(),
      e,
    )
  })
  it('should not return an error when AppUserSchema is deleted with its parent Application', async () => {
    const changeErrors = await appUserSchemaAndApplicationValidator([
      toChange({ before: appUserSchema1 }),
      toChange({ before: app }),
    ])
    expect(changeErrors).toHaveLength(0)
  })
})
