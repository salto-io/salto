import wu from 'wu'
import _ from 'lodash'
import {
  Change, ChangeDataType, getChangeElement, isType, isField, Field, InstanceElement,
  isInstanceElement, isObjectType, ObjectType,
} from 'adapter-api'
import { DataNodeMap, DiffNode, NodeId } from '@salto/dag'
import { DiffGraphTransformer } from './common'


type Dependency = {
  source: NodeId
  target: NodeId
}
type DependencyChange = {
  action: 'add' | 'remove'
  dependency: Dependency
}

type ChangeNode<T = ChangeDataType> = {
  id: NodeId
  change: Change<T>
}

export type DependencyProvider = (
  changes: ReadonlyArray<ChangeNode>, dependencies: ReadonlyArray<Dependency>
) => ReadonlyArray<DependencyChange>

const dependencyChange = (
  action: DependencyChange['action'], source: NodeId, target: NodeId
): DependencyChange => ({ action, dependency: { source, target } })

// TODO:ORI - move to different file (dependency common)
const isFieldChange = (node: ChangeNode): node is ChangeNode<Field> => (
  isField(getChangeElement(node.change))
)
const isInstanceChange = (node: ChangeNode): node is ChangeNode<InstanceElement> => (
  isInstanceElement(getChangeElement(node.change))
)
const isObjectTypeChange = (node: ChangeNode): node is ChangeNode<ObjectType> => (
  isObjectType(getChangeElement(node.change))
)

// Reference dependency means source must be added after target and removed before target
const addReferenceDependency = (source: ChangeNode, target: ChangeNode): DependencyChange => (
  source.change.action === 'add'
    ? dependencyChange('add', source.id, target.id)
    : dependencyChange('add', target.id, source.id)
)

// TODO:ORI - move to different file (type dep provider)
type FieldOrInstanceChange = ChangeNode<Field | InstanceElement>
const isFieldOrInstanceChange = (change: ChangeNode): change is FieldOrInstanceChange => (
  isFieldChange(change) || isInstanceChange(change)
)

export const typeDependencyProvider: DependencyProvider = changes => {
  const typeChanges = _(changes)
    .filter(({ change }) => isType(getChangeElement(change)))
    .groupBy(({ change }) => getChangeElement(change).elemID.getFullName())
    .value()

  const addTypeDependency = (node: FieldOrInstanceChange): DependencyChange[] => (
    (typeChanges[getChangeElement(node.change).type.elemID.getFullName()] ?? [])
      .filter(typeChange => typeChange.change.action === node.change.action)
      .map(typeChange => addReferenceDependency(node, typeChange))
  )

  return _(changes)
    .filter(isFieldOrInstanceChange)
    .map(addTypeDependency)
    .flatten()
    .value()
}

// TODO:ORI - move to different file (obj dep provider)
export const objectDependencyProvider: DependencyProvider = changes => {
  const objectChanges = _(changes)
    .filter(isObjectTypeChange)
    .groupBy(({ change }) => getChangeElement(change).elemID.getFullName())
    .value()

  const addObjectDependency = (node: ChangeNode<Field>): DependencyChange[] => (
    (objectChanges[getChangeElement(node.change).parentID.getFullName()] ?? [])
      .filter(objectChange => objectChange.change.action === node.change.action)
      .map(objectChange => addReferenceDependency(node, objectChange))
  )

  return _(changes)
    .filter(isFieldChange)
    .map(addObjectDependency)
    .flatten()
    .value()
}


const dependencyToString = (dependency: Dependency): string => (
  [dependency.source, dependency.target].join('->')
)

export const addNodeDependencies = (
  providers: ReadonlyArray<DependencyProvider>
): DiffGraphTransformer => graph => {
  const updateDependencies = (
    deps: ReadonlyArray<Dependency>, changes: Iterable<DependencyChange>
  ): ReadonlyArray<Dependency> => {
    const [toAdd, toRemove] = _.partition([...changes], change => change.action === 'add')
    const removeIds = new Set(
      toRemove
        .map(change => change.dependency)
        .map(dependencyToString)
    )
    return deps
      .filter(dep => !removeIds.has(dependencyToString(dep)))
      .concat(toAdd.map(change => change.dependency))
  }

  const initialDependencies: ReadonlyArray<Dependency> = wu(graph.entries())
    .map(([source, targets]) => wu(targets.values()).map(target => ({ source, target })))
    .flatten()
    .toArray()

  const changes = wu(graph.dataEntries()).map(([id, change]) => ({ id, change })).toArray()
  const outputDependencies = providers.reduce(
    (deps, provider) => updateDependencies(deps, provider(changes, deps)),
    initialDependencies,
  )

  const outputDependencyMap = _.groupBy(outputDependencies, dep => dep.source)
  const outputGraph = new DataNodeMap<DiffNode<ChangeDataType>>()

  wu(graph.dataEntries())
    .forEach(([id, data]) => {
      const nodeDeps = new Set((outputDependencyMap[id] ?? []).map(dep => dep.target))
      outputGraph.addNode(id, nodeDeps, data)
    })
  return outputGraph
}
