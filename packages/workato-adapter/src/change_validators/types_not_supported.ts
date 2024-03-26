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
import { RLM_DEPLOY_SUPPORTED_TYPES } from '../constants'

export const typesNotSupportedValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(elem => !RLM_DEPLOY_SUPPORTED_TYPES.includes(elem.elemID.typeName))
    .map(element => ({
      elemID: element.elemID,
      severity: 'Error',
      message: 'Operation not supported',
      detailedMessage: `Salto does not support deployment of ${element.elemID.typeName}.`,
    }))
