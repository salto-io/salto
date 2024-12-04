/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ChangeError, ChangeValidator, ElemID, getChangeIfInstanceChange, InstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { entries } from 'lodash'

const TYPES_WITH_RECORD_TYPE_VISIBILITY = new Set(['Profile'])

const createNoDefaultError = (id: ElemID, recordTypeVisibility: string): ChangeError => ({
  elemID: id,
  severity: 'Error',
  message: 'Must have one field that is set as default and visible',
  detailedMessage: `Must have one field that is set as default and visible, or no default fields and no visible fields, under ${id.getFullName()}.${recordTypeVisibility}`,
})

const getRecordTypeVisibilityNoDefaultError = async (change: InstanceElement | undefined): Promise<ChangeError[]> => {
  const record = change?.value?.recordTypeVisibilities
  if (!record) {
    return []
  }
  const recordEntries = entries(record)
  if (recordEntries.length === 0) {
    return []
  }
  const recordsOnly = recordEntries
    .map(b => {
      if (b.length < 2) {
        return undefined
      }
      return b[1]
    })
    .filter(a => a !== undefined)
  if (!recordsOnly) {
    return []
  }
  const elementsToCheck = recordsOnly
    .map(a => {
      if (a) {
        return Object.keys(a)
      } else {
        return undefined
      }
    })
    .filter(a => a !== undefined)
  if (
    !recordsOnly ||
    recordsOnly.length < 1 ||
    recordsOnly[0] === null ||
    recordsOnly[0] === undefined ||
    elementsToCheck[0] === undefined
  ) {
    return []
  }

  const changeErrors = recordsOnly.map((val, index) => {
    if (val) {
      if (!record) {
        return false
      }
      if (elementsToCheck[index] === undefined) {
        return true
      }
      const ans = elementsToCheck[index]?.reduce<Boolean[]>(
        (res, curr) => {
          if (res[0] === false && res[1] === true) {
            return res
          }
          const noDefaultNoVisible = res[0]
            ? !_.get(_.get(val, curr), 'default') && !_.get(_.get(val, curr), 'visible')
            : res[0]
          const oneDefaultIsVisible = res[1]
            ? res[1]
            : _.get(_.get(val, curr), 'default') && _.get(_.get(val, curr), 'visible')
          return [noDefaultNoVisible, oneDefaultIsVisible]
        },
        [true, false],
      )
      if (ans === undefined) {
        return true
      }
      const noDefaultNoVisible = ans[0] ?? true
      const oneDefaultIsVisible = ans[1] ?? true
      return noDefaultNoVisible || oneDefaultIsVisible
    }
  })
  return recordEntries
    .map((val, index) => {
      if (!changeErrors[index]) {
        return createNoDefaultError(change.elemID, `.recordTypeVisibilities.${val[0]}`)
      }
      return undefined
    })
    .filter(a => a != undefined)
}

const changeValidator: ChangeValidator = async changes => {
  const inst = changes.map(getChangeIfInstanceChange).filter(ch => ch !== undefined)
  const a = inst.filter(cha =>
    cha !== undefined ? TYPES_WITH_RECORD_TYPE_VISIBILITY.has(cha?.elemID.typeName) : false,
  )
  const q = a.map(getRecordTypeVisibilityNoDefaultError)
  if (q) {
  }
  return []
}

export default changeValidator
