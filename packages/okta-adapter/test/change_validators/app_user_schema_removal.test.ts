/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
import { appUserSchemaRemovalValidator } from '../../src/change_validators/app_user_schema_removal'
import { OKTA, APPLICATION_TYPE_NAME, APP_USER_SCHEMA_TYPE_NAME } from '../../src/constants'

describe('appUserSchemaRemovalValidator', () => {
  let appUserSchema: InstanceElement
  const appType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
  const appUserSchemaType = new ObjectType({ elemID: new ElemID(OKTA, APP_USER_SCHEMA_TYPE_NAME) })

  const app = new InstanceElement('app', appType, { name: 'A', default: false })
  const appUserSchemaInstance = new InstanceElement(
    'appUserSchema',
    appUserSchemaType,
    {
      name: 'A',
    },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(app.elemID, app, app)],
    },
  )

  beforeEach(() => {
    appUserSchema = appUserSchemaInstance.clone()
  })

  it('should return an error when AppUserSchema is deleted without its parent Application', async () => {
    const changeErrors = await appUserSchemaRemovalValidator([toChange({ before: appUserSchema })])
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors).toEqual([
      {
        elemID: appUserSchema.elemID,
        severity: 'Error',
        message: 'Cannot remove app user schema without its parent application',
        detailedMessage: `In order to remove this Application User Schema, the Application ${app.elemID.name} must be removed as well.`,
      },
    ])
  })
  it('should log an error when AppUserSchema with 2 parents is deleted', async () => {
    appUserSchema.annotations[CORE_ANNOTATIONS.PARENT].push(new ReferenceExpression(app.elemID, app, app))
    const logging = logger('okta-adapter/src/change_validators/app_user_schema_removal')
    const e = new Error(
      `Expected ${appUserSchema.elemID.getFullName()} to have exactly one parent, found ${appUserSchema.annotations[CORE_ANNOTATIONS.PARENT].length}`,
    )
    const logErrorSpy = jest.spyOn(logging, 'error')
    await appUserSchemaRemovalValidator([toChange({ before: appUserSchema })])
    expect(logErrorSpy).toHaveBeenCalledWith(
      'Could not run appUserSchemaAndApplicationValidator validator for instance %s: %s',
      appUserSchema.elemID.getFullName(),
      e.message,
    )
  })
  it('should log an error when AppUserSchema with no parent is deleted', async () => {
    appUserSchema.annotations[CORE_ANNOTATIONS.PARENT] = []
    const logging = logger('okta-adapter/src/change_validators/app_user_schema_removal')
    const e = new Error(
      `Expected ${appUserSchema.elemID.getFullName()} to have exactly one parent, found ${appUserSchema.annotations[CORE_ANNOTATIONS.PARENT].length}`,
    )
    const logErrorSpy = jest.spyOn(logging, 'error')
    await appUserSchemaRemovalValidator([toChange({ before: appUserSchema })])
    expect(logErrorSpy).toHaveBeenCalledWith(
      'Could not run appUserSchemaAndApplicationValidator validator for instance %s: %s',
      appUserSchema.elemID.getFullName(),
      e.message,
    )
  })
  it('should not return an error when AppUserSchema is deleted with its parent Application', async () => {
    const changeErrors = await appUserSchemaRemovalValidator([
      toChange({ before: appUserSchema }),
      toChange({ before: app }),
    ])
    expect(changeErrors).toHaveLength(0)
  })
})
