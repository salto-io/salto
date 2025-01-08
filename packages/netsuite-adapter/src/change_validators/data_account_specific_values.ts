/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeError,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isAdditionOrModificationChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { removeIdenticalValues } from '../filters/data_instances_diff'
import { isDataObjectType } from '../types'
import { MissingInternalId } from '../data_elements/suiteql_table_elements'
import { getResolvedAccountSpecificValue, getUnknownTypeReferencesMap } from '../filters/data_account_specific_values'
import { NetsuiteChangeValidator } from './types'
import { cloneChange } from './utils'

export const getResolvingErrors = ({
  instance,
  unknownTypeReferencesMap = {},
  suiteQLNameToInternalIdsMap,
}: {
  instance: InstanceElement
  unknownTypeReferencesMap?: Record<string, Record<string, string[]>>
  suiteQLNameToInternalIdsMap: Record<string, Record<string, string[]>>
}): { changeErrors: ChangeError[]; missingInternalIds: MissingInternalId[] } => {
  const changeErrors: ChangeError[] = []
  const missingInternalIds: MissingInternalId[] = []
  walkOnElement({
    element: instance,
    func: ({ path, value }) => {
      const { error, missingInternalId } = getResolvedAccountSpecificValue(
        path,
        value,
        unknownTypeReferencesMap,
        suiteQLNameToInternalIdsMap,
      )
      if (error !== undefined) {
        changeErrors.push(error)
      }
      if (missingInternalId !== undefined) {
        missingInternalIds.push(missingInternalId)
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
  return { changeErrors, missingInternalIds }
}

const changeValidator: NetsuiteChangeValidator = async (changes, { elementsSource, suiteQLNameToInternalIdsMap }) => {
  const relevantChangedInstances = changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(change => isDataObjectType(getChangeData<InstanceElement>(change).getTypeSync()))
    .map(change => {
      if (isAdditionChange(change)) {
        return change
      }
      const modificationChange = cloneChange(change)
      removeIdenticalValues(modificationChange)
      return modificationChange
    })
    .map(getChangeData)

  if (relevantChangedInstances.length === undefined) {
    return []
  }

  const unknownTypeReferencesMap = await getUnknownTypeReferencesMap(elementsSource)
  return relevantChangedInstances.flatMap(
    instance => getResolvingErrors({ instance, unknownTypeReferencesMap, suiteQLNameToInternalIdsMap }).changeErrors,
  )
}

export default changeValidator
