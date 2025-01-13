/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { Change, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { BUSINESS_HOUR_SCHEDULE_HOLIDAY, ZENDESK } from '../../src/constants'
import { businessHoursScheduleHolidayChangeValidator } from '../../src/change_validators'

describe('businessHoursScheduleHolidayChangeValidator', () => {
  let changes: Change<InstanceElement>[]
  const date = new Date()

  const createHolidayInstance = (name: string, startDate: string, endDate: string): InstanceElement =>
    new InstanceElement(name, new ObjectType({ elemID: new ElemID(ZENDESK, BUSINESS_HOUR_SCHEDULE_HOLIDAY) }), {
      name,
      start_date: startDate,
      end_date: endDate,
    })

  const dateYearsAgo = (years: number): string => {
    const newDate = new Date(date.toDateString())
    newDate.setFullYear(date.getFullYear() - years)
    return newDate.toISOString()
  }

  const dateYearsFromNow = (years: number): string => {
    const newDate = new Date(date.toDateString())
    newDate.setFullYear(date.getFullYear() + years)
    return newDate.toISOString()
  }

  it('should error when start date is exactly 2 years sooner', async () => {
    const holiday = createHolidayInstance('test_holiday', dateYearsAgo(2), date.toISOString())
    changes = [toChange({ after: holiday })]

    const errors = await businessHoursScheduleHolidayChangeValidator(changes)
    expect(errors).toMatchObject([
      {
        elemID: holiday.elemID,
        severity: 'Error',
        message: 'Holiday schedule dates are outside the allowed range',
        detailedMessage: `Holiday schedule ‘test_holiday’ has invalid dates. The start and end dates must be within two years from ${date.toISOString().split('T')[0]}.`,
      },
    ])
  })
  it('should error when end date is exactly 2 years to the future', async () => {
    const holiday = createHolidayInstance('test_holiday', date.toISOString(), dateYearsFromNow(2))
    changes = [toChange({ after: holiday })]
    const errors = await businessHoursScheduleHolidayChangeValidator(changes)
    expect(errors).toHaveLength(1)
  })
  it('should error when start date is more than 2 years sooner', async () => {
    const holiday = createHolidayInstance('test_holiday', dateYearsAgo(3), date.toISOString())
    changes = [toChange({ after: holiday })]
    const errors = await businessHoursScheduleHolidayChangeValidator(changes)
    expect(errors).toHaveLength(1)
  })
  it('should error when start date is more than 2 years in the future', async () => {
    const holiday = createHolidayInstance('test_holiday', date.toISOString(), dateYearsFromNow(3))
    changes = [toChange({ after: holiday })]
    const errors = await businessHoursScheduleHolidayChangeValidator(changes)
    expect(errors).toHaveLength(1)
  })
  it('should not error date range is less than 2 years', async () => {
    const holiday = createHolidayInstance('test_holiday', dateYearsAgo(1), date.toISOString())
    changes = [toChange({ after: holiday })]

    const errors = await businessHoursScheduleHolidayChangeValidator(changes)
    expect(errors).toHaveLength(0)
  })
})
