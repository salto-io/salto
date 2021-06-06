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
import { ChangeValidator } from '@salto-io/adapter-api'
import { createChangeValidator } from '@salto-io/adapter-utils'
import packageValidator from './change_validators/package'
import picklistStandardFieldValidator from './change_validators/picklist_standard_field'
import customObjectInstancesValidator from './change_validators/custom_object_instances'
import unknownFieldValidator from './change_validators/unknown_field'
import customFieldTypeValidator from './change_validators/custom_field_type'
import standardFieldLabelValidator from './change_validators/standard_field_label'
import profileMapKeysValidator from './change_validators/profile_map_keys'
import multipleDefaultsValidator from './change_validators/multiple_deafults'
import fieldAnnotationsReadOnlyValidator from './change_validators/field_annotations'

const changeValidators: ChangeValidator[] = [
  packageValidator,
  picklistStandardFieldValidator,
  customObjectInstancesValidator,
  unknownFieldValidator,
  customFieldTypeValidator,
  standardFieldLabelValidator,
  profileMapKeysValidator,
  multipleDefaultsValidator,
  fieldAnnotationsReadOnlyValidator,
]

export default createChangeValidator(changeValidators)
