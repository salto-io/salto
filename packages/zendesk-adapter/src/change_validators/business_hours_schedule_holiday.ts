/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import {
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { inspectValue } from '@salto-io/adapter-utils'
import { BUSINESS_HOUR_SCHEDULE_HOLIDAY } from '../constants'

const log = logger(module)

type BusinessHoursScheduleHoliday = {
  start_date: string
  end_date: string
}

const hasStartDate = (value: unknown): boolean => _.isString(_.get(value, 'start_date'))

const hasEndDate = (value: unknown): boolean => _.isString(_.get(value, 'end_date'))

const isBusinessHoursScheduleHoliday = (value: unknown): value is BusinessHoursScheduleHoliday =>
  _.isObject(value) && hasStartDate(value) && hasEndDate(value)

const isDateRangeExceedsLimit = (instance: InstanceElement): boolean => {
  const { value } = instance
  if (!isBusinessHoursScheduleHoliday(value)) {
    log.error(
      `Invalid business hours schedule holiday instance encountered. Expected an object with valid 'start_date' and 'end_date' fields, but received: ${inspectValue(value)}`,
    )
    return false
  }
  const startDate = new Date(value.start_date)
  const endDate = new Date(value.end_date)
  const currentDate = new Date(Date.now())
  const twoYearsInMs = 1000 * 60 * 60 * 24 * 365 * 2
  const differenceToStartDate = Math.abs(currentDate.getTime() - startDate.getTime())
  const differenceToEndDate = Math.abs(currentDate.getTime() - endDate.getTime())
  return differenceToStartDate >= twoYearsInMs || differenceToEndDate >= twoYearsInMs
}

// Ensures that the start date is no sooner than two years in the past and
// end date no later than two years in the future (Zendesk limit).
// Assumes that the start and end dates are in a valid date format.
export const businessHoursScheduleHolidayChangeValidator: ChangeValidator = async changes =>
  changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === BUSINESS_HOUR_SCHEDULE_HOLIDAY)
    .filter(isDateRangeExceedsLimit)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Holiday schedule dates are outside the allowed range',
      detailedMessage: `Holiday schedule ‘${instance.value.name || instance.elemID.name}’ has invalid dates. The start and end dates must be within two years from ${new Date().toISOString().split('T')[0]}.`,
    }))
