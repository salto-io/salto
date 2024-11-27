/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Change, getChangeData, InstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { get, invert } from 'lodash'
import { TRIGGER_TYPE_NAME } from '../constants'
import { PRIORITY_NAMES, TRIGGER_SKILL_FIELDS } from '../definitions/fetch/transforms/trigger_adjuster'
import { FilterCreator } from '../filter'

const log = logger(module)

const PRIORITY_NUMBERS: { [key: string]: string } = {
  ...invert(PRIORITY_NAMES),
  optional: '1', // 'optional' is for backwards compatibility
}

const extractPriorityNumber = (priority: string): string => {
  if (priority in PRIORITY_NUMBERS) {
    return PRIORITY_NUMBERS[priority]
  }
  if (priority.match(/unknown_\d+/)) {
    return priority.split('_')[1]
  }
  log.warn('Received unknown priority: %s', priority)
  return priority
}

const restoreTriggerSkillToApi = async (
  instance: InstanceElement,
  skillMapping: Record<string, { value: string; priority: string }>,
): Promise<void> => {
  instance.value?.actions
    .filter((action: unknown) => TRIGGER_SKILL_FIELDS.includes(get(action, 'field')))
    .forEach((action: { value?: string; priority?: string }) => {
      if ('priority' in action && 'value' in action) {
        const { value, priority } = action as { value: string; priority: string }
        action.value = `${value}#${extractPriorityNumber(priority)}`
        skillMapping[action.value] = { value, priority }
        delete action.priority
      }
    })
}

/**
 * Restores trigger action skills to match the correct API calls.
 * See https://developer.zendesk.com/documentation/ticketing/using-the-zendesk-api/setting-skill-priority-with-skills-in-trigger-action/
 */
const filterCreator: FilterCreator = () => {
  const skillMapping: Record<string, { value: string; priority: string }> = {}
  return {
    name: 'deployTriggerSkillsFilter',
    preDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
      await Promise.all(
        changes
          .map(getChangeData)
          .filter(instance => instance.elemID.typeName === TRIGGER_TYPE_NAME)
          .map(instance => restoreTriggerSkillToApi(instance, skillMapping)),
      )
    },
    onDeploy: async (changes: Change<InstanceElement>[]): Promise<void> =>
      changes
        .map(getChangeData)
        .filter(instance => instance.elemID.typeName === TRIGGER_TYPE_NAME && Array.isArray(instance.value?.actions))
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        .forEach(async instance => {
          instance.value.actions = instance.value.actions.map((action: { value: string }) => {
            if (skillMapping[action.value]) {
              return {
                ...action,
                value: skillMapping[action.value].value,
                priority: skillMapping[action.value].priority,
              }
            }
            return action
          })
        }),
  }
}

export default filterCreator
