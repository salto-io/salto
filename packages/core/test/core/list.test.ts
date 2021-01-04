/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { ObjectType, InstanceElement, Element, ElemID, BuiltinTypes, ReferenceExpression } from '@salto-io/adapter-api'
import { listUnresolvedReferences } from '../../src/api'
import { UnresolvedElemIDs } from '../../src/core/list'

const mockWorkspace = ({
  name,
  envElements,
}: {
  name: string
  envElements: Record<string, Element[]>
}): Workspace => ({
  elements: jest.fn().mockImplementation(async (_, env: string) => envElements[env]),
  name,
  envs: () => Object.keys(envElements),
  currentEnv: () => name,
} as unknown as Workspace)

describe('listUnresolvedReferences', () => {
  let workspace: Workspace
  let res: UnresolvedElemIDs

  const createEnvElements = (): Element[] => {
    const type1 = new ObjectType({
      elemID: new ElemID('salesforce', 'someType'),
      fields: {
        f1: { type: BuiltinTypes.STRING },
        f2: { type: BuiltinTypes.STRING },
        f3: { type: BuiltinTypes.STRING },
      },
    })
    const type2 = new ObjectType({
      elemID: new ElemID('salesforce', 'anotherType'),
      annotations: { _parent: new ReferenceExpression(type1.elemID) },
      fields: {
        f1: { type: type1 },
        f2: { type: BuiltinTypes.STRING },
        f3: { type: type1 },
      },
    })
    const inst1 = new InstanceElement(
      'inst1',
      type1,
      {
        f1: 'aaa',
        f2: new ReferenceExpression(new ElemID('salesforce', 'someType', 'field', 'f3')),
        f3: 'ccc',
      },
    )
    const inst2 = new InstanceElement(
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
    return [type1, type2, inst1, inst2]
  }

  describe('workspace with no references', () => {
    beforeAll(async () => {
      const elements = createEnvElements().slice(0, 1)
      workspace = mockWorkspace({
        name: 'default',
        envElements: {
          default: elements,
          other: elements,
        },
      })
      res = await listUnresolvedReferences(workspace)
    })

    it('should not find any unresolved references', async () => {
      expect(res.found).toHaveLength(0)
      expect(res.missing).toHaveLength(0)
    })
  })

  describe('workspace with resolved references', () => {
    beforeAll(async () => {
      jest.resetAllMocks()
      const elements = createEnvElements()
      workspace = mockWorkspace({
        name: 'default',
        envElements: {
          default: elements,
          other: elements,
        },
      })
      res = await listUnresolvedReferences(workspace, 'other')
    })

    it('should not find any unresolved references', () => {
      expect(res.found).toHaveLength(0)
      expect(res.missing).toHaveLength(0)
    })
  })

  describe('workspace with unresolved references and no complete-from env', () => {
    beforeAll(async () => {
      jest.resetAllMocks()
      const defaultElements = createEnvElements().slice(3)
      const otherElements = createEnvElements()
      workspace = mockWorkspace({
        name: 'default',
        envElements: {
          default: defaultElements,
          other: otherElements,
        },
      })
      res = await listUnresolvedReferences(workspace)
    })

    it('should not resolve any references', () => {
      expect(res.found).toHaveLength(0)
      expect(res.missing).toEqual([
        new ElemID('salesforce', 'someType', 'instance', 'inst1'),
      ])
    })
  })

  describe('workspace with unresolved references that exist in other env', () => {
    beforeAll(async () => {
      jest.resetAllMocks()
      const defaultElements = createEnvElements().slice(3)
      const otherElements = createEnvElements()
      workspace = mockWorkspace({
        name: 'default',
        envElements: {
          default: defaultElements,
          other: otherElements,
        },
      })
      res = await listUnresolvedReferences(workspace, 'other')
    })

    it('should successfully resolve all references', () => {
      expect(res.found).toEqual([
        new ElemID('salesforce', 'someType', 'field', 'f3'),
        new ElemID('salesforce', 'someType', 'instance', 'inst1'),
      ])
      expect(res.missing).toHaveLength(0)
    })
  })

  describe('workspace with unresolved references that do not exist in other env', () => {
    beforeAll(async () => {
      jest.resetAllMocks()
      const defaultElements = createEnvElements().slice(3) as InstanceElement[]
      defaultElements[0].value = {
        ...(defaultElements[0] as InstanceElement).value,
        f3: new ReferenceExpression(new ElemID('salesforce', 'unresolved')),
      }
      const otherElements = createEnvElements().slice(1)
      workspace = mockWorkspace({
        name: 'default',
        envElements: {
          default: defaultElements,
          other: otherElements,
        },
      })
      res = await listUnresolvedReferences(workspace, 'other')
    })

    it('should resolve some of the references', () => {
      expect(res.found).toEqual([
        new ElemID('salesforce', 'someType', 'instance', 'inst1', 'f1'),
      ])
      expect(res.missing).toEqual([
        new ElemID('salesforce', 'unresolved'),
      ])
    })
  })
})
