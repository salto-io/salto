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
import { toChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { mockInstances } from '../mock_elements'
import changeValidator from '../../src/change_validators/installed_packages'

const { awu } = collections.asynciterable

describe('installedPackages Change Validator', () => {
  it('should create change errors', async () => {
    const instance = mockInstances().InstalledPackage
    await awu([
      toChange({ before: instance, after: instance }),
      toChange({ before: instance }),
      toChange({ after: instance }),
    ])
      .map((change) => changeValidator([change]))
      .forEach((changeErrors) => {
        expect(changeErrors).toEqual([
          expect.objectContaining({
            elemID: instance.elemID,
            severity: 'Error',
            detailedMessage: expect.stringContaining(instance.value.fullName),
          }),
        ])
      })
  })
})
