/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import {
  ChangeValidator,
  ElemID,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isReferenceExpression,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { DASHBOARD_GADGET_TYPE } from '../constants'

const { awu } = collections.asynciterable

const log = logger(module)

export const getGadgetKey = (parentId: ElemID, row: number, column: number): string =>
  `${parentId.name}-${row}-${column}`

export const getGadgetInstanceKey = (instance: InstanceElement): string => {
  if (
    !isReferenceExpression(getParents(instance)[0]) ||
    instance.value.position?.row === undefined ||
    instance.value.position.column === undefined
  ) {
    throw new Error(`Received an invalid gadget ${instance.elemID.getFullName()}`)
  }

  return getGadgetKey(getParents(instance)[0].elemID, instance.value.position.row, instance.value.position.column)
}

export const dashboardGadgetsValidator: ChangeValidator = async (changes, elementsSource) => {
  if (elementsSource === undefined) {
    log.warn('Elements source was not passed to dashboardGadgetsValidator. Skipping validator')
    return []
  }

  const gadgetsMap = await awu(await elementsSource.list())
    .filter(id => id.typeName === DASHBOARD_GADGET_TYPE && id.idType === 'instance')
    .map(id => elementsSource.get(id))
    .groupBy(getGadgetInstanceKey)

  return awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === DASHBOARD_GADGET_TYPE)
    .filter(instance => gadgetsMap[getGadgetInstanceKey(instance)]?.length > 1)
    .map(async instance => ({
      elemID: instance.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Gadget position overlaps with existing gadgets',
      detailedMessage: `This gadget’s position clashes with other gadgets’ position: ${gadgetsMap[
        getGadgetInstanceKey(instance)
      ]
        .filter(gadget => !gadget.elemID.isEqual(instance.elemID))
        .map(gadget => gadget.elemID.getFullName())
        .join(', ')}. Change its position, or other gadgets’ position, and try again.`,
    }))
    .toArray()
}
