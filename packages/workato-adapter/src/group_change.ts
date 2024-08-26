/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { deployment } from '@salto-io/adapter-components'
import { isInstanceChange, isAdditionOrModificationChange, getChangeData } from '@salto-io/adapter-api'
import { DEPLOY_USING_RLM_GROUP, RLM_DEPLOY_SUPPORTED_TYPES } from './constants'

export const getRLMGroupId: deployment.grouping.ChangeIdFunction = async change =>
  isAdditionOrModificationChange(change) &&
  isInstanceChange(change) &&
  RLM_DEPLOY_SUPPORTED_TYPES.includes(getChangeData(change).elemID.typeName)
    ? DEPLOY_USING_RLM_GROUP
    : undefined

export const getChangeGroupIds = deployment.grouping.getChangeGroupIdsFunc([getRLMGroupId])
