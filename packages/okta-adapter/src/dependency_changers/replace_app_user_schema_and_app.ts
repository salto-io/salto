/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  DependencyChange,
  DependencyChanger,
  InstanceElement,
  ModificationChange,
  dependencyChange,
  getChangeData,
  isInstanceChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { deployment } from '@salto-io/adapter-components'
import { APPLICATION_TYPE_NAME, APP_USER_SCHEMA_TYPE_NAME } from '../constants'
import { isActivation } from '../deprecated_deployment'
import { getParentApp } from '../change_validators/app_schema_with_inactive_app'

const createDependencyChange = (
  appUserSchemaChange: deployment.dependency.ChangeWithKey<ModificationChange<InstanceElement>>,
  appChange: deployment.dependency.ChangeWithKey<ModificationChange<InstanceElement>>,
): DependencyChange[] => {
  // We check for isActivationChange because the default behavior of deploy is app user schema before app.
  if (
    !isActivation({
      before: appChange.change.data.before.value.status,
      after: appChange.change.data.after.value.status,
    })
  ) {
    return []
  }
  return [
    dependencyChange('add', appUserSchemaChange.key, appChange.key),
    dependencyChange('remove', appChange.key, appUserSchemaChange.key),
  ]
}

/*
 * This dependency changer is used to replace the dependency from appUserSchema to app
 * because appUserSchema cannot be deployed with inactive app.
 * If the app status is been modified to active we want the app to be deployed before the appUserSchema
 */
export const changeDependenciesFromAppUserSchemaToApp: DependencyChanger = async changes => {
  const instanceChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter(({ change }) => isModificationChange(change))
    .filter((change): change is deployment.dependency.ChangeWithKey<ModificationChange<InstanceElement>> =>
      isInstanceChange(change.change),
    )

  const [appUserSchemasChanges, appsChanges] = _.partition(
    instanceChanges.filter(change =>
      [APP_USER_SCHEMA_TYPE_NAME, APPLICATION_TYPE_NAME].includes(getChangeData(change.change).elemID.typeName),
    ),
    change => getChangeData(change.change).elemID.typeName === APP_USER_SCHEMA_TYPE_NAME,
  )

  if (_.isEmpty(appUserSchemasChanges) || _.isEmpty(appsChanges)) {
    return []
  }

  const appChangeByAppName = Object.fromEntries(
    appsChanges.map(appChange => [getChangeData(appChange.change).elemID.getFullName(), appChange]),
  )

  return appUserSchemasChanges.flatMap(change => {
    const app = getParentApp(change.change)
    if (app === undefined) {
      return []
    }
    // We check for undefined because we don't need to change dependencies if the app is not been modified
    const appChange = appChangeByAppName[app.elemID.getFullName()]
    if (appChange === undefined) {
      return []
    }
    return createDependencyChange(change, appChange)
  })
}
