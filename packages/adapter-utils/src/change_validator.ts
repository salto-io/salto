/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { Change, ChangeError, ChangeValidator, Element } from '@salto-io/adapter-api'
import _ from 'lodash'
import { types } from '@salto-io/lowerdash'

export const runOnUpdateValidators = async (changes: ReadonlyArray<Change>,
  changeValidators: Partial<ChangeValidator>[]): Promise<ReadonlyArray<ChangeError>> =>
  _.flatten(await Promise.all(
    types.filterHasMember('onUpdate', changeValidators)
      .map(v => v.onUpdate(changes))
  ))

export const runOnAddValidators = async (after: Element,
  changeValidators: Partial<ChangeValidator>[]): Promise<ReadonlyArray<ChangeError>> =>
  _.flatten(await Promise.all(
    types.filterHasMember('onAdd', changeValidators)
      .map(v => v.onAdd(after))
  ))

export const runOnRemoveValidators = async (before: Element,
  changeValidators: Partial<ChangeValidator>[]): Promise<ReadonlyArray<ChangeError>> =>
  _.flatten(await Promise.all(
    types.filterHasMember('onRemove', changeValidators)
      .map(v => v.onRemove(before))
  ))

export const createChangeValidator = (changeValidators: Partial<ChangeValidator>[]):
  ChangeValidator => ({
  onUpdate: (changes: ReadonlyArray<Change>) => runOnUpdateValidators(changes, changeValidators),
  onAdd: (after: Element) => runOnAddValidators(after, changeValidators),
  onRemove: (before: Element) => runOnRemoveValidators(before, changeValidators),
})
