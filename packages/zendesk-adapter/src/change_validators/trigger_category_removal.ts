/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {
  isInstanceChange,
  ChangeValidator,
  ChangeError,
  getChangeData,
  InstanceElement,
  isRemovalChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { definitions } from '@salto-io/adapter-components'
import { getInstancesFromElementSource } from '@salto-io/adapter-utils'
import { OMIT_INACTIVE_DEFAULT } from '../config'
import { TRIGGER_CATEGORY_TYPE_NAME, TRIGGER_TYPE_NAME } from '../constants'
import { ZendeskFetchConfig } from '../user_config'

const { isDefined } = lowerDashValues
const log = logger(module)

/**
 * Prevents removal of a trigger category that is used by an active trigger
 * Warns about removal of a trigger category that is used by an inactive trigger
 * Warns about removal of a trigger category if omitInactive is true for triggers
 */
export const triggerCategoryRemovalValidator: (fetchConfig: ZendeskFetchConfig) => ChangeValidator =
  fetchConfig => async (changes, elementSource) => {
    if (elementSource === undefined) {
      log.error('Failed to run triggerCategoryRemovalValidator because element source is undefined')
      return []
    }

    const removedTriggerCategories = changes
      .filter(isInstanceChange)
      .filter(isRemovalChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === TRIGGER_CATEGORY_TYPE_NAME)

    if (removedTriggerCategories.length === 0) {
      return []
    }

    const elementSourceTriggers = await getInstancesFromElementSource(elementSource, [TRIGGER_TYPE_NAME])

    const triggersByRemovedTriggerCategory: Record<string, InstanceElement[]> = _.fromPairs(
      removedTriggerCategories.map(instance => instance.elemID.name).map(name => [name, []]),
    )

    elementSourceTriggers.forEach(trigger => {
      const triggerCategory = trigger.value.category_id
      const triggerCategoryName = isReferenceExpression(triggerCategory) ? triggerCategory.elemID.name : triggerCategory
      // If this trigger's category wasn't removed, we don't care about it
      if (triggersByRemovedTriggerCategory[triggerCategoryName] === undefined) {
        return
      }
      triggersByRemovedTriggerCategory[triggerCategoryName].push(trigger)
    })

    const removalErrors = removedTriggerCategories.map((removedTriggerCategory): ChangeError | undefined => {
      const triggerCategoryActiveTriggers = triggersByRemovedTriggerCategory[removedTriggerCategory.elemID.name]
        .filter(trigger => trigger.value.active)
        .map(trigger => trigger.elemID.name)

      return triggerCategoryActiveTriggers.length > 0
        ? {
            elemID: removedTriggerCategory.elemID,
            severity: 'Error',
            message: 'Cannot remove a trigger category with active triggers',
            detailedMessage: `Trigger category is used by the following active triggers: [${triggerCategoryActiveTriggers.join(', ')}], please deactivate or remove them before removing this category`,
          }
        : undefined
    })
    const omitInactiveConfig = fetchConfig.omitInactive
    const inactiveTriggersOmitted = omitInactiveConfig
      ? definitions.queryWithDefault(omitInactiveConfig).query(TRIGGER_CATEGORY_TYPE_NAME)
      : OMIT_INACTIVE_DEFAULT
    const removalWarnings = removedTriggerCategories.map((removedTriggerCategory): ChangeError | undefined => {
      // If we omitted inactive triggers, we can't warn about them specifically, so we return a general warning
      if (inactiveTriggersOmitted) {
        return {
          elemID: removedTriggerCategory.elemID,
          severity: 'Warning',
          message: 'Removal of trigger category',
          detailedMessage: 'Any inactive triggers of this category will be automatically removed',
        }
      }
      const triggerCategoryInactiveTriggers = triggersByRemovedTriggerCategory[removedTriggerCategory.elemID.name]
        .filter(trigger => !trigger.value.active)
        .map(trigger => trigger.elemID.name)

      return triggerCategoryInactiveTriggers.length > 0
        ? {
            elemID: removedTriggerCategory.elemID,
            severity: 'Warning',
            message: 'Removal of trigger category with inactive triggers',
            detailedMessage: `Trigger category is used by the following inactive triggers: [${triggerCategoryInactiveTriggers.join(', ')}], and they will be automatically removed with the removal of this category`,
          }
        : undefined
    })

    return [...removalErrors, ...removalWarnings].filter(isDefined)
  }
