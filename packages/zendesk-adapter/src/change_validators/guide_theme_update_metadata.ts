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
  isModificationChange,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { GUIDE_THEME_TYPE_NAME } from '../constants'

const MANIFEST_FIELDS = ['author', 'name', 'version']

export const guideThemeUpdateMetadataValidator: ChangeValidator = async changes => {
  const updatedThemes = changes
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === GUIDE_THEME_TYPE_NAME)

  const manifestChanges = updatedThemes
    .filter(theme => {
      const { before, after } = theme.data
      return MANIFEST_FIELDS.some(field => before.value[field] !== after.value[field])
    })
    .map(theme => ({
      elemID: getChangeData(theme).elemID,
      message: 'Updating theme fields has no effect',
      severity: 'Error' as SeverityLevel,
      detailedMessage: `Updating the theme fields ${MANIFEST_FIELDS.join(', ')} has no effect. To update them, please edit the manifest.json file`,
    }))

  const unsupportedChanges = updatedThemes.filter(theme => {
    const { before, after } = theme.data
    return before.value.brand_id !== after.value.brand_id
  }).map(theme => ({
    elemID: getChangeData(theme).elemID,
    message: 'Changing the brand on a theme is not supported',
    severity: 'Error' as SeverityLevel,
    detailedMessage: 'Changing the brand on a theme is not supported',
  }))

  return [...manifestChanges, ...unsupportedChanges]
}
