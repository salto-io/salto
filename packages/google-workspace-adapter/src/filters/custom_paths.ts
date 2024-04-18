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
import { isReferenceExpression } from '@salto-io/adapter-api'
import { filters, filterUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'

const log = logger(module)

const pathMapper: filters.PathMapperFunc = inst => {
  const { typeName } = inst.elemID
  const { parentOrgUnitId } = inst.value
  if (typeName !== 'orgUnit' || parentOrgUnitId === undefined) {
    return undefined
  }
  if (!isReferenceExpression(parentOrgUnitId)) {
    log.warn('org unit %s has a non-reference parentOrgUnitId', inst.elemID.getFullName())
    return undefined
  }
  const pathSuffix = inst.path?.slice(-2)
  if (pathSuffix?.length !== 2) {
    log.warn('org unit %s does not have the expected path, not updating', inst.elemID.getFullName())
    return undefined
  }
  return {
    nestUnder: parentOrgUnitId.elemID,
    pathSuffix,
  }
}

const filter: filterUtils.NoOptionsFilterCreator<filterUtils.FilterResult> =
  filters.customPathsFilterCreator(pathMapper)

export default filter
