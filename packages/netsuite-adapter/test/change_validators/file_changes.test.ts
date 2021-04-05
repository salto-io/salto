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
import { InstanceElement, toChange } from '@salto-io/adapter-api'
import fileValidator from '../../src/change_validators/file_changes'
import { file } from '../../src/types/file_cabinet_types'


describe('file changes validator', () => {
  it('should have change error if custom type SCRIPT_ID has been modified', async () => {
    const validFileBefore = new InstanceElement(
      'valid',
      file,
      { path: '/Templates/valid' },
    )

    const validFileAfter = new InstanceElement(
      'valid',
      file,
      {
        path: '/Templates/valid',
        description: 'aaa',
      },
    )

    const invalidFileBefore = new InstanceElement(
      'invalid',
      file,
      { path: '/OtherFolder/invalid' },
    )

    const invalidFileAfter = new InstanceElement(
      'invalid',
      file,
      {
        path: '/OtherFolder/invalid',
        description: 'aaa',
      },
    )
    const changeErrors = await fileValidator(
      [
        toChange({ before: validFileBefore, after: validFileAfter }),
        toChange({ before: invalidFileBefore, after: invalidFileAfter }),
      ]
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].elemID).toEqual(invalidFileBefore.elemID)
  })
})
