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
import { toChange, ObjectType, ElemID } from '@salto-io/adapter-api'
import changeValidator from '../src/change_validator'
import { WORKATO } from '../src/constants'

describe('change validator creator', () => {
  describe('deployNotSupportedValidator', () => {
    it('should not fail if there are no deploy changes', async () => {
      expect(await changeValidator([])).toEqual([])
    })

    it('should fail each change individually', async () => {
      expect(await changeValidator([
        toChange({ after: new ObjectType({ elemID: new ElemID(WORKATO, 'obj') }) }),
        toChange({ before: new ObjectType({ elemID: new ElemID(WORKATO, 'obj2') }) }),
      ])).toEqual([
        {
          elemID: new ElemID(WORKATO, 'obj'),
          severity: 'Error',
          message: 'Salto does not support workato deployments.',
          detailedMessage: 'Salto does not support workato deployments. Please see https://docs.salto.io/docs/supported-bizapps for more details.',
        },
        {
          elemID: new ElemID(WORKATO, 'obj2'),
          severity: 'Error',
          message: 'Salto does not support workato deployments.',
          detailedMessage: 'Salto does not support workato deployments. Please see https://docs.salto.io/docs/supported-bizapps for more details.',
        },
      ])
    })
  })
})
