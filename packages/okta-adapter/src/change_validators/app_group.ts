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
import { ChangeValidator, getChangeData, isInstanceChange, isAdditionOrModificationChange } from '@salto-io/adapter-api'
import { GROUP_TYPE_NAME } from '../constants'

const APP_GROUP_TYPE = 'APP_GROUP'

/**
 * Groups of type APP_GROUP are groups imported to Okta from an external app.
 * Okta API does not support modifications or additions of such groups,
 * as application import oprerations adds and modify those groups.
 */
export const appGroupValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === GROUP_TYPE_NAME)
    .filter(instance => instance.value.type === APP_GROUP_TYPE)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: `Cannot add or modify group of type ${APP_GROUP_TYPE}`,
      detailedMessage: `Groups of type ${APP_GROUP_TYPE} cannot be updated through Okta API. Application import operations are responsible for syncing Groups of type ${APP_GROUP_TYPE}.`,
    }))
