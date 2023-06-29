/*
*                      Copyright 2023 Salto Labs Ltd.
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

import { ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { bundleType } from '../../src/types/bundle_type'
import bundleChangesValidation from '../../src/change_validators/bundle_changes'
import { fileType } from '../../src/types/file_cabinet_types'
import { NETSUITE, PATH } from '../../src/constants'

describe('bundle changes', () => {
  const bundleInstanceBefore = new InstanceElement('39609', bundleType().type, { id: '39609', name: 'testName' })
  const fileInstanceBefore = new InstanceElement('fileInstance', fileType(), {
    [PATH]: 'SuiteBundles/Bundle 39609/SomeInnerFolder/content.html',
    bundle: new ReferenceExpression(bundleInstanceBefore.elemID),
    availablewithoutlogin: false,
  })
  let fileInstanceAfter: InstanceElement
  let bundleInstanceAfter: InstanceElement
  let recordInstance: InstanceElement

  beforeEach(() => {
    bundleInstanceAfter = bundleInstanceBefore.clone()
    fileInstanceAfter = fileInstanceBefore.clone()
    recordInstance = new InstanceElement('instance', new ObjectType({ elemID: new ElemID(NETSUITE, 'currency') }),
      {
        bundle: new ReferenceExpression(bundleInstanceBefore.elemID),
        field: 'before',
      })
  })

  it('should have changeError when trying to deploy a bundle instance', async () => {
    bundleInstanceAfter.value.name = 'newName'
    const changeError = await bundleChangesValidation([
      toChange({ after: bundleInstanceAfter, before: bundleInstanceBefore }),
    ])
    expect(changeError).toHaveLength(1)
    expect(changeError[0]).toEqual(
      {
        message: 'Can\'t deploy bundle',
        severity: 'Error',
        elemID: bundleInstanceAfter.elemID,
        detailedMessage: 'This bundle doesn\'t exist in the target account, and cannot be automatically deployed. \nIt may be required by some elements in your deployment.\nYou can manually install this bundle in the target account: <guide to install>',
      }
    )
  })

  it('should have changeError when trying to deploy a new element with bundle field', async () => {
    fileInstanceAfter.value.availablewithoutlogin = true
    const changeError = await bundleChangesValidation([
      toChange({ after: fileInstanceAfter }),
    ])
    expect(changeError).toHaveLength(1)
    expect(changeError[0]).toEqual(
      {
        message: 'Can\'t add new elements to bundle',
        severity: 'Error',
        elemID: fileInstanceAfter.elemID,
        detailedMessage: 'Adding elements to a bundle is not supported.',
      }
    )
  })

  it('should not have changeError', async () => {
    const recordInstanceAfter = recordInstance.clone()
    recordInstanceAfter.value.field = 'after'
    const changeErrors = await bundleChangesValidation([
      toChange({ after: recordInstanceAfter, before: recordInstance }),
    ])
    expect(changeErrors).toHaveLength(0)
  })
})
