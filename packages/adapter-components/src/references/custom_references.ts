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
import { GetCustomReferencesFunc, ReferenceInfo } from '@salto-io/adapter-api'
import _ from 'lodash'

const getReferenceInfoIdentifier = (ref: ReferenceInfo): string =>
  `${ref.source.getFullName()}-${ref.target.getFullName()}`

/**
 * Combine several getCustomReferences functions into one that will run all of them.
 * When a reference is returned twice with different types the last one will override the previous ones.
 */
export const combineCustomReferenceGetters = (customReferenceGetters: GetCustomReferencesFunc[])
: GetCustomReferencesFunc => async elements => {
  const idToRef: Record<string, ReferenceInfo> = {}
  const refGroups = await Promise.all(customReferenceGetters.map(getCustomReferences => getCustomReferences(elements)))

  // We don't use _.uniqBy to ensure that the last reference will override the previous ones.
  refGroups.forEach(refs => {
    _.assign(idToRef, _.keyBy(refs, getReferenceInfoIdentifier))
  })
  return Object.values(idToRef)
}
