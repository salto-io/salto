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
import _ from 'lodash'
import { Change, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { DAG } from '@salto-io/dag'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { DeployApiDefinitions, InstanceDeployApiDefinitions } from '../../../src/definitions/system/deploy'
import { NodeType, createDependencyGraph } from '../../../src/deployment/deploy/graph'
import { queryWithDefault } from '../../../src/definitions'

describe('createDependencyGraph', () => {
  let changes: Change<InstanceElement>[]
  let deployDef: DeployApiDefinitions<'activate' | 'deactivate', 'main'>

  beforeEach(() => {
    const typeA = new ObjectType({ elemID: new ElemID('adapter', 'typeA') })
    const typeB = new ObjectType({ elemID: new ElemID('adapter', 'typeB') })
    const typeC = new ObjectType({ elemID: new ElemID('adapter', 'typeC') })
    changes = [
      toChange({ after: new InstanceElement('add1', typeA) }),
      toChange({ after: new InstanceElement('add2', typeA) }),
      toChange({
        before: new InstanceElement('mod2', typeA, { a: 'before' }),
        after: new InstanceElement('mod2', typeA, { a: 'after' }),
      }),
      toChange({ before: new InstanceElement('remove3', typeA, { a: 'before' }) }),
      toChange({ after: new InstanceElement('add1', typeB) }),
      toChange({
        before: new InstanceElement('mod2', typeB, { a: 'before' }),
        after: new InstanceElement('mod2', typeB, { a: 'after' }),
      }),
      toChange({ before: new InstanceElement('remove3', typeB, { a: 'before' }) }),
      toChange({ before: new InstanceElement('remove3', typeC, { a: 'before' }) }),
      toChange({
        before: new InstanceElement('mod2', typeC, { a: 'before' }),
        after: new InstanceElement('mod2', typeC, { a: 'after' }),
      }),
    ]
    deployDef = {
      instances: {
        customizations: {
          typeA: {
            requestsByAction: {},
          },
          typeB: {
            requestsByAction: {},
          },
          someOtherType: {
            requestsByAction: {},
          },
        },
      },
    }
  })

  describe('without action or dependency customizations', () => {
    let graph: DAG<NodeType<never>>
    beforeEach(() => {
      graph = createDependencyGraph({
        defQuery: queryWithDefault<InstanceDeployApiDefinitions<never, 'main'>>(
          (deployDef as DeployApiDefinitions<never, 'main'>).instances,
        ),
        changeGroup: { changes, groupID: 'abc' },
        changes,
        elementSource: buildElementsSourceFromElements([]),
        sharedContext: {},
      })
    })

    it('should create node per type+action', () => {
      expect(_.sortBy(Array.from(graph.nodeData.entries()), val => val[0])).toEqual([
        ['typeA/add', { typeName: 'typeA', action: 'add', typeActionChanges: [changes[0], changes[1]] }],
        ['typeA/modify', { typeName: 'typeA', action: 'modify', typeActionChanges: [changes[2]] }],
        ['typeA/remove', { typeName: 'typeA', action: 'remove', typeActionChanges: [changes[3]] }],
        ['typeB/add', { typeName: 'typeB', action: 'add', typeActionChanges: [changes[4]] }],
        ['typeB/modify', { typeName: 'typeB', action: 'modify', typeActionChanges: [changes[5]] }],
        ['typeB/remove', { typeName: 'typeB', action: 'remove', typeActionChanges: [changes[6]] }],
        ['typeC/modify', { typeName: 'typeC', action: 'modify', typeActionChanges: [changes[8]] }],
        ['typeC/remove', { typeName: 'typeC', action: 'remove', typeActionChanges: [changes[7]] }],
      ])
    })
    it('should not create any edges', () => {
      expect(graph.edges()).toEqual([])
    })
  })

  describe('with custom actions and dependencies', () => {
    let graph: DAG<NodeType<'activate' | 'deactivate'>>
    beforeEach(() => {
      if (!deployDef.instances.customizations) {
        deployDef.instances.customizations = {}
      }
      deployDef.instances.customizations.typeB.toActionNames = ({ change }) => {
        if (change.action === 'add') {
          return ['add', 'activate']
        }
        if (change.action === 'remove') {
          return ['remove', 'deactivate']
        }
        return [change.action]
      }
      deployDef.instances.customizations.typeB.actionDependencies = [
        { first: 'add', second: 'activate' },
        { first: 'deactivate', second: 'remove' },
      ]
      deployDef.dependencies = [
        { first: { type: 'typeA', action: 'add' }, second: { type: 'typeB' } },
        { first: { type: 'typeC' }, second: { type: 'typeB' } },
        { first: { type: 'unavailable1' }, second: { type: 'typeB' } },
      ]
      graph = createDependencyGraph({
        defQuery: queryWithDefault<InstanceDeployApiDefinitions<'activate' | 'deactivate', 'main'>>(
          deployDef.instances,
        ),
        changeGroup: { changes, groupID: 'abc' },
        changes,
        elementSource: buildElementsSourceFromElements([]),
        dependencies: deployDef.dependencies,
        sharedContext: {},
      })
    })

    it('should create node per type+action', () => {
      expect(_.sortBy(Array.from(graph.nodeData.entries()), val => val[0])).toEqual([
        ['typeA/add', { typeName: 'typeA', action: 'add', typeActionChanges: [changes[0], changes[1]] }],
        ['typeA/modify', { typeName: 'typeA', action: 'modify', typeActionChanges: [changes[2]] }],
        ['typeA/remove', { typeName: 'typeA', action: 'remove', typeActionChanges: [changes[3]] }],
        ['typeB/activate', { typeName: 'typeB', action: 'activate', typeActionChanges: [changes[4]] }],
        ['typeB/add', { typeName: 'typeB', action: 'add', typeActionChanges: [changes[4]] }],
        ['typeB/deactivate', { typeName: 'typeB', action: 'deactivate', typeActionChanges: [changes[6]] }],
        ['typeB/modify', { typeName: 'typeB', action: 'modify', typeActionChanges: [changes[5]] }],
        ['typeB/remove', { typeName: 'typeB', action: 'remove', typeActionChanges: [changes[6]] }],
        ['typeC/modify', { typeName: 'typeC', action: 'modify', typeActionChanges: [changes[8]] }],
        ['typeC/remove', { typeName: 'typeC', action: 'remove', typeActionChanges: [changes[7]] }],
      ])
    })
    it('should create edges based on dependencies and actionDependencies', () => {
      expect(_.sortBy(graph.edges(), e => [e[1], e[0]])).toEqual([
        // A, add < B
        ['typeB/activate', 'typeA/add'],
        ['typeB/add', 'typeA/add'],
        ['typeB/deactivate', 'typeA/add'],
        ['typeB/modify', 'typeA/add'],
        ['typeB/remove', 'typeA/add'],

        // B.add < activate, B.deactivate < remove
        ['typeB/activate', 'typeB/add'],
        ['typeB/remove', 'typeB/deactivate'],

        // C < B (only available changes)
        ['typeB/activate', 'typeC/modify'],
        ['typeB/add', 'typeC/modify'],
        ['typeB/deactivate', 'typeC/modify'],
        ['typeB/modify', 'typeC/modify'],
        ['typeB/remove', 'typeC/modify'],
        ['typeB/activate', 'typeC/remove'],
        ['typeB/add', 'typeC/remove'],
        ['typeB/deactivate', 'typeC/remove'],
        ['typeB/modify', 'typeC/remove'],
        ['typeB/remove', 'typeC/remove'],
      ])
    })
  })

  describe('with a dependency cycle', () => {
    let graph: DAG<NodeType<'activate' | 'deactivate'>>
    beforeEach(() => {
      deployDef.dependencies = [
        { first: { type: 'typeA', action: 'add' }, second: { type: 'typeB' } },
        { first: { type: 'typeB' }, second: { type: 'typeC' } },
        { first: { type: 'typeC', action: 'remove' }, second: { type: 'typeA', action: 'add' } },
      ]
      graph = createDependencyGraph({
        defQuery: queryWithDefault<InstanceDeployApiDefinitions<'activate' | 'deactivate', 'main'>>(
          deployDef.instances,
        ),
        changeGroup: { changes, groupID: 'abc' },
        changes,
        elementSource: buildElementsSourceFromElements([]),
        sharedContext: {},
        dependencies: deployDef.dependencies,
      })
    })

    it('should throw when traversing the graph', async () => {
      await expect(async () => {
        await graph.walkAsync(async () => undefined)
      }).rejects.toThrow(
        'At least one error encountered during walk:\nError: Circular dependencies exist among these items: typeA/add->[typeC/remove], typeB/add->[typeA/add], typeB/modify->[typeA/add], typeB/remove->[typeA/add], typeC/remove->[typeB/add,typeB/modify,typeB/remove], typeC/modify->[typeB/add,typeB/modify,typeB/remove]',
      )
    })
  })
})
