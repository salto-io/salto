/*
 * Copyright 2024 Salto Labs Ltd.
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

  const createHolidayInstance = (name: string, startDate: string, endDate: string): InstanceElement =>
    new InstanceElement(name, new ObjectType({ elemID: new ElemID(ZENDESK, BUSINESS_HOUR_SCHEDULE_HOLIDAY) }), {
      name,
      start_date: startDate,
      end_date: endDate,
    })

  const dateYearsAgo = (years: number): string => {
    const date = new Date()
    date.setFullYear(date.getFullYear() - years)
    return date.toISOString()
  }

  const dateYearsFromNow = (years: number): string => {
    const date = new Date()
    date.setFullYear(date.getFullYear() + years)
    return date.toISOString()
  }

  describe('when validating holiday schedule duration', () => {
    it('should error when duration is exactly 2 years', async () => {
      const holiday = createHolidayInstance('test_holiday', dateYearsAgo(2), new Date().toISOString())
      changes = [toChange({ after: holiday })]

      const errors = await businessHoursScheduleHolidayChangeValidator(changes)
      expect(errors).toMatchObject([
        {
          elemID: holiday.elemID,
          severity: 'Error',
          message: 'Holiday schedule dates are outside the allowed range',
          detailedMessage: `Holiday schedule 'test_holiday' has invalid dates. The start date must not be earlier than two years before the current date ${new Date().toISOString().split('T')[0]}, and the end date must not be later than two years after the current date. Provided dates are from ${dateYearsAgo(2).split('T')[0]} to ${new Date().toISOString().split('T')[0]}.`,
        },
      ])
    })

    it('should error when duration is more than 2 years', async () => {
      const holiday = createHolidayInstance('test_holiday', dateYearsAgo(3), new Date().toISOString())
      changes = [toChange({ after: holiday })]

      const errors = await businessHoursScheduleHolidayChangeValidator(changes)
      expect(errors).toHaveLength(1)
    })

    it('should not error when duration is less than 2 years', async () => {
      const holiday = createHolidayInstance('test_holiday', dateYearsAgo(1), new Date().toISOString())
      changes = [toChange({ after: holiday })]

      const errors = await businessHoursScheduleHolidayChangeValidator(changes)
      expect(errors).toHaveLength(0)
    })

    it('should handle future dates correctly', async () => {
      const holiday = createHolidayInstance('test_holiday', new Date().toISOString(), dateYearsFromNow(3))
      changes = [toChange({ after: holiday })]

      const errors = await businessHoursScheduleHolidayChangeValidator(changes)
      expect(errors).toHaveLength(1)
    })

    it('should handle invalid date formats gracefully', async () => {
      const holiday = createHolidayInstance('test_holiday', 'invalid-date', 'also-invalid')
      changes = [toChange({ after: holiday })]

      const errors = await businessHoursScheduleHolidayChangeValidator(changes)
      expect(errors).toHaveLength(0)
    })

    it('should handle missing dates', async () => {
      const holiday = new InstanceElement(
        'test_holiday',
        new ObjectType({ elemID: new ElemID(ZENDESK, BUSINESS_HOUR_SCHEDULE_HOLIDAY) }),
        { name: 'test_holiday' },
      )
      changes = [toChange({ after: holiday })]

      const errors = await businessHoursScheduleHolidayChangeValidator(changes)
      expect(errors).toHaveLength(0)
    })
  })
})
