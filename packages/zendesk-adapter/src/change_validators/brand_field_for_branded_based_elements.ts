/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
