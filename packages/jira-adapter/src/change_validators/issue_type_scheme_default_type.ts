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
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  ReferenceExpression,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { ISSUE_TYPE_SCHEMA_NAME } from '../constants'

export const issueTypeSchemeDefaultTypeValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === ISSUE_TYPE_SCHEMA_NAME)
    .filter(instance => isResolvedReferenceExpression(instance.value.defaultIssueTypeId))
    .filter(instance =>
      (instance.value.issueTypeIds ?? [])
        .filter(isResolvedReferenceExpression)
        .every((issueType: ReferenceExpression) => !issueType.elemID.isEqual(instance.value.defaultIssueTypeId.elemID)),
    )
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error' as SeverityLevel,
      message: "Default issue type is not included in the scheme's types",
      detailedMessage:
        'The default issue type of an issue type scheme must be included in the issue type list of the scheme',
    }))
