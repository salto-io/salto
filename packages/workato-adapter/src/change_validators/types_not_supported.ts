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
import { isInstanceFromType } from '../utils'
import { RLM_DEPLOY_SUPPORTED_TYPES } from '../constants'

export const changeValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(elem => !isInstanceFromType(RLM_DEPLOY_SUPPORTED_TYPES)(elem))
    .map(element => ({
      elemID: element.elemID,
      severity: 'Error',
      message: `Deploying element of type '${element.elemID.typeName}' is not supported`,
      detailedMessage: `Deploying element of type '${element.elemID.typeName}' is not supported`,
    }))

export default changeValidator
