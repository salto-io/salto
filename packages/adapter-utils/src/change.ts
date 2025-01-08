/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Element,
  Change,
  DetailedChange,
  isAdditionOrModificationChange,
  isRemovalOrModificationChange,
  toChange,
} from '@salto-io/adapter-api'

const hasElemIDs = <T extends Change | DetailedChange>(
  change: T,
): change is T & Required<Pick<DetailedChange, 'elemIDs'>> => 'elemIDs' in change && change.elemIDs !== undefined

const hasBaseChange = <T extends Change | DetailedChange>(
  change: T,
): change is T & Required<Pick<DetailedChange, 'baseChange'>> =>
  'baseChange' in change && change.baseChange !== undefined

const reverseBaseChange = <T extends Element>(change: Change<T>): Change<T> => {
  const before = isAdditionOrModificationChange(change) ? change.data.after : undefined
  const after = isRemovalOrModificationChange(change) ? change.data.before : undefined
  return toChange({ before, after })
}

export const reverseChange = <T extends Change | DetailedChange>(change: T): T => {
  const reversedChange = reverseBaseChange(change)

  const reversedElemIDs = hasElemIDs(change)
    ? { elemIDs: { before: change.elemIDs.after, after: change.elemIDs.before } }
    : {}

  const reversedBaseChange = hasBaseChange(change) ? { baseChange: reverseBaseChange(change.baseChange) } : {}

  return {
    ...change,
    ...reversedChange,
    ...reversedElemIDs,
    ...reversedBaseChange,
  }
}
