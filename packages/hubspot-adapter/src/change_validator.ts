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
import { Change, Element, ChangeValidator, ChangeError } from '@salto-io/adapter-api'
import { types } from '@salto-io/lowerdash'
import _ from 'lodash'
import jsonTypeValidator from './change_validators/json_type'

const changeValidators: Partial<ChangeValidator>[] = [
  jsonTypeValidator,
]

const runOnUpdateValidators = async (changes: ReadonlyArray<Change>):
  Promise<ReadonlyArray<ChangeError>> =>
  _.flatten(await Promise.all(
    types.filterHasMember('onUpdate', changeValidators)
      .map(v => v.onUpdate(changes))
  ))

const runOnAddValidators = async (after: Element): Promise<ReadonlyArray<ChangeError>> =>
  _.flatten(await Promise.all(
    types.filterHasMember('onAdd', changeValidators)
      .map(v => v.onAdd(after))
  ))

const runOnRemoveValidators = async (before: Element): Promise<ReadonlyArray<ChangeError>> =>
  _.flatten(await Promise.all(
    types.filterHasMember('onRemove', changeValidators)
      .map(v => v.onRemove(before))
  ))

export const changeValidator: ChangeValidator = {
  onUpdate: (changes: ReadonlyArray<Change>) => runOnUpdateValidators(changes),
  onAdd: (after: Element) => runOnAddValidators(after),
  onRemove: (before: Element) => runOnRemoveValidators(before),
}
