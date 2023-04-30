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
import { ChangeValidator, getChangeData, isInstanceChange, isModificationChange } from '@salto-io/adapter-api'

/**
 * Deployment of brand logo and brand favicon is not supported yet
 * TODO: remove this validator after SALTO-4058
 */
export const brandThemeFilesValidator: ChangeValidator = async changes => {
  const brandThemeChange = changes
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .find(change => getChangeData(change).elemID.typeName === 'BrandTheme')

  if (brandThemeChange === undefined) {
    return []
  }

  const brandThemeInstance = getChangeData(brandThemeChange)
  return [{
    elemID: brandThemeInstance.elemID,
    severity: 'Info',
    message: 'Changes to brand logo and brand favicon are not supported',
    detailedMessage: 'Changes to brand logo and brand favicon will not be deployed, please use the admin console',
  }]
}
