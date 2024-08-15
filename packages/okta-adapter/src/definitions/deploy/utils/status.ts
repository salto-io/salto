/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { Change, getAllChangeData, InstanceElement, isModificationChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { ACTIVE_STATUS, INACTIVE_STATUS } from '../../../constants'

export const isActivationChange = (change: Change<InstanceElement>): boolean =>
  isModificationChange(change) &&
  _.isEqual(
    getAllChangeData(change).map(data => data.value.status),
    [INACTIVE_STATUS, ACTIVE_STATUS],
  )

export const isDeactivationChange = (change: Change<InstanceElement>): boolean =>
  isModificationChange(change) &&
  _.isEqual(
    getAllChangeData(change).map(data => data.value.status),
    [ACTIVE_STATUS, INACTIVE_STATUS],
  )
