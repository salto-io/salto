/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { logger } from '@salto-io/logging'
import {
  DependencyChanger,
  InstanceElement,
  ModificationChange,
  dependencyChange,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { values } from '@salto-io/lowerdash'
import { getParent, hasValidParent } from '@salto-io/adapter-utils'
import { APP_GROUP_ASSIGNMENT_TYPE_NAME, APP_USER_SCHEMA_TYPE_NAME } from '../constants'

const log = logger(module)

/*
 * Ensure AppUserSchema changes are deployed before ApplicationGroupAssignment changes.
 * This guarantees that any new properties added to the schema are available
 * before being referenced in group assignments.
 */
export const addAppGroupToAppUserSchemaDependency: DependencyChanger = async changes => {
  const instanceChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter((change): change is deployment.dependency.ChangeWithKey<ModificationChange<InstanceElement>> =>
      isInstanceChange(change.change),
    )

  const appUserSchemaChanges = instanceChanges
    .filter(change => isAdditionOrModificationChange(change.change))
    .filter(change => getChangeData(change.change).elemID.typeName === APP_USER_SCHEMA_TYPE_NAME)

  const appUserSchemaChangesByAppName = _.keyBy(
    appUserSchemaChanges.filter(change => hasValidParent(getChangeData(change.change))),
    change => getParent(getChangeData(change.change)).elemID.getFullName(),
  )

  const appGroupChanges = instanceChanges.filter(
    change => getChangeData(change.change).elemID.typeName === APP_GROUP_ASSIGNMENT_TYPE_NAME,
  )

  if (_.isEmpty(appUserSchemaChanges) || _.isEmpty(appGroupChanges)) {
    return []
  }

  return appGroupChanges
    .map(appGroupChange => {
      try {
        const parentApp = getParent(getChangeData(appGroupChange.change))
        const appUserSchemaChange = appUserSchemaChangesByAppName[parentApp.elemID.getFullName()]
        if (appUserSchemaChange === undefined) {
          return undefined
        }
        return dependencyChange('add', appGroupChange.key, appUserSchemaChange.key)
      } catch (err) {
        log.error(
          'Failed to add dependency from ApplicationGroupAssignment %s to AppUserSchema: %o',
          getChangeData(appGroupChange.change).elemID.getFullName(),
          err,
        )
        return undefined
      }
    })
    .filter(values.isDefined)
}
