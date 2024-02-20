/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
