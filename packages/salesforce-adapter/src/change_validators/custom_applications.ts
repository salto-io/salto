/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { Change, ChangeValidator, getChangeData, ChangeError } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'

const { awu } = collections.asynciterable

const createChangeError = (change: Change): ChangeError => ({
  elemID: getChangeData(change).elemID,
  severity: 'Warning',
  message: 'Custom application CV',
  detailedMessage: 'Testing pipe',
})

const changeValidator: ChangeValidator = async changes => {
  console.log('custom application pipe test')
  return awu(changes).map(createChangeError).toArray()
}

export default changeValidator
