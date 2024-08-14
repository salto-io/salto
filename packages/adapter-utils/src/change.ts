/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  DetailedChange,
  isAdditionOrModificationChange,
  isRemovalOrModificationChange,
  toChange,
} from '@salto-io/adapter-api'

const hasElemIDs = <T extends Change | DetailedChange>(change: T): change is T & Pick<DetailedChange, 'elemIDs'> =>
  'elemIDs' in change

export const reverseChange = <T extends Change | DetailedChange>(change: T): T => {
  const before = isAdditionOrModificationChange(change) ? change.data.after : undefined
  const after = isRemovalOrModificationChange(change) ? change.data.before : undefined
  const reversedElemIDs =
    hasElemIDs(change) && change.elemIDs !== undefined
      ? { elemIDs: { before: change.elemIDs.after, after: change.elemIDs.before } }
      : {}

  return {
    ...change,
    ...toChange({ before, after }),
    ...reversedElemIDs,
  }
}
