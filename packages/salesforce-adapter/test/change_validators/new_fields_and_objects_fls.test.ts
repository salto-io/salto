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
import creator from '../../src/change_validators/new_fields_and_objects_fls'


describe('new_fields_and_objects_fls', () => {
  let changeValidator: ChangeValidator

  describe('when flsProfiles are defined in the config', () => {
    const CUSTOM_FLS_PROFILES = ['Test Profile', 'Another Test Profile']
    beforeEach(() => {
      changeValidator = creator({client: {deploy: {flsProfiles: CUSTOM_FLS_PROFILES}}})
    })
  })
})