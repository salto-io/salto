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
import { ChangeValidator, getChangeData, isInstanceChange, isModificationChange, InstanceElement, ModificationChange } from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { APPLICATION_TYPE_NAME, APP_USER_SCHEMA_TYPE_NAME, INACTIVE_STATUS } from '../constants'

const isWithInactiveApp = (
  app: InstanceElement,
  appChange: ModificationChange<InstanceElement> | undefined
): boolean => {
  if (appChange === undefined) {
    return app.value?.status === INACTIVE_STATUS ?? false
  }
  const beforeAppStatus = appChange.data.before.value?.status
  const afterAppStatus = appChange.data.after.value?.status
  if (beforeAppStatus === undefined || afterAppStatus === undefined) {
    return false
  }
  return beforeAppStatus === INACTIVE_STATUS && afterAppStatus === INACTIVE_STATUS
}

/**
 * Verifies that AppUserSchema is not modified when the app is inactive.
 */
export const appUserSchemaWithInactiveAppValidator: ChangeValidator = async changes => {
  const [appUserSchemaChanges, appChanges] = _.partition(
    changes
      .filter(isInstanceChange)
      .filter(isModificationChange)
      .filter(change => [APP_USER_SCHEMA_TYPE_NAME, APPLICATION_TYPE_NAME]
        .includes(getChangeData(change).elemID.typeName)),
    change => getChangeData(change).elemID.typeName === APP_USER_SCHEMA_TYPE_NAME
  )

  if (_.isEmpty(appUserSchemaChanges)) {
    return []
  }

  const appChangesByApp = Object.fromEntries(appChanges.map(appChange =>
    [getChangeData(appChange).elemID.getFullName(), appChange]))


  return appUserSchemaChanges.filter(change => {
    const parents = getParents(getChangeData(change))
    if (_.isEmpty(parents) || parents[0].elemID.typeName !== APPLICATION_TYPE_NAME) {
      return false
    }
    const app = parents[0].value
    const appChange = appChangesByApp[app.elemID.getFullName()]
    return isWithInactiveApp(app, appChange)
  })
    .map(change => getChangeData(change))
    .map(appUserSchema => {
      const appName = getParents(appUserSchema)[0]?.elemID.name
      return ({
        elemID: appUserSchema.elemID,
        severity: 'Error',
        message: `Cannot modify App User schema when its associated app is ${INACTIVE_STATUS}`,
        detailedMessage: `Cannot modify App User schema '${appUserSchema.elemID.name}' because its associated app '${appName}' is inactive. Please activate the app first.`,
      })
    })
}
