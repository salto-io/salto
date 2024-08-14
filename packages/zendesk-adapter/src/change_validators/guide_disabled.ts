/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  ChangeValidator,
  isInstanceChange,
  getChangeData,
  isAdditionChange,
  isReferenceExpression,
  InstanceElement,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { getInstancesFromElementSource } from '@salto-io/adapter-utils'
import { getBrandsForGuide } from '../filters/utils'
import { BRAND_TYPE_NAME } from '../constants'
import { GUIDE_TYPES_TO_HANDLE_BY_BRAND } from '../config'
import { ZendeskFetchConfig } from '../user_config'

const log = logger(module)

const isBrandWithHelpCenter = (instance: InstanceElement, brandByBrandId: Record<string, InstanceElement>): boolean => {
  const brandRef = instance.value.brand
  const brand = brandByBrandId[brandRef.elemID.getFullName()]
  return brand !== undefined && brand.value.has_help_center === true
}

export const guideDisabledValidator: (fetchConfig: ZendeskFetchConfig) => ChangeValidator =
  fetchConfig => async (changes, elementSource) => {
    if (elementSource === undefined) {
      log.error('Failed to run guideDisabledValidator because no element source was provided')
      return []
    }

    const relevantInstances = changes
      .filter(isInstanceChange)
      .filter(isAdditionChange)
      .map(getChangeData)
      .filter(instance => GUIDE_TYPES_TO_HANDLE_BY_BRAND.includes(instance.elemID.typeName))

    if (_.isEmpty(relevantInstances)) {
      return []
    }

    const brandByBrandId = Object.fromEntries(
      (await getInstancesFromElementSource(elementSource, [BRAND_TYPE_NAME])).map(instance => [
        instance.elemID.getFullName(),
        instance,
      ]),
    )

    const brandsWithGuide = new Set(
      getBrandsForGuide(Object.values(brandByBrandId), fetchConfig).map(brand => brand.elemID.getFullName()),
    )

    const allErrorInstances = relevantInstances
      .filter(instance => {
        const isRef = isReferenceExpression(instance.value.brand)
        if (!isRef) {
          log.debug(`instance ${instance.elemID.getFullName()} has no brand reference`)
        }
        return isRef
      })
      .filter(instance => !brandsWithGuide.has(instance.value.brand.elemID.getFullName()))

    return allErrorInstances.map(instance => {
      if (!isBrandWithHelpCenter(instance, brandByBrandId)) {
        return {
          elemID: instance.elemID,
          severity: 'Error',
          message: 'Cannot add this element because help center is not enabled for its associated brand.',
          detailedMessage: `Please enable help center for brand "${instance.value.brand.elemID.name}" in order to add this element.`,
        }
      }
      return {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Cannot add this element because its associated brand is not enabled in the configuration.',
        detailedMessage: `Please enable the brand "${instance.value.brand.elemID.name}" in the configuration in order to add this element.`,
      }
    })
  }
