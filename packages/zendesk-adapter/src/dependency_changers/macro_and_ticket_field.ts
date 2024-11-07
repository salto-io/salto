/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  dependencyChange,
  DependencyChange,
  DependencyChanger,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isModificationChange,
  isReferenceExpression,
  isRemovalChange,
} from '@salto-io/adapter-api'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { deployment, references as referencesUtils } from '@salto-io/adapter-components'
import _, { isArray } from 'lodash'
import { MACRO_TYPE_NAME, TICKET_FIELD_TYPE_NAME } from '../constants'

const { isDefined } = lowerDashValues
const { MISSING_REF_PREFIX } = referencesUtils

const getNameFromChange = (change: deployment.dependency.ChangeWithKey<Change<InstanceElement>>): string =>
  getChangeData(change.change).elemID.getFullName()

const getFieldsFromAction = (actions: unknown): string[] => {
  if (!isArray(actions)) {
    return []
  }
  return actions
    .map(action => action.field)
    .filter(field => isReferenceExpression(field))
    .filter(field => field.elemID.typeName === TICKET_FIELD_TYPE_NAME)
    .filter(ref => !ref.elemID.name.startsWith(MISSING_REF_PREFIX))
    .map(ref => ref.elemID.getFullName())
}

const getDependencies = (
  changes: deployment.dependency.ChangeWithKey<Change<InstanceElement>>[],
): DependencyChange[] => {
  const macroModificationChanges = changes.filter(
    change => getChangeData(change.change).elemID.typeName === MACRO_TYPE_NAME && isModificationChange(change.change),
  )
  const ticketFieldDeletionChange = changes.filter(
    change => getChangeData(change.change).elemID.typeName === TICKET_FIELD_TYPE_NAME && isRemovalChange(change.change),
  )

  const ticketFieldElemIdToChange = _.keyBy(ticketFieldDeletionChange, getNameFromChange)
  return macroModificationChanges
    .flatMap(change => {
      const changeData = change.change
      if (!isModificationChange(changeData)) {
        // shouldn't happen, only for typescript
        return undefined
      }
      const macroBeforeActions = changeData.data.before.value.actions ?? []
      const macroAfterActions = changeData.data.after.value.actions ?? []

      const beforeTickets = getFieldsFromAction(macroBeforeActions)
      const afterTickets = getFieldsFromAction(macroAfterActions)

      const deletedTickets = _.difference(beforeTickets, afterTickets)

      const newDependency = deletedTickets
        .map(name => {
          if (ticketFieldElemIdToChange[name] !== undefined) {
            return dependencyChange('add', ticketFieldElemIdToChange[name].key, change.key)
          }
          return undefined
        })
        .filter(isDefined)

      return newDependency
    })
    .filter(isDefined)
}

/**
 * This dependency changer is used to add dependency between article attachments and their parent article in the case
 * where the article attachment changes are additions and the article changes are modifications. This is because
 * addition of article attachments do not work without the deploy of the corresponding modified article.
 */
export const macroAndTicketFieldDependencyChanger: DependencyChanger = async changes => {
  const potentialChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter((change): change is deployment.dependency.ChangeWithKey<Change<InstanceElement>> =>
      isInstanceChange(change.change),
    )

  return getDependencies(potentialChanges)
}
