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
} from '@salto-io/dag'
import {
  ObjectType, InstanceElement, Field, PrimitiveType, isInstanceElement, isObjectType, isField,
} from './elements'
import { ElemID } from './element_id'
import { Values, Value } from './values'

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
export const isAdditionOrModificationDiff = <T>(
  change: Change<T>
): change is AdditionDiff<T> | ModificationDiff<T> => (
    isAdditionDiff(change) || isModificationDiff(change)
  )

export const getChangeElement = <T>(change: Change<T>): T =>
  (change.action === 'remove' ? change.data.before : change.data.after)

export const isInstanceChange = (change: Change): change is Change<InstanceElement> => (
  isInstanceElement(getChangeElement(change))
)

export const isObjectTypeChange = (change: Change): change is Change<ObjectType> => (
  isObjectType(getChangeElement(change))
)

export const isFieldChange = (change: Change): change is Change<Field> => (
  isField(getChangeElement(change))
)

export type DetailedChange<T = ChangeDataType | Values | Value> =
  Change<T> & {
    id: ElemID
    path?: string[]
  }
