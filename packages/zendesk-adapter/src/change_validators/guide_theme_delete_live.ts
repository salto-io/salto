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
  ChangeValidator,
  getChangeData,
  isInstanceChange,
  isReferenceExpression,
  isRemovalChange,
} from '@salto-io/adapter-api'
import { getInstancesFromElementSource } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { GUIDE_THEME_TYPE_NAME, THEME_SETTINGS_TYPE_NAME } from '../constants'

const log = logger(module)

// This change validator verifies that no live themes are deleted
export const guideThemeDeleteLiveValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    log.error('Failed to run guideThemeDeleteLiveValidator because no element source was provided')
    return []
  }
  const deletedThemes = changes
    .filter(isInstanceChange)
    .filter(isRemovalChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === GUIDE_THEME_TYPE_NAME)
    .filter(instance => isReferenceExpression(instance.value.brand_id))

  if (_.isEmpty(deletedThemes)) {
    return []
  }

  const liveThemes = Object.fromEntries(
    (await getInstancesFromElementSource(elementSource, [THEME_SETTINGS_TYPE_NAME])).map(instance => [
      instance.value.brand.elemID.getFullName(),
      instance.value.liveTheme.elemID.getFullName(),
    ]),
  )
  const deletedLiveThemes = deletedThemes.filter(
    instance => liveThemes[instance.value.brand_id.elemID.getFullName()] === instance.elemID.getFullName(),
  )

  return deletedLiveThemes.map(theme => ({
    elemID: theme.elemID,
    message: 'Cannot delete live themes',
    severity: 'Error',
    detailedMessage: 'Cannot delete live themes, please unpublish the theme first',
  }))
}
