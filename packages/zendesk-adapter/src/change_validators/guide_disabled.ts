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

import { ChangeValidator, isInstanceChange, getChangeData, isAdditionChange, isInstanceElement, isReferenceExpression } from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { getBrandsForGuide } from '../filters/utils'
import { BRAND_TYPE_NAME } from '../constants'
import { GUIDE_TYPES_TO_HANDLE_BY_BRAND, ZendeskFetchConfig } from '../config'

const log = logger(module)
const { awu } = collections.asynciterable

export const guideDisabledValidator: (fetchConfig: ZendeskFetchConfig)
 => ChangeValidator = fetchConfig => async (changes, elementSource) => {
   const relevantInstances = changes
     .filter(isInstanceChange)
     .filter(isAdditionChange)
     .map(getChangeData)
     .filter(instance => GUIDE_TYPES_TO_HANDLE_BY_BRAND.includes(instance.elemID.typeName))
   if (_.isEmpty(relevantInstances)) {
     return []
   }
   if (elementSource === undefined) {
     log.error('Failed to run guideDisabledValidator because no element source was provided')
     return []
   }

   const brandsInstances = await awu(await elementSource.list())
     .filter(id => id.typeName === BRAND_TYPE_NAME)
     .map(id => elementSource.get(id))
     .filter(isInstanceElement)
     .toArray()

   const brandsWithGuide = new Set(getBrandsForGuide(brandsInstances, fetchConfig)
     .map(brand => brand.elemID.getFullName()))

   if (brandsWithGuide === undefined) {
     return []
   }

   return relevantInstances
     .filter(instance => isReferenceExpression(instance.value.brand))
     .filter(instance => !brandsWithGuide.has(instance.value.brand.elemID.getFullName()))
     .map(instance => ({
       elemID: instance.elemID,
       severity: 'Error',
       message: 'Cannot add this element because help center is not enabled for its associated brand, or the brand itself may not be enabled in the configuration.',
       detailedMessage: `please enable help center for brand "${instance.value.brand.elemID.name}" or enable the brand in the configuration in order to add this element.`,
     }))
 }
