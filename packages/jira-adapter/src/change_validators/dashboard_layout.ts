/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeValidator,
  getChangeData,
  isInstanceChange,
  isInstanceElement,
  isModificationChange,
  ReferenceExpression,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { DASHBOARD_TYPE } from '../constants'

const { awu } = collections.asynciterable

export const dashboardLayoutValidator: ChangeValidator = async changes =>
  awu(changes)
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(
      change =>
        change.data.before.value.layout !== change.data.after.value.layout &&
        change.data.after.value.layout !== undefined,
    )
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === DASHBOARD_TYPE)
    .map(instance => {
      const invalidGadgets = (instance.value.gadgets ?? [])
        .filter(isResolvedReferenceExpression)
        .filter((gadget: ReferenceExpression) => isInstanceElement(gadget.value))
        .filter((gadget: ReferenceExpression) => gadget.value.value.position.column >= instance.value.layout.length)

      if (invalidGadgets.length === 0) {
        return undefined
      }

      return {
        elemID: instance.elemID,
        severity: 'Error' as SeverityLevel,
        message: 'Dashboard gadget positions are out of bounds',
        detailedMessage: `This dashboard has gadgets with a column position which exceeds the number of columns (${instance.value.layout.length}) in the ${instance.value.layout} layout: ${invalidGadgets.map((gadget: ReferenceExpression) => gadget.elemID.name).join(', ')}. Please change the layout or re-position the gadgets to deploy this dashboard.`,
      }
    })
    .filter(values.isDefined)
    .toArray()
