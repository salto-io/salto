/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { definitions } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import _ from 'lodash'

const log = logger(module)

export const TRIGGER_SKILL_FIELDS = ['add_skills', 'set_skills']
const SKILL_WITH_PRIORITY_PATTERN = /^([a-zA-Z0-9-]+)#(\d+)$/ // the regex is a uuid followed by a priority number
export const PRIORITY_NAMES: { [key: string]: string } = {
  '0': 'required',
  '1': 'optional high',
  '2': 'optional medium',
  '3': 'optional low',
}

// This transformer parses skill priority in trigger actions.
// See https://developer.zendesk.com/documentation/ticketing/using-the-zendesk-api/setting-skill-priority-with-skills-in-trigger-action/
export const transform: definitions.AdjustFunctionSingle = async ({ value }) => {
  if (!lowerdashValues.isPlainObject(value)) {
    throw new Error('unexpected value for trigger item, not transforming')
  }

  const actions = _.get(value, 'actions')
  if (actions === undefined || !Array.isArray(actions)) {
    return { value }
  }
  const updatedActions = actions.map(action => {
    if (TRIGGER_SKILL_FIELDS.includes(_.get(action, 'field'))) {
      const skillValue = _.get(action, 'value')
      if (typeof skillValue === 'string') {
        const skillWithPriority = skillValue.match(SKILL_WITH_PRIORITY_PATTERN)
        if (skillWithPriority !== null) {
          const priority =
            skillWithPriority[2] in PRIORITY_NAMES
              ? PRIORITY_NAMES[skillWithPriority[2]]
              : `unknown_${skillWithPriority[2]}`
          if (priority.startsWith('unknown')) {
            log.warn(
              'For trigger %s - Received unknown priority: %s',
              _.get(value, 'title', 'unknown'),
              skillWithPriority[2],
            )
          }
          return {
            ...action,
            value: skillWithPriority[1],
            priority,
          }
        }
        if (!skillValue.match(/^[a-zA-Z0-9-]+$/)) {
          const title = _.get(value, 'title', 'unknown')
          log.warn(`For trigger ${title} - Failed to parse skill value with priority: %s`, skillValue)
        }
      }
    }
    return { ...action }
  })

  return {
    value: {
      ...value,
      actions: updatedActions,
    },
  }
}
