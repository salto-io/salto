/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeValidator,
  getChangeData,
  isInstanceChange,
  isModificationChange,
  SeverityLevel,
} from '@salto-io/adapter-api'

export const defaultFieldConfigurationValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === 'FieldConfiguration')
    .filter(change => getChangeData(change).value.isDefault)
    .filter(
      change =>
        !(
          change.data.before.value.name === change.data.after.value.name &&
          change.data.before.value.description === change.data.after.value.description
        ),
    )
    .map(change => ({
      elemID: getChangeData(change).elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Modifying the default field configuration is not supported',
      detailedMessage: 'Modifying the default field configuration is not supported.',
    }))
