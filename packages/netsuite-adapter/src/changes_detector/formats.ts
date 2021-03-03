/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { DateRange } from './types'

export const formatSuiteQLDate = (date: Date): string => `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()}`

export const formatSavedSearchDate = (date: Date): string => {
  const hour = date.getUTCHours() > 12 ? date.getUTCHours() - 12 : date.getUTCHours()
  const dayTime = date.getUTCHours() >= 12 ? 'pm' : 'am'
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()} ${hour}:${date.getUTCMinutes()} ${dayTime}`
}

export const formatSuiteQLDateRange = (dateRange: DateRange): [string, string] => {
  const endDate = new Date(dateRange.end)
  endDate.setDate(endDate.getDate() + 1)
  return [formatSuiteQLDate(dateRange.start), formatSuiteQLDate(endDate)]
}

export const formatSavedSearchDateRange = (dateRange: DateRange): [string, string] => {
  const endDate = new Date(dateRange.end)
  endDate.setMinutes(endDate.getMinutes() + 1)
  return [formatSavedSearchDate(dateRange.start), formatSavedSearchDate(endDate)]
}
