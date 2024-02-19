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
import { InstanceElement, StaticFile, toChange } from '@salto-io/adapter-api'
import { customtransactiontypeType } from '../../src/autogen/types/standard_types/customtransactiontype'
import fileValidator from '../../src/change_validators/file_changes'
import { fileType } from '../../src/types/file_cabinet_types'
import { fileCabinetTopLevelFolders } from '../../src/client/constants'

describe('file changes validator', () => {
  const file = fileType()
  const customtransactiontype = customtransactiontypeType().type
  it('should not return errors for valid changes', async () => {
    const BigBuffer = Buffer.from('a'.repeat(1024 * 1024 * 11))
    const validBigFileBefore = new InstanceElement('valid', file, {
      path: '/Templates/Marketing Templates/valid',
      content: new StaticFile({ filepath: 'somePath', content: BigBuffer }),
    })

    const validBigFileAfter = new InstanceElement('valid', file, {
      path: '/Templates/Marketing Templates/valid',
      description: 'aaa',
      content: new StaticFile({ filepath: 'somePath', content: BigBuffer }),
    })

    const validTimestampChangeBefore = new InstanceElement('valid2', file, {
      path: '/Templates/E-mail Templates/valid2',
      generateurltimestamp: false,
      content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
    })

    const validTimestampChangeAfter = new InstanceElement('valid2', file, {
      path: '/Templates/E-mail Templates/valid2',
      generateurltimestamp: true,
      content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
    })

    const validDifferentDirChangeBefore = new InstanceElement('valid3', file, {
      path: '/Images/valid3',
      content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
    })

    const validDifferentDirChangeAfter = new InstanceElement('valid3', file, {
      path: '/Images/valid3',
      description: 'aaa',
      content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
    })

    const validNonFileChangeBefore = new InstanceElement('valid4', customtransactiontype, {})

    const validNonFileChangeAfter = new InstanceElement('valid4', customtransactiontype, {
      someField: 'val',
    })

    const validNewTimestampChange = new InstanceElement('valid5', file, {
      path: '/Images/valid5',
      generateurltimestamp: false,
      content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
    })

    const changeErrors = await fileValidator([
      toChange({ before: validBigFileBefore, after: validBigFileAfter }),
      toChange({ before: validTimestampChangeBefore, after: validTimestampChangeAfter }),
      toChange({ before: validDifferentDirChangeBefore, after: validDifferentDirChangeAfter }),
      toChange({ before: validNonFileChangeBefore, after: validNonFileChangeAfter }),
      toChange({ after: validNewTimestampChange }),
    ])
    expect(changeErrors).toHaveLength(0)
  })

  it('should return error for too large file', async () => {
    const BigBuffer = Buffer.from('a'.repeat(1024 * 1024 * 11))
    const invalidBigFileBefore = new InstanceElement('invalid1', file, {
      path: '/Images/invalid1',
      content: new StaticFile({ filepath: 'somePath', content: BigBuffer }),
    })

    const invalidBigFileAfter = new InstanceElement('invalid1', file, {
      path: '/Images/invalid1',
      description: 'aaa',
      content: new StaticFile({ filepath: 'somePath', content: BigBuffer }),
    })

    const changeErrors = await fileValidator([toChange({ before: invalidBigFileBefore, after: invalidBigFileAfter })])
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      detailedMessage:
        "Can't deploy this file since Salto does not support uploading files over 10 MB to the file cabinet.\n" +
        'Please remove this file from your deployment and add it directly in the NetSuite UI.',
      elemID: invalidBigFileAfter.elemID,
      message: "Can't deploy large files",
      severity: 'Error',
    })
  })

  it('should return error for modified file with modified generateUrlTimestamp', async () => {
    const invalidTimestampChangeBefore = new InstanceElement('invalid2', file, {
      path: '/Images/invalid2',
      generateurltimestamp: false,
      content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
    })

    const invalidTimestampChangeAfter = new InstanceElement('invalid2', file, {
      path: '/Images/invalid2',
      generateurltimestamp: true,
      content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
    })

    const changeErrors = await fileValidator([
      toChange({ before: invalidTimestampChangeBefore, after: invalidTimestampChangeAfter }),
    ])
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      detailedMessage:
        `The generateUrlTimestamp field can't be deployed since it is outside of the folders ${fileCabinetTopLevelFolders.join(', ')}.\n` +
        "To deploy this field, you can edit it in Salto. If it's a new field, set its value to false. If it's an existing field, please set it to the original value (false / true). Alternatively, you can edit the file in Salto, remove this field and do the change directly in the NetSuite UI.",
      elemID: invalidTimestampChangeAfter.elemID,
      message: "Can't deploy the generateurltimestamp field for files outside specific folders",
      severity: 'Error',
    })
  })

  it('should return error for created file with generateUrlTimestamp', async () => {
    const invalidNewTimestampChange = new InstanceElement('invalid3', file, {
      path: '/Images/invalid3',
      generateurltimestamp: true,
      content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
    })

    const changeErrors = await fileValidator([toChange({ after: invalidNewTimestampChange })])

    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      detailedMessage:
        `The generateUrlTimestamp field can't be deployed since it is outside of the folders ${fileCabinetTopLevelFolders.join(', ')}.\n` +
        "To deploy this field, you can edit it in Salto. If it's a new field, set its value to false. If it's an existing field, please set it to the original value (false / true). Alternatively, you can edit the file in Salto, remove this field and do the change directly in the NetSuite UI.",
      elemID: invalidNewTimestampChange.elemID,
      message: "Can't deploy the generateurltimestamp field for files outside specific folders",
      severity: 'Error',
    })
  })
})
