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
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'

const { awu } = collections.asynciterable

const getReferenceInfoIdentifier = (ref: ReferenceInfo): string =>
  `${ref.source.getFullName()}-${ref.target.getFullName()}`

export const combineCustomReferenceGetters = (customReferenceGetters: GetCustomReferencesFunc[])
: GetCustomReferencesFunc => async elements => {
  const idToRef: Record<string, ReferenceInfo> = {}
  await awu(customReferenceGetters).forEach(async customReferenceGetter => {
    const refs = await customReferenceGetter(elements)
    _.assign(idToRef, _.keyBy(refs, getReferenceInfoIdentifier))
  })
  return Object.values(idToRef)
}
