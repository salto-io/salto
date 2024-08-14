/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator, getChangeData, isInstanceChange, isRemovalChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { getParent } from '@salto-io/adapter-utils'
import { APPLICATION_TYPE_NAME, APP_USER_SCHEMA_TYPE_NAME } from '../constants'

const log = logger(module)

/**
 * When removing AppUserSchema, validate the parent Application gets removed as well.
 * AppUserSchema cannot be removed via the API, but the client removes it automatically when the parent Application is removed.
 * Therefore, we allow the removal of AppUserSchema only if the parent Application is removed as well.
 */
export const appUserSchemaRemovalValidator: ChangeValidator = async changes => {
  const removalInstanceChanges = changes.filter(isInstanceChange).filter(isRemovalChange).map(getChangeData)

  const removedAppUserSchemaInstances = removalInstanceChanges.filter(
    instance => instance.elemID.typeName === APP_USER_SCHEMA_TYPE_NAME,
  )

  const removedApplicationNames = new Set(
    removalInstanceChanges
      .filter(instance => instance.elemID.typeName === APPLICATION_TYPE_NAME)
      .map(instance => instance.elemID.getFullName()),
  )

  return removedAppUserSchemaInstances
    .filter(appUserSchema => {
      try {
        return !removedApplicationNames.has(getParent(appUserSchema).elemID.getFullName())
      } catch (e) {
        log.error(
          'Could not run appUserSchemaAndApplicationValidator validator for instance %s: %s',
          appUserSchema.elemID.getFullName(),
          e.message,
        )
        return false
      }
    })
    .map(appUserSchema => ({
      elemID: appUserSchema.elemID,
      severity: 'Error',
      message: 'Cannot remove app user schema without its parent application',
      detailedMessage: `In order to remove this Application User Schema, the Application ${getParent(appUserSchema).elemID.name} must be removed as well.`,
    }))
}
