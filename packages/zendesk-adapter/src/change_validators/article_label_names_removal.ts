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
import { ChangeValidator, getChangeData, isInstanceChange, isModificationChange } from '@salto-io/adapter-api'
import { ARTICLE_TYPE_NAME } from '../constants'

export const articleLabelNamesRemovalValidator: ChangeValidator = async changes =>
  changes
    .filter(isModificationChange)
    .filter(isInstanceChange)
    .filter(
      change => change.data.before.value.label_names !== undefined && change.data.after.value.label_names === undefined,
    )
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === ARTICLE_TYPE_NAME)
    .flatMap(instance => [
      {
        elemID: instance.elemID,
        severity: 'Warning',
        message: 'Article labels removal is ineffective',
        detailedMessage: `To remove all the labels from ${instance.value.name}, please make sure to put an empty list under label_names field`,
      },
    ])
