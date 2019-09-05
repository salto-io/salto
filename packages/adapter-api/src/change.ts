
import {
  AdditionDiff, ModificationDiff, RemovalDiff,
} from '@salto/dag'
import {
  ObjectType, InstanceElement, Field,
} from './elements'

export type Change<T = ObjectType | InstanceElement | Field> =
  AdditionDiff<T> | ModificationDiff<T> | RemovalDiff<T>
export const getChangeElement = <T>(change: Change<T>): T =>
  (change.action === 'remove' ? change.data.before : change.data.after)
