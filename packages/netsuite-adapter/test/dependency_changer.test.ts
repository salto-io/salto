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
import {
  CORE_ANNOTATIONS,
  ChangeId,
  ElemID,
  InstanceElement,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { extendGeneratedDependencies } from '@salto-io/adapter-utils'
import dependencyChanger from '../src/dependency_changer'
import { fileType, folderType } from '../src/types/file_cabinet_types'
import { NETSUITE, PATH, SCRIPT_ID } from '../src/constants'
import { workflowType } from '../src/autogen/types/standard_types/workflow'

describe('dependency changer', () => {
  const emptyDeps: ReadonlyMap<ChangeId, ReadonlySet<ChangeId>> = new Map()
  describe('remove file generated dependencies', () => {
    let fileInstance: InstanceElement
    let folderInstance: InstanceElement
    let anotherInstance: InstanceElement
    beforeEach(() => {
      folderInstance = new InstanceElement('parentFolder', folderType(), { path: '/parentFolder' })
      fileInstance = new InstanceElement('someFile', fileType(), { path: '/parentFolder/someFile' })
      anotherInstance = new InstanceElement('someInstance', workflowType().type, { scriptid: 'custworkflow1' })
    })
    it('should remove dependencies to changes', async () => {
      const changesMap = new Map([
        [1, toChange({ after: fileInstance })],
        [2, toChange({ after: folderInstance })],
        [3, toChange({ after: anotherInstance })],
      ])

      extendGeneratedDependencies(fileInstance, [
        {
          reference: new ReferenceExpression(folderInstance.elemID.createNestedID(PATH)),
        },
        {
          reference: new ReferenceExpression(anotherInstance.elemID.createNestedID(SCRIPT_ID)),
        },
        {
          reference: new ReferenceExpression(new ElemID(NETSUITE, 'workflow', 'instance', 'notChanged')),
        },
      ])

      await expect(dependencyChanger(changesMap, emptyDeps)).resolves.toEqual([
        { action: 'remove', dependency: { source: 1, target: 2 } },
        { action: 'remove', dependency: { source: 1, target: 3 } },
      ])
    })
    it('should not remove dependency to parent folder', async () => {
      const changesMap = new Map([
        [1, toChange({ after: fileInstance })],
        [2, toChange({ after: folderInstance })],
        [3, toChange({ after: anotherInstance })],
      ])

      fileInstance.annotations[CORE_ANNOTATIONS.PARENT] = [new ReferenceExpression(folderInstance.elemID)]

      extendGeneratedDependencies(fileInstance, [
        {
          reference: new ReferenceExpression(folderInstance.elemID.createNestedID(PATH)),
        },
        {
          reference: new ReferenceExpression(anotherInstance.elemID.createNestedID(SCRIPT_ID)),
        },
        {
          reference: new ReferenceExpression(new ElemID(NETSUITE, 'workflow', 'instance', 'notChanged')),
        },
      ])

      await expect(dependencyChanger(changesMap, emptyDeps)).resolves.toEqual([
        { action: 'remove', dependency: { source: 1, target: 3 } },
      ])
    })
    it('should not remove dependencies in non file instance', async () => {
      const changesMap = new Map([
        [1, toChange({ after: fileInstance })],
        [2, toChange({ after: folderInstance })],
        [3, toChange({ after: anotherInstance })],
      ])

      extendGeneratedDependencies(anotherInstance, [
        {
          reference: new ReferenceExpression(folderInstance.elemID.createNestedID(PATH)),
        },
        {
          reference: new ReferenceExpression(fileInstance.elemID.createNestedID(PATH)),
        },
      ])

      await expect(dependencyChanger(changesMap, emptyDeps)).resolves.toEqual([])
    })
  })
})
