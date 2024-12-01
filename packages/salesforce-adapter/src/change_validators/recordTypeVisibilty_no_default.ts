/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ChangeError, ChangeValidator, getChangeIfInstanceChange, InstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { entries } from 'lodash'

const TYPES_WITH_RECORD_TYPE_VISIBILITY = new Set(['Profile'])

// const checkError = (record: Object | null, index: number, fields: string[][] | undefined[]): boolean => {
//   if (!record) {
//     return false
//   }
//   if (fields[index] === undefined) {
//     return true
//   }
//   const ans1 = fields[index].reduce((res, curr) => {
//     if (res === 'false') {
//       return res
//     }
//     const currRes = !_.get(_.get(record, [curr]), 'default') && !_.get(_.get(record, [curr]), 'visible')
//     return currRes ? 'true' : 'false'
//   }, 'true')

//   return ans1 === 'false'
// }

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

  //now go over all elements in recordsOnly, and for each check their fields from elementsToCheck
  //check if one of the two legal options happens:
  //all are set to default false and visible false
  //only one set to default and its visibility is also true

  // note that the check is separate for each element in recordsOnly (klomar - every element of recordsOnly should follow the two rules)
  //
  const instancesWithErrors = recordEntries
    .map((val, index) => {
      if (!changeErrors[index]) {
        return `${change.elemID.getFullName()}.recordTypeVisibilities.${val[0]}`
      }
      return undefined
    })
    .filter(a => a != undefined)
  const c = recordsOnly[0][elementsToCheck[0][0] as keyof Object]
  const d = _.get(c, 'default')
  if (d === undefined || instancesWithErrors) {
  }
  return []
}

const changeValidator: ChangeValidator = async changes => {
  const inst = changes.map(getChangeIfInstanceChange).filter(ch => ch !== undefined)
  const a = inst.filter(cha =>
    cha !== undefined ? TYPES_WITH_RECORD_TYPE_VISIBILITY.has(cha?.elemID.typeName) : false,
  )
  const q = a.map(getRecordTypeVisibilityNoDefaultError)
  const n = a
    .map(e => e?.value?.recordTypeVisibilities)
    .filter(e => e !== undefined)
    .map(a => entries(a))
  const m = n.filter(a => a.length > 0)
  const l = m.map(a =>
    a.map(b => {
      if (b.length < 2) {
        return undefined
      }
      return b[1]
    }),
  )
  const t = l.map(a =>
    a.filter(b => {
      if (typeof b !== 'object' || b === null) {
        return false
      }
      return Object.keys(b).length > 1
    }),
  )
  const tt = t.map(c =>
    c.map(p => {
      if (typeof p !== 'object' || p === null) {
        return null
      }
      const temp = Object.entries(p).reduce((acc, curr) => {
        acc = curr[1].default ? acc + 1 : acc
        return acc
      }, 0)
      return temp
    }),
  ) // from tt need to filter all that have more than one - meaning more than one default
  //check what happens if there is more than one default

  const p = tt.map(a => a.filter(b => (b ? b < 1 : false)))

  if (p || q) {
  }
  return []
}

export default changeValidator
