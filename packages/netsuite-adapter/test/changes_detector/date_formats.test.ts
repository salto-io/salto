/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { convertSavedSearchStringToDate, convertSuiteQLStringToDate } from '../../src/changes_detector/date_formats'

const fallback = new Date(Date.UTC(2023, 2, 2, 13, 6))

describe('convertSavedSearchStringToDate', () => {
  it('convert correctly', () => {
    expect(convertSavedSearchStringToDate('03/02/2020 1:05 pm', fallback)).toEqual(
      new Date(Date.UTC(2020, 2, 2, 13, 6)),
    )
    expect(convertSavedSearchStringToDate('03/02/2020 12:05 pm', fallback)).toEqual(
      new Date(Date.UTC(2020, 2, 2, 12, 6)),
    )
    expect(convertSavedSearchStringToDate('03/02/2020 8:05 am', fallback)).toEqual(new Date(Date.UTC(2020, 2, 2, 8, 6)))
    expect(convertSavedSearchStringToDate('03/02/2020 12:05 am', fallback)).toEqual(
      new Date(Date.UTC(2020, 2, 2, 0, 6)),
    )
  })

  it('should return undefined for invalid date', () => {
    expect(convertSavedSearchStringToDate('invalid', fallback)).toEqual(fallback)
  })
})

describe('convertSuiteQLStringToDate', () => {
  it('convert correctly', () => {
    expect(convertSuiteQLStringToDate('2020-03-02 13:05:20', fallback)).toEqual(
      new Date(Date.UTC(2020, 2, 2, 13, 5, 20)),
    )
  })

  it('should return undefined for invalid date', () => {
    expect(convertSuiteQLStringToDate('invalid', fallback)).toEqual(fallback)
  })
})
