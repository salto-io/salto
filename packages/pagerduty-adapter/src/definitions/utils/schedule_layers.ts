/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { definitions } from '@salto-io/adapter-components'
import { getChangeData } from '@salto-io/adapter-api'
import { getParent } from '@salto-io/adapter-utils'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'

const log = logger(module)

const addStartTime = (value: unknown): Record<string, unknown> => {
  if (!lowerdashValues.isPlainRecord(value) || value.rotation_virtual_start === undefined) {
    throw new Error('Can not adjust when the value is not an object')
  }
  return { ...value, start: value.rotation_virtual_start }
}

export const addStartToLayers: definitions.AdjustFunctionSingle<definitions.deploy.ChangeAndExtendedContext> = async ({
  value,
}) => {
  if (!lowerdashValues.isPlainRecord(value)) {
    throw new Error('Can not adjust when the value is not an object')
  }
  const layers = _.get(value, 'schedule.schedule_layers')
  if (!Array.isArray(layers)) {
    log.trace('No schedule layers found')
    return { value }
  }
  return { value: _.set(value, 'schedule.schedule_layers', layers.map(addStartTime)) }
}

export const addTimeZone: definitions.AdjustFunctionSingle<definitions.deploy.ChangeAndExtendedContext> = async ({
  value,
  context,
}) => ({
  value: {
    schedule: { schedule_layers: [addStartTime(value)], time_zone: _.get(context, 'additionalContext.time_zone') },
  },
})

export const shouldChangeLayer: definitions.deploy.DeployRequestCondition = {
  custom:
    () =>
    ({ changeGroup, change }) =>
      !changeGroup.changes.some(
        changeFromGroup =>
          getChangeData(changeFromGroup).elemID.getFullName() === getParent(getChangeData(change)).elemID.getFullName(),
      ),
}
