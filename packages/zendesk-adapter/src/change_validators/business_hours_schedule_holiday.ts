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
import { BUSINESS_HOUR_SCHEDULE_HOLIDAY } from '../constants'

type BusinessHoursScheduleHoliday = {
  start_date: string
  end_date: string
}

const hasStartDate = (value: unknown): boolean => _.isString(_.get(value, 'start_date'))

const hasEndDate = (value: unknown): boolean => _.isString(_.get(value, 'end_date'))

const isBusinessHoursScheduleHoliday = (value: unknown): value is BusinessHoursScheduleHoliday =>
  _.isObject(value) && hasStartDate(value) && hasEndDate(value)

const isHolidaySpanTooLong = (instance: InstanceElement): boolean => {
  const values: unknown = instance.value
  if (!isBusinessHoursScheduleHoliday(values)) {
    return false
  }
  const startDate = new Date(values.start_date)
  const endDate = new Date(values.end_date)
  const yearDifference = endDate.getFullYear() - startDate.getFullYear()
  const monthDifference = endDate.getMonth() - startDate.getMonth()
  const dayDifference = endDate.getDate() - startDate.getDate()
  if (
    yearDifference > 2 ||
    (yearDifference === 2 && (monthDifference > 0 || (monthDifference === 0 && dayDifference >= 0)))
  ) {
    return true
  }
  return false
}

// Ensures that the holiday duration is less than 2 years (Zendesk limit).
// Assumes that the start and end dates are in a valid date format.
export const businessHoursScheduleHolidayChangeValidator: ChangeValidator = async changes =>
  changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === BUSINESS_HOUR_SCHEDULE_HOLIDAY)
    .filter(isHolidaySpanTooLong)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Holiday schedule duration is too long',
      detailedMessage: `Holiday schedule '${instance.value.name || instance.elemID.name}' duration must be 2 years or less, current duration is from ${instance.value.start_date} to ${instance.value.end_date}`,
    }))
