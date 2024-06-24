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
import { ChangeValidator, getChangeData, isInstanceChange, isReferenceExpression } from '@salto-io/adapter-api'
import { GUIDE_TYPES_TO_HANDLE_BY_BRAND } from '../config'

/**
 * Verifies each Zendesk Guide brand related instance has a brand reference value
 */
export const brandFieldForBrandBasedElementsValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(change => GUIDE_TYPES_TO_HANDLE_BY_BRAND.includes(getChangeData(change).elemID.typeName))
    .map(getChangeData)
    .filter(instance => !isReferenceExpression(instance.value.brand))
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: `Element ${instance.elemID.getFullName()} cannot be deployed.`,
      detailedMessage: `Element ${instance.elemID.getFullName()} is a Zendesk Guide element which isn't related to a brand, and therefore cannot be deployed.`,
    }))
