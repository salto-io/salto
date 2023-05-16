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
import { getParent } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { APPLICATION_TYPE_NAME, APP_USER_SCHEMA_TYPE_NAME, INACTIVE_STATUS } from '../constants'

const isRelevantChange = (change: ModificationChange<InstanceElement>): boolean => {
  const { typeName } = getChangeData(change).elemID
  return isModificationChange(change) && (typeName === APP_USER_SCHEMA_TYPE_NAME || typeName === APPLICATION_TYPE_NAME)
}

const isWithInactiveApp = (
  appUserSchemaChange: ModificationChange<InstanceElement>,
  appChanges: ModificationChange<InstanceElement>[]
): boolean => {
  const app = getParent(getChangeData(appUserSchemaChange))
  const appChange = appChanges.find(change =>
    _.isEqual(getChangeData(change).elemID, app.elemID))
  if (appChange === undefined) {
    return app.value.status === INACTIVE_STATUS
  }
  return appChange.data.before.value.status === INACTIVE_STATUS && appChange.data.after.value.status === INACTIVE_STATUS
}

/**
 * Verifies that appUserSchema is not modified when the app is inactive.
 */
export const appSchemaWithInActiveAppValidator: ChangeValidator = async changes => {
  const [appUserSchemaChanges, appChanges] = _.partition(changes
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(isRelevantChange), change => getChangeData(change).elemID.typeName === APP_USER_SCHEMA_TYPE_NAME)

  if (_.isEmpty(appUserSchemaChanges)) {
    return []
  }

  return appUserSchemaChanges.filter(change => isWithInactiveApp(change, appChanges))
    .map(change => getChangeData(change))
    .map(appUserSchema => ({
      elemID: appUserSchema.elemID,
      severity: 'Error',
      message: 'Cannot modify appUserSchema when its associated app is inactive',
      detailedMessage: `Cannot modify ${appUserSchema.elemID.name} because its associated app '${getParent(appUserSchema).elemID.name}' is inactive`,
    }))
}
