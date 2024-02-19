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

import { ChangeValidator, getChangeData, isInstanceChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { GUIDE_THEME_TYPE_NAME, THEME_SETTINGS_TYPE_NAME } from '../constants'

export const guideThemeReadonlyValidator: ChangeValidator = async changes => {
  const themeInstances = changes
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(
      instance =>
        instance.elemID.typeName === GUIDE_THEME_TYPE_NAME || instance.elemID.typeName === THEME_SETTINGS_TYPE_NAME,
    )

  if (_.isEmpty(themeInstances)) {
    return []
  }

  return themeInstances.map(instance => ({
    elemID: instance.elemID,
    severity: 'Error',
    message: 'Deploying Guide Themes is not supported at the moment as Guide Themes is currently under development.',
    detailedMessage: 'Guide Themes deploy support is currently under development, and is currently in read only mode.',
  }))
}
