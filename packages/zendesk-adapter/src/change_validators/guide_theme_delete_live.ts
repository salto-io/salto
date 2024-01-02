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
import { ChangeValidator, getChangeData, isInstanceChange, isRemovalChange } from '@salto-io/adapter-api'
import { GUIDE_THEME_TYPE_NAME } from '../constants'

// This change validator verifies that no live themes are deleted
const guideThemeDeleteLiveValidator: ChangeValidator = async changes => {
  const deletedLiveThemes = changes
    .filter(isInstanceChange)
    .filter(isRemovalChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === GUIDE_THEME_TYPE_NAME && instance.value.live)

  return deletedLiveThemes.map(theme => ({
    elemID: theme.elemID,
    message: 'Cannot delete live themes',
    severity: 'Error',
    detailedMessage: 'Cannot delete live themes, please unpublish the theme first',
  }))
}

export default guideThemeDeleteLiveValidator
