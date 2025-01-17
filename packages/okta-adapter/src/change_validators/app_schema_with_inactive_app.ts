/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeValidator,
  getChangeData,
  isInstanceChange,
  InstanceElement,
  ModificationChange,
  isInstanceElement,
  isAdditionOrModificationChange,
  AdditionChange,
  isAdditionChange,
} from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { APPLICATION_TYPE_NAME, APP_USER_SCHEMA_TYPE_NAME, INACTIVE_STATUS } from '../constants'

const log = logger(module)

const isWithInactiveApp = (
  app: InstanceElement,
  appChange: ModificationChange<InstanceElement> | AdditionChange<InstanceElement> | undefined,
): boolean => {
  if (appChange === undefined) {
    return app.value?.status === INACTIVE_STATUS
  }
  const afterAppStatus = appChange.data.after.value?.status
  if (isAdditionChange(appChange)) {
    return afterAppStatus === INACTIVE_STATUS
  }
  const beforeAppStatus = appChange.data.before.value?.status
  return beforeAppStatus === INACTIVE_STATUS && afterAppStatus === INACTIVE_STATUS
}

export const getParentApp = (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
): InstanceElement | undefined => {
  const parents = getParents(getChangeData(change))
  if (
    _.isEmpty(parents) ||
    parents[0]?.elemID.typeName !== APPLICATION_TYPE_NAME ||
    !isInstanceElement(parents[0]?.value)
  ) {
    log.debug(`AppUserSchema '${getChangeData(change).elemID.getFullName()}' change does not have an app parent`)
    return undefined
  }
  return parents[0].value
}

/**
 * Verifies that AppUserSchema is not modified when the app is inactive.
 */
export const appUserSchemaWithInactiveAppValidator: ChangeValidator = async changes => {
  const [appUserSchemaChanges, appChanges] = _.partition(
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .filter(change =>
        [APP_USER_SCHEMA_TYPE_NAME, APPLICATION_TYPE_NAME].includes(getChangeData(change).elemID.typeName),
      ),
    change => getChangeData(change).elemID.typeName === APP_USER_SCHEMA_TYPE_NAME,
  )

  if (_.isEmpty(appUserSchemaChanges)) {
    return []
  }

  const appChangesByApp = Object.fromEntries(
    appChanges.map(appChange => [getChangeData(appChange).elemID.getFullName(), appChange]),
  )

  return appUserSchemaChanges
    .filter(change => {
      const app = getParentApp(change)
      if (app === undefined) {
        return false
      }
      const appChange = appChangesByApp[app.elemID.getFullName()]
      return isWithInactiveApp(app, appChange)
    })
    .map(change => getChangeData(change))
    .map(appUserSchema => {
      const appName = getParents(appUserSchema)[0]?.elemID.name
      return {
        elemID: appUserSchema.elemID,
        severity: 'Error',
        message: `Cannot deploy App User schema when its associated app is ${INACTIVE_STATUS}`,
        detailedMessage: `Cannot deploy App User schema '${appUserSchema.elemID.name}' because its associated app '${appName}' is inactive. Please activate the app in order to modify this element.`,
      }
    })
}
