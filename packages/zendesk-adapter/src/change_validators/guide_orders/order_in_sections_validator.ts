/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { ChangeValidator, getChangeData, isModificationChange } from '@salto-io/adapter-api'
import { createErrorMessage, isEverythingReferences } from './guide_order_validators_utils'
import {
  ARTICLES_FIELD,
  ORDER_IN_SECTION_TYPE,
  SECTIONS_FIELD,
} from '../../filters/guide_order/guide_orders_utils'

export const orderInSectionsValidator: ChangeValidator = async changes => {
  const relevantChanges = changes
    .filter(isModificationChange)
    .map(getChangeData)
    .filter(instance => ORDER_IN_SECTION_TYPE === instance.elemID.typeName)

  const sectionsError = relevantChanges
    .filter(instance => !isEverythingReferences(instance, SECTIONS_FIELD))
    .map(instance => createErrorMessage(instance, SECTIONS_FIELD))

  const articleError = relevantChanges
    .filter(instance => !isEverythingReferences(instance, ARTICLES_FIELD))
    .map(instance => createErrorMessage(instance, ARTICLES_FIELD))

  return [...sectionsError, ...articleError]
}
