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
import {
  AdditionDiff, ModificationDiff, RemovalDiff, ActionName,
} from '@salto/dag'
import {
  ObjectType, InstanceElement, Field, PrimitiveType,
} from './elements'

export { ActionName }

export type ChangeDataType = ObjectType | InstanceElement | Field | PrimitiveType
export type Change<T = ChangeDataType> =
  AdditionDiff<T> | ModificationDiff<T> | RemovalDiff<T>

export const isModificationDiff = <T>(change: Change<T>): change is ModificationDiff<T> =>
  change.action === 'modify'
export const isRemovalDiff = <T>(change: Change<T>): change is RemovalDiff<T> =>
  change.action === 'remove'
export const isAdditionDiff = <T>(change: Change<T>): change is AdditionDiff<T> =>
  change.action === 'add'

export const getChangeElement = <T>(change: Change<T>): T =>
  (change.action === 'remove' ? change.data.before : change.data.after)
