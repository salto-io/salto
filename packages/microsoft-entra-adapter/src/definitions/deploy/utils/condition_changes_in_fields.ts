/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { getChangeData, isAdditionChange, isEqualValues, isModificationChange } from '@salto-io/adapter-api'
import { definitions } from '@salto-io/adapter-components'
import _ from 'lodash'

/*
 * Creates a custom condition that checks if the specified fields have changed in the change
 * For addition changes this means that the fields are not empty
 * For modification changes this means that the fields have different values
 * Make sure to use this custom condition for addition changes, since transformForCheck field is irrelevant for them.
 */
export const createCustomConditionCheckChangesInFields = (
  fieldNames: string[],
): definitions.deploy.DeployRequestCondition => ({
  custom:
    () =>
    ({ change }) => {
      if (isAdditionChange(change)) {
        return !_.isEmpty(_.pick(getChangeData(change).value, fieldNames))
      }
      if (isModificationChange(change)) {
        return !isEqualValues(_.pick(change.data.before.value, fieldNames), _.pick(change.data.after.value, fieldNames))
      }
      return false
    },
})
