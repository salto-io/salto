/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import {
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { FIELD_CONFIGURATION_DESCRIPTION_MAX_LENGTH, FIELD_CONFIGURATION_TYPE_NAME } from '../../constants'

export const fieldConfigurationDescriptionLengthValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(inst => inst.elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME)
    .filter(inst => inst.value.description.length > FIELD_CONFIGURATION_DESCRIPTION_MAX_LENGTH)
    .map(inst => ({
      elemID: inst.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Field configuration description length exceeded maximum.',
      detailedMessage: `Field configuration description length (${inst.value.description.length}) exceeded the allowed maximum of ${FIELD_CONFIGURATION_DESCRIPTION_MAX_LENGTH} characters.`,
    }))
