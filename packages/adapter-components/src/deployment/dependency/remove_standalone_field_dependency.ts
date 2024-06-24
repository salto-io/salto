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
import wu from 'wu'
import {
  getChangeData,
  DependencyChanger,
  dependencyChange,
  isReferenceExpression,
  ChangeId,
} from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'

export const removeStandaloneFieldDependency: DependencyChanger = async (changes, deps) => {
  const isDependencyFromParentToChild = ([src, target]: [ChangeId, ChangeId]): boolean => {
    const sourceChange = changes.get(src)
    const targetChange = changes.get(target)
    if (sourceChange === undefined || targetChange === undefined) {
      return false
    }
    return (
      getParents(getChangeData(targetChange)).find(
        e => isReferenceExpression(e) && e.elemID.isEqual(getChangeData(sourceChange).elemID),
      ) != null
    )
  }

  const allDependencies = wu(deps)
    .map(([source, targets]) =>
      wu(targets)
        .filter(target => deps.get(target)?.has(source) === true)
        .map(target => [source, target]),
    )
    .flatten(true)

  return allDependencies
    .filter(isDependencyFromParentToChild)
    .map(([source, target]) => dependencyChange('remove', source, target))
}
