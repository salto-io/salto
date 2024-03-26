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
import { RECIPE_CODE_TYPE, RECIPE_TYPE } from '../constants'

/*
 * This validator warns about potential recipe settings changes, which are not supported by Salto.
 * Salto does not support configuring recipe settings, so it will reset the privacy and concurrency settings to their default values.
 */
export const recipeSettingsNotSupportedValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(change => [RECIPE_CODE_TYPE, RECIPE_TYPE].includes(change.elemID.typeName))
    .map(element => ({
      elemID: element.elemID,
      severity: 'Warning',
      message:
        'Any changes to recipe settings such as the private and concurrency fields will be reset to their default values',
      detailedMessage: `Salto does not configure recipe settings. By deploying, the privacy and concurrency settings of ${element.elemID.name} will be reset to their default values.`,
    }))
