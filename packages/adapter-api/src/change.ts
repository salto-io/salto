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
