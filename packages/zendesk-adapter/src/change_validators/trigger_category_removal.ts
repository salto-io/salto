/*
*                      Copyright 2023 Salto Labs Ltd.
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
  isAdditionOrModificationChange,
  ChangeError,
  getChangeData,
  InstanceElement,
  isInstanceElement, isRemovalChange, isReferenceExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { config as configUtils } from '@salto-io/adapter-components'
import { TRIGGER_TYPE_NAME } from '../constants'
import { TRIGGER_CATEGORY_TYPE_NAME } from '../filters/reorder/trigger'
import { ZendeskApiConfig } from '../config'

const { isDefined } = lowerDashValues
const { awu } = collections.asynciterable
const log = logger(module)

/**
 * Prevents removal of a trigger category that is used by an active automation
 * Warns about removal of a trigger category that is used by an inactive automation
 */
export const triggerCategoryRemovalValidator: (apiConfig: ZendeskApiConfig)
  => ChangeValidator = apiConfig => async (changes, elementSource) => {
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

    const elementSourceTriggers = await awu(await elementSource.list())
      .filter(id => id.typeName === TRIGGER_TYPE_NAME)
      .filter(id => id.idType === 'instance')
      .map(id => elementSource.get(id))
      .filter(isInstanceElement)
      .toArray()

    const triggerChangesByTriggerName = _.keyBy(
      changes
        .filter(isInstanceChange)
        .filter(change => getChangeData(change).elemID.typeName === TRIGGER_TYPE_NAME),
      change => getChangeData(change).elemID.name
    )

    const triggersByTriggerCategory: Record<string, InstanceElement[]> = _.fromPairs(
      removedTriggerCategories.map(instance => instance.elemID.name).map(name => [name, []])
    )
    elementSourceTriggers.forEach(trigger => {
      const triggerCategory = trigger.value.category_id
      const triggerCategoryName = isReferenceExpression(triggerCategory)
        ? triggerCategory.elemID.name
        : triggerCategory
      // If this trigger's category wasn't removed, we don't care about it
      if (triggersByTriggerCategory === undefined) {
        return
      }
      // If this trigger wasn't changed, the updated instance is the one in the element source
      if (triggerChangesByTriggerName[trigger.elemID.name] === undefined) {
        triggersByTriggerCategory[triggerCategoryName] = [
          ...(triggersByTriggerCategory[triggerCategoryName] ?? []),
          trigger,
        ]
        return
      }
      // If this trigger was added or modifications, the updated instance is the one in the changes
      const triggerChange = triggerChangesByTriggerName[trigger.elemID.name]
      if (isAdditionOrModificationChange(triggerChange)) {
        triggersByTriggerCategory[triggerCategoryName] = [
          ...(triggersByTriggerCategory[triggerCategoryName] ?? []),
          getChangeData(triggerChange),
        ]
      }
      // If this is a removal change, we do nothing because it is irrelevant
    })


    const removalErrors = removedTriggerCategories.map((removedTriggerCategory): ChangeError | undefined => {
      const triggerCategoryActiveTriggers = triggersByTriggerCategory[removedTriggerCategory.elemID.name]
        .filter(trigger => trigger.value.active)
        .map(trigger => trigger.elemID.name)

      return triggerCategoryActiveTriggers.length > 0 ? {
        elemID: removedTriggerCategory.elemID,
        severity: 'Error',
        message: 'Removal of trigger category with active triggers',
        detailedMessage: `Trigger category is used by the following active triggers: [${triggerCategoryActiveTriggers.join(', ')}], please deactivate or remove them before removing the trigger category`
        ,
      } : undefined
    })

    const inactiveTriggersOmitted = configUtils.getConfigWithDefault(
      apiConfig.types?.[TRIGGER_TYPE_NAME]?.transformation,
      apiConfig.typeDefaults.transformation
    ).omitInactive === true
    const removalWarnings = removedTriggerCategories.map((removedTriggerCategory): ChangeError | undefined => {
      // If we omitted inactive triggers, we can't warn about them specifically, so we return a general warning
      if (inactiveTriggersOmitted) {
        return {
          elemID: removedTriggerCategory.elemID,
          severity: 'Warning',
          message: 'Removal of trigger category',
          detailedMessage: 'Any inactive triggers of this trigger category will be automatically removed with the removal of this trigger category',
        }
      }

      const triggerCategoryInactiveTriggers = triggersByTriggerCategory[removedTriggerCategory.elemID.name]
        .filter(trigger => !trigger.value.active)
        .map(trigger => trigger.elemID.name)

      return triggerCategoryInactiveTriggers.length > 0 ? {
        elemID: removedTriggerCategory.elemID,
        severity: 'Warning',
        message: 'Removal of trigger category with inactive triggers',
        detailedMessage: `Trigger category is used by the following inactive triggers: [${triggerCategoryInactiveTriggers.join(', ')}], and they will be automatically removed with the removal of this trigger category`,
      } : undefined
    })

    return [...removalErrors, ...removalWarnings].filter(isDefined)
  }
