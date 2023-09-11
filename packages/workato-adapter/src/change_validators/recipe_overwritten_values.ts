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

import { EOL } from 'os'
import {
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { isInstanceFromType } from '../utils'
import { RECIPE_CODE_TYPE, RECIPE_TYPE } from '../constants'

/**
 * This validator checks that there private and concurrency values defines to defualt.
 * We use the Recipe LifeCycle Management (RLM) to deploy recipes.
 * Changing the private and concurrency values are not supported by RLM, so it will be overwritten to default values.
 */
// TODO it looks like private and concurrency are now supported by RLM (in Recipe - not code)
export const changeValidator: ChangeValidator = async changes => (
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange) // TODO change to isModificationChange (because addition is not relevant)
    .map(getChangeData)
    .filter(elem => isInstanceFromType([RECIPE_CODE_TYPE, RECIPE_TYPE])(elem))
    .map(element => ({
      elemID: element.elemID,
      severity: 'Warning',
      message: `Deployment of ${element.elemID.typeName} overwritten private and concurrency recipe values`,
      detailedMessage: [`Deployment of ${element.elemID.typeName} overwritten private and concurrency recipe values.`,
        'Private value will be overwritten to False',
        'Concurrency value will be overwritten to 1',
        `You can check the current values on the Workato website under ֿֿֿֿ'settings' tab in ${element.elemID.getFullName()} window`].join(EOL),
    }))
)

export default changeValidator
