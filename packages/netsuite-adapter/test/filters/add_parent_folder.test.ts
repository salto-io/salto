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
import { CORE_ANNOTATIONS, InstanceElement } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/add_parent_folder'
import { fileCabinetTypes } from '../../src/types'
import { PATH, FILE } from '../../src/constants'
import { OnFetchParameters } from '../../src/filter'

describe('add_parent_folder filter', () => {
  let instance: InstanceElement
  let onFetchParameters: OnFetchParameters
  beforeEach(() => {
    instance = new InstanceElement(
      'someFile',
      fileCabinetTypes[FILE],
      {}
    )

    onFetchParameters = {
      elements: [instance],
      elementsSourceIndex: { getIndex: () => Promise.resolve({}) },
      isPartial: false,
    }
  })

  it('should add parent field to file', async () => {
    instance.value[PATH] = '/aa/bb/cc.txt'
    await filterCreator().onFetch(onFetchParameters)
    expect(instance.annotations[CORE_ANNOTATIONS.PARENT]).toEqual('[/aa/bb]')
  })

  it('should not add parent if file is top level', async () => {
    instance.value[PATH] = '/aa'
    await filterCreator().onFetch(onFetchParameters)
    expect(instance.annotations[CORE_ANNOTATIONS.PARENT]).toBeUndefined()
  })
})
