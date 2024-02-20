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
import { CORE_ANNOTATIONS, InstanceElement, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/add_parent_folder'
import { INTERNAL_ID, PATH } from '../../src/constants'
import { fileType, folderType } from '../../src/types/file_cabinet_types'
import { LocalFilterOpts } from '../../src/filter'
import { SUITEAPP_CREATING_FILES_GROUP_ID, SUITEAPP_UPDATING_FILES_GROUP_ID } from '../../src/group_changes'

describe('add_parent_folder filter', () => {
  let instance: InstanceElement
  let parentFolder: InstanceElement
  beforeEach(() => {
    instance = new InstanceElement('someFile', fileType(), {})
    parentFolder = new InstanceElement('someFolder', folderType(), {})
  })

  describe('onFetch', () => {
    it('should add parent field to file', async () => {
      instance.value[PATH] = '/aa/bb/cc.txt'
      await filterCreator({} as LocalFilterOpts).onFetch?.([instance])
      expect(instance.annotations[CORE_ANNOTATIONS.PARENT]).toEqual(['[/aa/bb]'])
    })
    it('should not add parent if file is top level', async () => {
      instance.value[PATH] = '/aa'
      await filterCreator({} as LocalFilterOpts).onFetch?.([instance])
      expect(instance.annotations[CORE_ANNOTATIONS.PARENT]).toBeUndefined()
    })
  })
  describe('preDeploy', () => {
    it('should add parent field to file on suiteapp file cabinet additions group', async () => {
      instance.value[PATH] = '/aa/bb/cc.txt'
      parentFolder.value[INTERNAL_ID] = '101'
      parentFolder.value[PATH] = '/aa/bb'
      instance.annotations[CORE_ANNOTATIONS.PARENT] = [
        new ReferenceExpression(parentFolder.elemID, undefined, parentFolder),
      ]
      await filterCreator({ changesGroupId: SUITEAPP_CREATING_FILES_GROUP_ID } as LocalFilterOpts).preDeploy?.([
        toChange({ after: instance }),
      ])
      expect(instance.value.parent).toEqual(101)
    })
    it('should not add parent for removals/modifications', async () => {
      instance.value[PATH] = '/aa/bb/cc.txt'
      parentFolder.value[INTERNAL_ID] = '101'
      parentFolder.value[PATH] = '/aa/bb'
      instance.annotations[CORE_ANNOTATIONS.PARENT] = [
        new ReferenceExpression(parentFolder.elemID, undefined, parentFolder),
      ]
      await filterCreator({ changesGroupId: SUITEAPP_UPDATING_FILES_GROUP_ID } as LocalFilterOpts).preDeploy?.([
        toChange({ after: instance }),
      ])
      expect(instance.value.parent).toBeUndefined()
    })
  })
})
