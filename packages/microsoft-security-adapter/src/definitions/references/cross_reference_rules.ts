/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { references as referenceUtils } from '@salto-io/adapter-components'
import { ReferenceContextStrategies, CustomReferenceSerializationStrategyName } from '../types'
import { intuneConstants, entraConstants } from '../../constants'

export const REFERENCE_RULES: referenceUtils.FieldReferenceDefinition<
  ReferenceContextStrategies,
  CustomReferenceSerializationStrategyName
>[] = [
  {
    src: {
      field: 'notificationMessageCCList',
      parentTypes: [intuneConstants.DEVICE_COMPLIANCE_SCHEDULED_ACTION_CONFIGURATIONS_TYPE_NAME],
    },
    target: { type: entraConstants.GROUP_TYPE_NAME },
    serializationStrategy: 'id',
  },
  {
    src: {
      field: 'groupId',
      parentTypes: [intuneConstants.APPLICATION_ASSIGNMENTS_TARGET_TYPE_NAME],
    },
    target: { type: entraConstants.GROUP_TYPE_NAME },
    serializationStrategy: 'id',
  },
]
