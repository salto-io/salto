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
  isAdditionChange,
  isInstanceChange,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { AUTOMATION_TYPE } from '../../constants'

const { awu } = collections.asynciterable

const log = logger(module)

export const automationsValidator: ChangeValidator = async (changes, elementsSource) => {
  if (elementsSource === undefined) {
    log.warn('Skipping automationsValidator due to missing elements source')
    return []
  }

  const automationChangesData = changes
    .filter(isInstanceChange)
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === AUTOMATION_TYPE)

  if (automationChangesData.length === 0) {
    return []
  }

  const nameToAutomations = await awu(await elementsSource.list())
    .filter(id => id.typeName === AUTOMATION_TYPE && id.idType === 'instance')
    .map(id => elementsSource.get(id))
    .groupBy(instance => instance.value.name)

  return automationChangesData
    .filter(instance => nameToAutomations[instance.value.name].length > 1)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Automation name is already in use',
      detailedMessage: `The automation name “${instance.value.name}” is already used by other automations in the target environment. To deploy this automation using Salto, rename it and try again.`,
    }))
}
