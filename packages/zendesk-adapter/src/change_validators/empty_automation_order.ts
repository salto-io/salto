/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { AUTOMATION_ORDER_TYPE_NAME } from '../constants'

export const emptyAutomationOrderValidator: ChangeValidator = async changes =>
  changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === AUTOMATION_ORDER_TYPE_NAME)
    .flatMap(instance => {
      if (_.isEmpty(instance.value.active) && _.isEmpty(instance.value.inactive)) {
        return [
          {
            elemID: instance.elemID,
            severity: 'Error',
            message: 'Cannot make this change due to empty automation order',
            detailedMessage: 'Automation order must have at least one active or inactive item',
          },
        ]
      }
      return []
    })
