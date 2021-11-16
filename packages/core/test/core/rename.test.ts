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
import { DetailedChange, ElemID, InstanceElement, isInstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { resolvePath } from '@salto-io/adapter-utils'
import * as workspace from '@salto-io/workspace'
import * as rename from '../../src/core/rename'

import * as mockElements from '../common/elements'
import { mockWorkspace } from '../common/workspace'

describe('rename.ts', () => {
  let ws: workspace.Workspace
  let sourceElemId: ElemID
  let elements: workspace.ElementsSource
  beforeAll(async () => {
    const workspaceElements = mockElements.getAllElements()
    ws = mockWorkspace({ elements: workspaceElements })
    elements = await ws.elements()
    sourceElemId = new ElemID('salto', 'employee', 'instance', 'instance')
  })

  describe('renameChecks', () => {
    it('should pass checks', async () => {
      const targetElemId = new ElemID(sourceElemId.adapter, sourceElemId.typeName, sourceElemId.idType, 'renamed')
      expect(await rename.renameChecks(ws, sourceElemId, targetElemId)).toBeUndefined()
    })
    it('should throw when source and target ids are the same', async () =>
      expect(rename.renameChecks(ws, sourceElemId, sourceElemId))
        .rejects.toThrow(`Source and target element ids are the same: ${sourceElemId.getFullName()}`))
    it('should throw when trying to rename something else than instance name', async () => {
      const targetElemId = new ElemID(sourceElemId.adapter, 'renamed', sourceElemId.idType, ...sourceElemId.getFullNameParts().slice(ElemID.NUM_ELEM_ID_NON_NAME_PARTS))
      return expect(rename.renameChecks(ws, sourceElemId, targetElemId))
        .rejects.toThrow('Only instance name renaming is allowed')
    })
    it('should throw when targetElementId already exists', async () => {
      const existElementId = mockElements.getAllElements()
        .filter(isInstanceElement).map(e => e.elemID)
        .find(e => e.getFullName() !== sourceElemId.getFullName()) as ElemID
      return expect(rename.renameChecks(ws, sourceElemId, existElementId))
        .rejects.toThrow(`Element ${existElementId.getFullName()} already exists`)
    })
    it('should throw when sourceElementId doesn\'t exists', async () => {
      const notSourceElemId = new ElemID(sourceElemId.adapter, sourceElemId.typeName, sourceElemId.idType, 'notExist')
      const targetElemId = new ElemID(sourceElemId.adapter, sourceElemId.typeName, sourceElemId.idType, 'renamed')
      return expect(rename.renameChecks(ws, notSourceElemId, targetElemId))
        .rejects.toThrow(`Did not find any matches for element ${notSourceElemId.getFullName()}`)
    })
    it('should throw when source is not InstanceElement', async () => {
      const fieldElemId = new ElemID('salto', 'address', 'field', 'country')
      const targetElemId = new ElemID('salto', 'address', 'field', 'renamed')
      return expect(rename.renameChecks(ws, fieldElemId, targetElemId))
        .rejects.toThrow(`Source element should be top level (${fieldElemId.getFullName()} is of type '${fieldElemId.idType}')`)
    })
  })
  describe('validate changes', () => {
    let sourceElement: InstanceElement
    let targetElement: InstanceElement
    let elementChanges: DetailedChange[]
    let refElemId: ElemID
    let referencesChanges: DetailedChange[]
    beforeAll(async () => {
      sourceElement = await ws.getValue(sourceElemId)

      targetElement = new InstanceElement(
        'renamed',
        sourceElement.refType,
        sourceElement.value,
        sourceElement.path,
        sourceElement.annotations
      )

      elementChanges = [
        { id: sourceElemId, action: 'remove', data: { before: sourceElement } },
        { id: targetElement.elemID, action: 'add', data: { after: targetElement } },
      ]

      refElemId = new ElemID('salto', 'employee', 'instance', 'anotherInstance', 'friend')
      const beforeRef = new ReferenceExpression(sourceElemId)
      const afterRef = new ReferenceExpression(targetElement.elemID)
      referencesChanges = [{ id: refElemId, action: 'modify', data: { before: beforeRef, after: afterRef } }]
    })
    describe('renameElement', () => {
      let changes: DetailedChange[]
      beforeAll(async () => {
        changes = await rename.renameElement(
          elements,
          sourceElemId,
          targetElement.elemID
        )
      })
      it('should return changes', async () => {
        expect(changes).toEqual([...elementChanges, ...referencesChanges])
      })
      it('should update pathIndex', async () => {
        const topLevelPaths = [['salto', 'records', 'instance', 'main'],
          ['salto', 'records', 'instance', 'personal']]
        const specificPath = [topLevelPaths[1]]

        const workspaceElements = mockElements.getAllElements()
        const newWs = mockWorkspace({ elements: workspaceElements })
        const index = await newWs.state().getPathIndex()
        await index.set(sourceElemId.getFullName(), topLevelPaths)
        const nestedElemId = sourceElemId.createNestedID('name')
        await index.set(nestedElemId.getFullName(), specificPath)

        const targetElemId = new ElemID(sourceElemId.adapter, sourceElemId.typeName, sourceElemId.idType, 'renamed')

        await rename.renameElement(
          await newWs.elements(),
          sourceElemId,
          targetElemId,
          index
        )
        expect(await index.get(sourceElemId.getFullName())).toBeUndefined()
        expect(await index.get(nestedElemId.getFullName())).toBeUndefined()
        expect(await index.get(targetElemId.getFullName())).toEqual(topLevelPaths)
        expect(await index.get(targetElemId.createNestedID('name').getFullName())).toEqual(specificPath)
      })
    })
    describe('updateStateElements', () => {
      it('should update state', async () => {
        const state = ws.state()
        await rename.updateStateElements(state, [...elementChanges, ...referencesChanges])
        expect(await state.get(sourceElemId)).toBeUndefined()
        expect(await state.get(targetElement.elemID)).toEqual(targetElement)
        expect(resolvePath(await state.get(refElemId.createTopLevelParentID().parent),
          refElemId)).toEqual(new ReferenceExpression(targetElement.elemID))
      })
    })
  })
})
