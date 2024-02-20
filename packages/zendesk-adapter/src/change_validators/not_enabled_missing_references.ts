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
  ChangeError,
  ChangeValidator,
  Element,
  ElemID,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  isReferenceExpression,
  isTemplateExpression,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { isResolvedReferenceExpression, WALK_NEXT_STEP, walkOnElement } from '@salto-io/adapter-utils'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { references } from '@salto-io/adapter-components'
import _ from 'lodash'
import { sideConversationsOnFetch as sideConversationsFilter } from '../filters/side_conversation'
import { fieldReferencesOnFetch as fieldReferencesFilter } from '../filters/field_references'
import { listValuesMissingReferencesOnFetch as listValuesMissingReferencesFilter } from '../filters/references/list_values_missing_references'
import { handleTemplateExpressionsOnFetch as handleTemplateExpressionFilter } from '../filters/handle_template_expressions'
import { DynamicContentReferencesOnFetch as dynamicContentReferencesFilter } from '../filters/dynamic_content_references'
import { articleBodyOnFetch as articleBodyFilter } from '../filters/article/article_body'
import { FETCH_CONFIG, ZendeskConfig } from '../config'

const { isDefined } = lowerDashValues
const { awu } = collections.asynciterable

const MISSING_REFERENCE_FILTERS: ((elements: Element[], config: ZendeskConfig) => void)[] = [
  sideConversationsFilter,
  fieldReferencesFilter,
  listValuesMissingReferencesFilter,
  dynamicContentReferencesFilter,
  articleBodyFilter,
  handleTemplateExpressionFilter,
]

const createMissingRefString = (path: ElemID, value: ReferenceExpression): string => {
  const innerPath = path.createTopLevelParentID().path.join(ElemID.NAMESPACE_SEPARATOR)
  const missingType = value.elemID.typeName
  const missingIdentifier = value.elemID.name.startsWith(references.MISSING_REF_PREFIX)
    ? value.elemID.name.substring(references.MISSING_REF_PREFIX.length)
    : value.elemID.name
  return `.${innerPath} -> ${missingType} (${missingIdentifier})`
}

/**
 * If enableMissingReferences is false, check for potential missing references in the changes and warn about them
 */
export const notEnabledMissingReferencesValidator =
  (config: ZendeskConfig): ChangeValidator =>
  async changes => {
    if (config[FETCH_CONFIG].enableMissingReferences) {
      return []
    }

    const relevantChanges = changes.filter(isInstanceChange).filter(isAdditionOrModificationChange)
    // Clone in order to not change the original
    const clonedRelevantInstances = _.cloneDeep(relevantChanges.map(getChangeData))
    const filtersConfig = _.cloneDeep(config)
    filtersConfig[FETCH_CONFIG].enableMissingReferences = true
    // Run the filters one by one, to make sure they are run in order
    await awu(MISSING_REFERENCE_FILTERS.map(filter => filter(clonedRelevantInstances, filtersConfig))).toArray()

    const errors = clonedRelevantInstances
      .map((instance): ChangeError | undefined => {
        const missingReferences: string[] = []
        walkOnElement({
          element: instance,
          func: ({ value, path }) => {
            if (
              isReferenceExpression(value) &&
              (!isResolvedReferenceExpression(value) || references.checkMissingRef(value.value))
            ) {
              missingReferences.push(createMissingRefString(path, value))
            }
            if (isTemplateExpression(value)) {
              value.parts.forEach(part => {
                if (
                  isReferenceExpression(part) &&
                  (!isResolvedReferenceExpression(part) || references.checkMissingRef(part.value))
                ) {
                  missingReferences.push(createMissingRefString(path, part.value))
                }
              })
            }
            return WALK_NEXT_STEP.RECURSE
          },
        })

        return missingReferences.length > 0
          ? {
              elemID: instance.elemID,
              severity: 'Warning',
              message: 'Element includes missing references',
              detailedMessage: `This element includes the following missing references\n${missingReferences.join('\n')}\nDeploying this element may fail or cause unpredictable behaviour in the service`,
            }
          : undefined
      })
      .filter(isDefined)
    return errors
  }
