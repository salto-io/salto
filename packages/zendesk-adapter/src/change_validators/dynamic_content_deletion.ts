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
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import {
  ChangeError,
  ChangeValidator,
  ElemID,
  getChangeData,
  isInstanceChange,
  isReferenceExpression,
  isRemovalChange,
  isTemplateExpression,
} from '@salto-io/adapter-api'
import { getInstancesFromElementSource, WALK_NEXT_STEP, walkOnElement, WalkOnFunc } from '@salto-io/adapter-utils'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { AUTOMATION_TYPE_NAME, MACRO_TYPE_NAME, TRIGGER_TYPE_NAME, DYNAMIC_CONTENT_ITEM_TYPE_NAME } from '../constants'

const { isDefined } = lowerDashValues

const log = logger(module)

// Other types may have dynamic_content, but these are the only ones that prevent its deletion
const TYPES_WITH_DC = [MACRO_TYPE_NAME, AUTOMATION_TYPE_NAME, TRIGGER_TYPE_NAME]

/**
 * Prevent deletion of dynamic_content if it is used in trigger, macro or automation
 */
export const dynamicContentDeletionValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    log.error('Failed to run dynamicContentDeletionValidator because element source is undefined')
    return []
  }

  const dynamicContentRemovals = changes
    .filter(isInstanceChange)
    .filter(isRemovalChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === DYNAMIC_CONTENT_ITEM_TYPE_NAME)

  if (dynamicContentRemovals.length === 0) {
    return []
  }

  const relevantTypesInstances = await getInstancesFromElementSource(elementSource, TYPES_WITH_DC)

  const dynamicContentToUsages = _.keyBy(
    dynamicContentRemovals.map((dc): { elemId: ElemID; usages: string[] } => ({
      elemId: dc.elemID,
      usages: [],
    })),
    dc => dc.elemId.name,
  )
  const lookForDc: WalkOnFunc = ({ value, path }) => {
    if (isTemplateExpression(value)) {
      value.parts.forEach(part => lookForDc({ value: part, path }))
      return WALK_NEXT_STEP.SKIP
    }
    if (isReferenceExpression(value) && value.elemID.typeName === DYNAMIC_CONTENT_ITEM_TYPE_NAME) {
      if (dynamicContentToUsages[value.elemID.name] !== undefined) {
        dynamicContentToUsages[value.elemID.name].usages.push(path.createTopLevelParentID().parent.getFullName())
      }
      return WALK_NEXT_STEP.SKIP
    }
    return WALK_NEXT_STEP.RECURSE
  }

  relevantTypesInstances.forEach(instance => {
    walkOnElement({ element: instance, func: lookForDc })
  })

  const errors = Object.values(dynamicContentToUsages)
    .map(({ elemId, usages }): ChangeError | undefined => {
      if (usages.length === 0) {
        return undefined
      }
      return {
        elemID: elemId,
        severity: 'Error',
        message: 'Dynamic content is being used',
        detailedMessage: `This dynamic content cannot be deleted because it is being used by ${_.uniq(usages).join(', ')}`,
      }
    })
    .filter(isDefined)

  return errors
}
