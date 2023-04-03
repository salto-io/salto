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

import { ChangeValidator, isInstanceChange, getChangeData, isAdditionChange, InstanceElement, isReferenceExpression } from '@salto-io/adapter-api'
import _ from 'lodash'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { GUIDE_TYPES_TO_HANDLE_BY_BRAND } from '../config'

const { isDefined } = lowerDashValues

const getBrandsWithGuideByInstanceId = async (instances: InstanceElement[]):
Promise<Record<string, InstanceElement>> => {
  const BrandsWithGuideByInstanceId = (await Promise.all(instances.map(async instance => {
    const brandRef = instance.value.brand
    if (!isReferenceExpression(brandRef)) {
      return undefined
    }
    const brand = await brandRef.getResolvedValue()
    if (brand.value.has_help_center === false) {
      return [instance.elemID.getFullName(), brand]
    }
    return undefined
  }))).filter(isDefined)
  return Object.fromEntries(BrandsWithGuideByInstanceId)
}

export const guideDisabledValidator: ChangeValidator = async changes => {
  const relevantInstances = changes
    .filter(isInstanceChange)
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(instance => GUIDE_TYPES_TO_HANDLE_BY_BRAND.includes(instance.elemID.typeName))
  if (_.isEmpty(relevantInstances)) {
    return []
  }

  const brandsWithGuideByInstanceId = await getBrandsWithGuideByInstanceId(relevantInstances)

  return relevantInstances.filter(instance =>
    instance.elemID.getFullName() in brandsWithGuideByInstanceId).map(instance => ({
    elemID: instance.elemID,
    severity: 'Error',
    message: 'Cannot add instance because its associated brand has help center disabled.',
    detailedMessage: `The brand "${brandsWithGuideByInstanceId[instance.elemID.getFullName()].elemID.name}" associated with this instance has help center disabled.`,
  }))
}
