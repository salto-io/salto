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

import { ChangeValidator, isInstanceChange, getChangeData, isAdditionChange, InstanceElement, isReferenceExpression, isInstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { BRAND_TYPE_NAME } from '../constants'
import { GUIDE_TYPES_TO_HANDLE_BY_BRAND } from '../config'

const { isDefined } = lowerDashValues
const log = logger(module)
const { awu } = collections.asynciterable

const getBrandsWithoutGuideByInstanceId = async (
  instances: InstanceElement[], BrandsByBrandsId: Record<string, InstanceElement>):
Promise<Record<string, InstanceElement>> => {
  const BrandsWithoutGuideByInstanceId = (await Promise.all(instances.map(async instance => {
    const brandRef = instance.value.brand
    if (!isReferenceExpression(brandRef)) {
      log.debug('brand is not a reference expression')
      return undefined
    }
    const brand = BrandsByBrandsId[brandRef.elemID.getFullName()]
    if (brand.value.has_help_center === false) {
      return [instance.elemID.getFullName(), brand]
    }
    return undefined
  }))).filter(isDefined)
  return Object.fromEntries(BrandsWithoutGuideByInstanceId)
}

export const guideDisabledValidator: ChangeValidator = async (changes, elementSource) => {
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

  const BrandsByBrandsId = Object.fromEntries((await awu(await elementSource.list())
    .filter(id => id.typeName === BRAND_TYPE_NAME)
    .map(id => elementSource.get(id))
    .filter(isInstanceElement)
    .toArray()).map(instance => [instance.elemID.getFullName(), instance]))
  if (_.isEmpty(BrandsByBrandsId)) {
    return []
  }

  const brandsWithoutGuideByInstanceId = await getBrandsWithoutGuideByInstanceId(relevantInstances, BrandsByBrandsId)

  return relevantInstances
    .filter(instance =>
      instance.elemID.getFullName() in brandsWithoutGuideByInstanceId).map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Cannot add instance because its associated brand has help center disabled.',
      detailedMessage: `The brand "${brandsWithoutGuideByInstanceId[instance.elemID.getFullName()].elemID.name}" associated with this instance has help center disabled.`,
    }))
}
