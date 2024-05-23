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
  isAdditionChange,
  isInstanceChange,
  isInstanceElement,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { EMAIL_DOMAIN_TYPE_NAME, BRAND_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable

export const emailDomainAdditionValidator: ChangeValidator = async (changes, elementsSource) => {
  if (!elementsSource) {
    return []
  }

  return awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === EMAIL_DOMAIN_TYPE_NAME)
    .filter(async emailDomainInstance =>
      // Check if there is at least one brand that uses the email domain, return True if there isn't.
      awu(await elementsSource.getAll())
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === BRAND_TYPE_NAME)
        .filter(brandInstance => isReferenceExpression(brandInstance.value.emailDomainId))
        .filter(brandInstance => brandInstance.value.emailDomainId.elemID.isEqual(emailDomainInstance.elemID))
        .isEmpty(),
    )
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error' as const,
      message: 'Cannot add email domain without at least one brand that uses it',
      detailedMessage: 'Cannot add email domain without at least one brand that uses it',
    }))
    .toArray()
}
