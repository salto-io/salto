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
import { AdditionDiff, ModificationDiff, RemovalDiff, ActionName } from '@salto-io/dag'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import {
  ObjectType,
  InstanceElement,
  Field,
  isInstanceElement,
  isObjectType,
  isField,
  TopLevelElement,
  Element,
} from './elements'
import { ElemID } from './element_id'
import { Values, Value } from './values'

const { isDefined } = lowerDashValues

export { ActionName }

export type ChangeDataType = TopLevelElement | Field
export type AdditionChange<T> = AdditionDiff<T>
export type ModificationChange<T> = ModificationDiff<T>
export type RemovalChange<T> = RemovalDiff<T>
export type Change<T = ChangeDataType> = AdditionChange<T> | ModificationChange<T> | RemovalChange<T>

export type ChangeData<T extends Change<unknown>> = T extends Change<infer U> ? U : never
export const isModificationChange = <T extends Change<unknown>>(
  change: T,
): change is T & ModificationChange<ChangeData<T>> => change.action === 'modify'
export const isRemovalChange = <T extends Change<unknown>>(change: T): change is T & RemovalChange<ChangeData<T>> =>
  change.action === 'remove'
export const isAdditionChange = <T extends Change<unknown>>(change: T): change is T & AdditionChange<ChangeData<T>> =>
  change.action === 'add'

export const isAdditionOrModificationChange = <T extends Change<unknown>>(
  change: T,
): change is T & (AdditionChange<ChangeData<T>> | ModificationChange<ChangeData<T>>) =>
  isAdditionChange(change) || isModificationChange(change)
export const isAdditionOrRemovalChange = <T extends Change<unknown>>(
  change: T,
): change is T & (AdditionChange<ChangeData<T>> | RemovalChange<ChangeData<T>>) =>
  isAdditionChange(change) || isRemovalChange(change)
export const isRemovalOrModificationChange = <T extends Change<unknown>>(
  change: T,
): change is T & (RemovalChange<ChangeData<T>> | ModificationChange<ChangeData<T>>) =>
  isRemovalChange(change) || isModificationChange(change)

export const getChangeData = <T>(change: Change<T>): T =>
  change.action === 'remove' ? change.data.before : change.data.after

export const getAllChangeData = <T>(change: Change<T>): T[] =>
  [
    isRemovalOrModificationChange(change) ? change.data.before : undefined,
    isAdditionOrModificationChange(change) ? change.data.after : undefined,
  ].filter(isDefined)

export const isInstanceChange = <T extends Change<unknown>>(change: T): change is T & Change<InstanceElement> =>
  isInstanceElement(getChangeData(change))

export const isObjectTypeChange = <T extends Change<unknown>>(change: T): change is T & Change<ObjectType> =>
  isObjectType(getChangeData(change))

export const isFieldChange = <T extends Change<unknown>>(change: T): change is T & Change<Field> =>
  isField(getChangeData(change))

export type DetailedChange<T = ChangeDataType | Values | Value> = Change<T> & {
  id: ElemID
  elemIDs?: {
    before?: ElemID
    after?: ElemID
  }
  path?: ReadonlyArray<string>
  baseChange?: Change<Element>
}

export type DetailedChangeWithBaseChange = DetailedChange & Required<Pick<DetailedChange, 'baseChange'>>

export type ChangeParams<T> = { before?: T; after?: T }

type ChangeParamType<T> = T extends ChangeParams<infer U> ? U : never

export const toChange = <T extends ChangeParams<unknown>>(params: T): Change<ChangeParamType<T>> => {
  const { before, after } = params as ChangeParams<ChangeParamType<T>>
  if (before !== undefined && after !== undefined) {
    return { action: 'modify', data: { before, after } }
  }
  if (before !== undefined) {
    return { action: 'remove', data: { before } }
  }
  if (after !== undefined) {
    return { action: 'add', data: { after } }
  }
  throw new Error('Must provide before or after')
}
