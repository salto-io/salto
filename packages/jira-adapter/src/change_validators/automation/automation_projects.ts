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
import _ from 'lodash'
import { AUTOMATION_TYPE } from '../../constants'

export const automationProjectsValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === AUTOMATION_TYPE)
    .filter(instance => _.isEqual(instance.value.projects, []))
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Cannot deploy automation without projects.',
      detailedMessage:
        'In order to deploy an automation it must be either global, assigned to at least one project type, or assigned to at least one project that exist in the current environment. To learn more, go to https://help.salto.io/en/articles/9763118-can-t-deploy-a-non-global-automation-without-projects',
    }))
