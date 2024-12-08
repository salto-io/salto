/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  ChangeError,
  ChangeValidator,
  ElemID,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  Value,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { PROFILE_METADATA_TYPE } from '../constants'

const { isDefined } = values

type fieldsFlags = { noDefaultNoVisibleFlag: boolean; oneDefaultIsVisibleFlag: boolean }

const createNoDefaultError = (id: ElemID, recordTypeVisibility: string): ChangeError => ({
  elemID: id,
  severity: 'Error',
  message: 'Must have one field that is set as default and visible',
  detailedMessage: `Must have one field that is set as default and visible, or no default fields and no visible fields, under ${id.getFullName()}.${recordTypeVisibility}`,
})

const getRecEntryFields = (entry: [string, unknown]): Value | undefined => {
  if (entry.length < 2) {
    return undefined
  }
  return entry[1] ?? undefined
}

const getKeys = (entryFields: Value | undefined): string[] | undefined => {
  if (entryFields) {
    return Object.keys(entryFields)
  }
  return undefined
}

/*
 * this function checks the relevant fields if they're valid
 * valid option 1: no default field is true and no visible field is true (marked initially as true [valid] in res[0], and changed to false [invalid] in case of default or visible field being true)
 * valid option 2: there is exactly one element with default field as true and it's visible field is also true (marked initially as false [invalid] in res[1], and changed to true [valid] in case one element's default and visible fields are true)
 * NOTICE: although it is not allowed to have more than one element with default field set to true, this CV doesn't check for this case because it is caught in the 'multiple_defaults' CV
 */
const isValidRecord2 = (records: (Value | undefined)[], fieldsToCheck: (string[] | undefined)[]): boolean[] =>
  records.map((val, index) => {
    if (val) {
      if (fieldsToCheck[index] === undefined) {
        return true
      }
      const ans = fieldsToCheck[index]?.reduce<fieldsFlags>(
        (res, curr) => {
          if (!res.noDefaultNoVisibleFlag && res.oneDefaultIsVisibleFlag) {
            return res
          }
          const noDefaultNoVisible = res.noDefaultNoVisibleFlag
            ? !_.get(_.get(val, curr), 'default') && !_.get(_.get(val, curr), 'visible')
            : res.noDefaultNoVisibleFlag
          const oneDefaultIsVisible = res.oneDefaultIsVisibleFlag
            ? res.oneDefaultIsVisibleFlag
            : _.get(_.get(val, curr), 'default') && _.get(_.get(val, curr), 'visible')
          return { noDefaultNoVisibleFlag: noDefaultNoVisible, oneDefaultIsVisibleFlag: oneDefaultIsVisible }
        },
        { noDefaultNoVisibleFlag: true, oneDefaultIsVisibleFlag: false },
      )
      if (ans === undefined) {
        return true
      }
      const noDefaultNoVisible = ans.noDefaultNoVisibleFlag ?? true
      const oneDefaultIsVisible = ans.oneDefaultIsVisibleFlag ?? true
      return noDefaultNoVisible || oneDefaultIsVisible
    }
    return true
  })

const isValidRecord = (recordTypeVisibility: Value): boolean => {
  const keys = Object.keys(recordTypeVisibility).reduce<fieldsFlags>(
    (res, curr) => {
      if (!res.noDefaultNoVisibleFlag && res.oneDefaultIsVisibleFlag) {
        return res
      }
      const defaultVal = _.get(_.get(recordTypeVisibility, curr), 'default')
      const visibileVal = _.get(_.get(recordTypeVisibility, curr), 'visible')
      const noDefaultNoVisible = res.noDefaultNoVisibleFlag ? defaultVal && visibileVal : res.noDefaultNoVisibleFlag
      const oneDefaultIsVisible = res.oneDefaultIsVisibleFlag ? res.oneDefaultIsVisibleFlag : defaultVal && visibileVal
      return { noDefaultNoVisibleFlag: noDefaultNoVisible, oneDefaultIsVisibleFlag: oneDefaultIsVisible }
    },
    { noDefaultNoVisibleFlag: true, oneDefaultIsVisibleFlag: false },
  )
}

const fromEntriesToNameAndFlag = (entry: [string, Value]): [string, boolean] => [entry[0], isValidRecord(entry[1])]
const getRecordTypeVisibilityNoDefaultError = (change: InstanceElement): ChangeError[] => {
  const recordTypeVisibility = change?.value?.recordTypeVisibilities
  if (!recordTypeVisibility) {
    return []
  }
  const recordEntries = _.entries(recordTypeVisibility).map(fromEntriesToNameAndFlag)
  if (recordEntries.length === 0) {
    return []
  }
  const recordsOnly = recordEntries.map(getRecEntryFields).filter(a => a !== undefined)
  if (!recordsOnly) {
    return []
  }
  const elementsToCheck = recordsOnly.map(getKeys).filter(a => a !== undefined)
  const changeErrors = isValidRecord(recordsOnly, elementsToCheck)
  return recordEntries
    .map((val, index) => {
      if (!changeErrors[index]) {
        return createNoDefaultError(change.elemID, `recordTypeVisibilities.${val[0]}`)
      }
      return undefined
    })
    .filter(isDefined)
}

const changeValidator: ChangeValidator = async changes => {
  const errors = changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(change => change.elemID.typeName === PROFILE_METADATA_TYPE)
    .map(getRecordTypeVisibilityNoDefaultError)
  const resolved = await Promise.all(errors)
  return resolved.flat()
}

export default changeValidator
