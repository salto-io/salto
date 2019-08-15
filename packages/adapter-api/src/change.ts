
import {
  AdditionDiff, ModificationDiff, RemovalDiff,
} from '@salto/dag'
import {
  ObjectType, InstanceElement, Field,
} from './elements'

type DagNode = ObjectType | InstanceElement | Field
export type AddChange<T = DagNode> = AdditionDiff<T>
export type ModificationChange<T = DagNode> = ModificationDiff<T>
export type RemovalChange<T = DagNode> = RemovalDiff<T>
export type Change<T = DagNode> = AddChange <T> | ModificationChange<T> | RemovalChange<T>
export const getChangeElement = (change: Change): DagNode =>
  (change.action === 'remove' ? change.data.before : change.data.after)
