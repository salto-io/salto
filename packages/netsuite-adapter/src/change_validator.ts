/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { ChangeValidator } from '@salto-io/adapter-api'
import { createChangeValidator } from '@salto-io/adapter-utils'
import removeCustomizationValidator from './change_validators/remove_customization'
import instanceChangesValidator from './change_validators/instance_changes'
import customizationTypeValidator from './change_validators/customization_type'
import serviceIdsChangesValidator from './change_validators/service_ids_changes'


const changeValidators: ChangeValidator[] = [
  removeCustomizationValidator,
  instanceChangesValidator,
  customizationTypeValidator,
  serviceIdsChangesValidator,
]

export default createChangeValidator(changeValidators)
