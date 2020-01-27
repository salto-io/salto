import {
  Change, ChangeDataType, Field, isField, getChangeElement, InstanceElement, isInstanceElement,
  ObjectType, isObjectType,
} from 'adapter-api'
import { NodeId } from '@salto/dag'

export type ChangeId = NodeId
type Dependency = {
  source: ChangeId
  target: ChangeId
}

export type DependencyChange = {
  action: 'add' | 'remove'
  dependency: Dependency
}

export type DependencyProvider = (
  changes: ReadonlyMap<ChangeId, Change>, dependencies: ReadonlyMap<ChangeId, ReadonlySet<ChangeId>>
) => Promise<Iterable<DependencyChange>>

const dependencyChange = (
  action: DependencyChange['action'], source: ChangeId, target: ChangeId
): DependencyChange => ({ action, dependency: { source, target } })

// Reference dependency means source must be added after target and removed before target
export const addReferenceDependency = (
  action: Change['action'], src: ChangeId, target: ChangeId,
): DependencyChange => (
  action === 'add' ? dependencyChange('add', src, target) : dependencyChange('add', target, src)
)

export type ChangeEntry<T = ChangeDataType> = [ChangeId, Change<T>]
export const isFieldChange = (entry: ChangeEntry): entry is ChangeEntry<Field> => (
  isField(getChangeElement(entry[1]))
)
export const isInstanceChange = (entry: ChangeEntry): entry is ChangeEntry<InstanceElement> => (
  isInstanceElement(getChangeElement(entry[1]))
)
export const isObjectTypeChange = (entry: ChangeEntry): entry is ChangeEntry<ObjectType> => (
  isObjectType(getChangeElement(entry[1]))
)
