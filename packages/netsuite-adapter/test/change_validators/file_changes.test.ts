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
import { InstanceElement, StaticFile, toChange } from '@salto-io/adapter-api'
import { customtransactiontype } from '../../src/types/custom_types/customtransactiontype'
import fileValidator from '../../src/change_validators/file_changes'
import { file } from '../../src/types/file_cabinet_types'


describe('file changes validator', () => {
  it('should not return errors for valid changes', async () => {
    const BigBuffer = Buffer.from('a'.repeat(1024 * 1024 * 11))
    const validBigFileBefore = new InstanceElement(
      'valid',
      file,
      {
        path: '/Templates/valid',
        content: new StaticFile({ filepath: 'somePath', content: BigBuffer }),
      },
    )

    const validBigFileAfter = new InstanceElement(
      'valid',
      file,
      {
        path: '/Templates/valid',
        description: 'aaa',
        content: new StaticFile({ filepath: 'somePath', content: BigBuffer }),
      },
    )

    const validTimestampChangeBefore = new InstanceElement(
      'valid2',
      file,
      {
        path: '/Templates/valid2',
        generateurltimestamp: false,
        content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
      },
    )

    const validTimestampChangeAfter = new InstanceElement(
      'valid2',
      file,
      {
        path: '/Templates/valid2',
        generateurltimestamp: true,
        content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
      },
    )

    const validDifferentDirChangeBefore = new InstanceElement(
      'valid3',
      file,
      {
        path: '/Images/valid3',
        content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
      },
    )

    const validDifferentDirChangeAfter = new InstanceElement(
      'valid3',
      file,
      {
        path: '/Images/valid3',
        description: 'aaa',
        content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
      },
    )

    const validNonFileChangeBefore = new InstanceElement(
      'valid4',
      customtransactiontype,
      {},
    )

    const validNonFileChangeAfter = new InstanceElement(
      'valid4',
      customtransactiontype,
      {
        someField: 'val',
      },
    )

    const validNewTimestampChange = new InstanceElement(
      'valid5',
      file,
      {
        path: '/Images/valid5',
        generateurltimestamp: false,
        content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
      },
    )

    const changeErrors = await fileValidator(
      [
        toChange({ before: validBigFileBefore, after: validBigFileAfter }),
        toChange({ before: validTimestampChangeBefore, after: validTimestampChangeAfter }),
        toChange({ before: validDifferentDirChangeBefore, after: validDifferentDirChangeAfter }),
        toChange({ before: validNonFileChangeBefore, after: validNonFileChangeAfter }),
        toChange({ after: validNewTimestampChange }),
      ]
    )
    expect(changeErrors).toHaveLength(0)
  })

  it('should return errors for invalid changes', async () => {
    const BigBuffer = Buffer.from('a'.repeat(1024 * 1024 * 11))
    const invalidBigFileBefore = new InstanceElement(
      'invalid1',
      file,
      {
        path: '/Templates/valid1',
        content: new StaticFile({ filepath: 'somePath', content: BigBuffer }),
      },
    )

    const invalidBigFileAfter = new InstanceElement(
      'invalid1',
      file,
      {
        path: '/Images/invalid1',
        description: 'aaa',
        content: new StaticFile({ filepath: 'somePath', content: BigBuffer }),
      },
    )

    const invalidTimestampChangeBefore = new InstanceElement(
      'invalid2',
      file,
      {
        path: '/Images/invalid2',
        generateurltimestamp: false,
        content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
      },
    )

    const invalidTimestampChangeAfter = new InstanceElement(
      'invalid2',
      file,
      {
        path: '/Images/invalid2',
        generateurltimestamp: true,
        content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
      },
    )

    const invalidNewTimestampChange = new InstanceElement(
      'invalid3',
      file,
      {
        path: '/Images/invalid3',
        generateurltimestamp: true,
        content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
      },
    )

    const changeErrors = await fileValidator(
      [
        toChange({ before: invalidBigFileBefore, after: invalidBigFileAfter }),
        toChange({ before: invalidTimestampChangeBefore, after: invalidTimestampChangeAfter }),
        toChange({ after: invalidNewTimestampChange }),

      ]
    )
    expect(changeErrors).toHaveLength(3)
  })
})
