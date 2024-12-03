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
  it('should error when holiday span is exactly 2 years', async () => {
    const holiday = createHolidayInstance('test_holiday', '2024-01-01', '2026-01-01')
    changes = [toChange({ after: holiday })]
    const errors = await businessHoursScheduleHolidayChangeValidator(changes)
    expect(errors).toMatchObject([
      {
        elemID: holiday.elemID,
        severity: 'Error',
        message: 'Holiday schedule duration is too long',
        detailedMessage:
          "Holiday schedule 'test_holiday' duration must be 2 years or less, current duration is from 2024-01-01 to 2026-01-01",
      },
    ])
  })
  it('should error when holiday span years difference is 2 and month difference larger than zero', async () => {
    const holiday = createHolidayInstance('test_holiday', '2022-01-01', '2024-02-01')
    changes = [toChange({ after: holiday })]
    const errors = await businessHoursScheduleHolidayChangeValidator(changes)
    expect(errors).toHaveLength(1)
  })
  it('should error when holiday span years difference is 2, month difference 0 and day difference larger than zero', async () => {
    const holiday = createHolidayInstance('test_holiday', '2024-01-01', '2026-01-05')
    changes = [toChange({ after: holiday })]
    const errors = await businessHoursScheduleHolidayChangeValidator(changes)
    expect(errors).toHaveLength(1)
  })
  it('should not error when holiday span years difference is less than 2', async () => {
    const holiday = createHolidayInstance('test_holiday', '2024-01-01', '2025-02-01')
    changes = [toChange({ after: holiday })]
    const errors = await businessHoursScheduleHolidayChangeValidator(changes)
    expect(errors).toHaveLength(0)
  })
})
