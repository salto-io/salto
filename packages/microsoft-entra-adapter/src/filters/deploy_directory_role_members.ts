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

import {
  MEMBERS_FIELD_NAME,
  ADAPTER_NAME,
  DIRECTORY_ROLE_TYPE_NAME,
  DIRECTORY_ROLE_MEMBERS_TYPE_NAME,
} from '../constants'
import { mapMemberRefToChangeData } from './utils'
import { deployArrayFieldsFilterCreator } from './array_fields_deployment'

export const deployDirectoryRoleMembersFilter = deployArrayFieldsFilterCreator({
  adapterName: ADAPTER_NAME,
  topLevelTypeName: DIRECTORY_ROLE_TYPE_NAME,
  fieldName: MEMBERS_FIELD_NAME,
  fieldTypeName: DIRECTORY_ROLE_MEMBERS_TYPE_NAME,
  valueMapper: mapMemberRefToChangeData,
})
