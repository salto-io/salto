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
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import changeValidator from '../src/change_validator'
import { DEPLOY_SUPPORTED_TYPES, WORKATO } from '../src/constants'

describe('change validator creator', () => {
  describe('notSupportedTypesValidator', () => {
    const nonInFolderType = new ObjectType({ elemID: new ElemID(WORKATO, 'nonRLM') })
    const anotherNonInFolderType = new ObjectType({ elemID: new ElemID(WORKATO, 'nonRLM1') })

    it('should not fail if there are no deploy changes', async () => {
      expect(await changeValidator([])).toEqual([])
    })

    it('both should fail', async () => {
      expect(await changeValidator([
        toChange({ after: new InstanceElement('inst1', nonInFolderType) }),
        toChange({ before: new InstanceElement('inst1', anotherNonInFolderType),
          after: new InstanceElement('inst1', anotherNonInFolderType) }),
      ])).toMatchObject([{
        severity: 'Error',
        message: expect.stringContaining('not supported'),
      }, {
        severity: 'Error',
        message: expect.stringContaining('not supported'),
      }])
    })
  })

  describe('notSupportedRemovalValidator', () => {
    const InFolderType = new ObjectType({ elemID: new ElemID(WORKATO, DEPLOY_SUPPORTED_TYPES[0]) })
    it('should fail', async () => {
      expect(await changeValidator([
        toChange({ before: new InstanceElement('inst1', InFolderType) }),
      ])).toMatchObject([{
        severity: 'Error',
        message: expect.stringContaining('not supported'),
      }])
    })
  })
})
