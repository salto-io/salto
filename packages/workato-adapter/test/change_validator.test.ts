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
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { DEFAULT_CONFIG } from '../src/config'
import changeValidator from '../src/change_validator'
import { RLM_DEPLOY_SUPPORTED_TYPES, WORKATO } from '../src/constants'

describe('change validator creator', () => {
  describe('notSupportedTypesValidator', () => {
    const nonInFolderType = new ObjectType({ elemID: new ElemID(WORKATO, 'nonRLM') })
    const anotherNonInFolderType = new ObjectType({ elemID: new ElemID(WORKATO, 'nonRLM1') })

    it('should not fail if there are no deploy changes', async () => {
      expect(await changeValidator(DEFAULT_CONFIG)([])).toEqual([])
    })

    it('both should fail', async () => {
      expect(
        await changeValidator(DEFAULT_CONFIG)([
          toChange({ after: new InstanceElement('inst1', nonInFolderType) }),
          toChange({
            before: new InstanceElement('inst1', anotherNonInFolderType),
            after: new InstanceElement('inst1', anotherNonInFolderType),
          }),
        ]),
      ).toMatchObject([
        {
          severity: 'Error',
          message: expect.stringContaining('not supported'), // TODO check after chagne to SaltoError X all places X all fiels (here, actions_not_supported, recipe_overwritten_values, types_not_supported, cross_services_not_supported)
        },
        {
          // TODO add tests to cross_services_not_supported
          severity: 'Error',
          message: expect.stringContaining('not supported'),
        },
      ])
    })
  })

  describe('notSupportedRemovalValidator', () => {
    const InFolderType = new ObjectType({ elemID: new ElemID(WORKATO, RLM_DEPLOY_SUPPORTED_TYPES[0]) })
    it('should fail', async () => {
      expect(
        await changeValidator(DEFAULT_CONFIG)([toChange({ before: new InstanceElement('inst1', InFolderType) })]),
      ).toMatchObject([
        {
          severity: 'Error',
          message: expect.stringContaining('not supported'),
        },
      ])
    })
  })
})
