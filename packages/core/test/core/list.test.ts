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
import { Workspace } from '@salto-io/workspace'
import { ObjectType, InstanceElement, ElemID, BuiltinTypes, ReferenceExpression } from '@salto-io/adapter-api'
import { mockWorkspace } from '../api.test'
import { listElementDependencies } from '../../src/api'

describe('listElementDependencies', () => {
  let workspace: Workspace
  let type1: ObjectType
  let type2: ObjectType
  let inst1: InstanceElement
  let inst2: InstanceElement

  beforeAll(async () => {
    type1 = new ObjectType({
      elemID: new ElemID('salesforce', 'someType'),
      fields: {
        f1: { type: BuiltinTypes.STRING },
        f2: { type: BuiltinTypes.STRING },
        f3: { type: BuiltinTypes.STRING },
      },
    })
    type2 = new ObjectType({
      elemID: new ElemID('salesforce', 'anotherType'),
      annotations: { _parent: new ReferenceExpression(type1.elemID) },
      fields: {
        f1: { type: type1 },
        f2: { type: BuiltinTypes.STRING },
        f3: { type: type1 },
      },
    })
    inst1 = new InstanceElement(
      'inst1',
      type1,
      {
        f1: 'aaa',
        f2: new ReferenceExpression(new ElemID('salesforce', 'someType', 'field', 'f3')),
        f3: 'ccc',
      },
    )
    inst2 = new InstanceElement(
      'inst2',
      type2,
      {
        f1: {
          f1: 'aaa',
          f2: 'bbb',
          f3: new ReferenceExpression(new ElemID('salesforce', 'someType', 'instance', 'inst1', 'f1')),
        },
        f3: new ReferenceExpression(new ElemID('salesforce', 'someType', 'instance', 'inst1')),
      },
    )
    const elements = [type1, type2, inst1, inst2]
    workspace = mockWorkspace({ elements, services: ['salesforce', 'netsuite'] })
  })

  afterAll(() => {
    jest.clearAllMocks()
  })

  it('should get elements for the active env', async () => {
    await listElementDependencies(workspace, [type1.elemID], 1)
    expect(workspace.elements).toHaveBeenCalledWith(true, 'default')
  })

  it('should return nothing when there are no reference expressions', async () => {
    expect(await listElementDependencies(workspace, [type1.elemID], 1)).toHaveLength(0)
    expect(await listElementDependencies(workspace, [type1.elemID], 2)).toHaveLength(0)
    expect(await listElementDependencies(workspace, [type1.elemID], 3)).toHaveLength(0)
  })
  it('should return direct dependencies for types with depth 1', async () => {
    expect(await listElementDependencies(workspace, [type2.elemID], 1)).toEqual([
      type1.elemID.getFullName(),
    ])
  })

  it('should return direct dependencies for instances with depth 1', async () => {
    expect(await listElementDependencies(workspace, [inst1.elemID], 1)).toEqual(['salesforce.someType.field.f3'])
  })

  it('should resolve references for element parts', async () => {
    const deps = await listElementDependencies(workspace, [inst2.elemID.createNestedID('f1')], 1)
    expect(deps).toEqual(['salesforce.someType.instance.inst1.f1'])
  })

  it('should only include highest ancestor in list', async () => {
    const deps = await listElementDependencies(workspace, [inst2.elemID], 1)
    expect(deps).toEqual(['salesforce.someType.instance.inst1'])
    expect(deps).not.toContain('salesforce.someType.instance.inst1.f1')
  })

  it('should also include indirect dependencies when depth >1', async () => {
    const deps = await listElementDependencies(workspace, [inst2.elemID], 2)
    expect(deps).toEqual([
      'salesforce.someType.field.f3',
      'salesforce.someType.instance.inst1',
    ])
  })

  it('should support multiple ids, without repetitions and without source ids', async () => {
    const deps = await listElementDependencies(workspace, [
      inst2.elemID,
      inst2.elemID.createNestedID('f1'),
      inst1.elemID,
    ], 2)
    expect(deps).toEqual([
      'salesforce.someType.field.f3',
    ])
    expect(await listElementDependencies(workspace, [
      inst2.elemID, inst2.elemID, inst2.elemID,
    ], 2)).toEqual([
      'salesforce.someType.field.f3',
      'salesforce.someType.instance.inst1',
    ])
    expect(await listElementDependencies(workspace, [
      inst2.elemID, type2.elemID,
    ], 2)).toEqual([
      'salesforce.someType',
      'salesforce.someType.instance.inst1',
    ])
  })
})
