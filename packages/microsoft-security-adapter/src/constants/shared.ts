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

import { naclCase } from '@salto-io/adapter-utils'

export const ADAPTER_NAME = 'microsoft_security'

/* Fields */
// Used for service id purpose, when the id of the child is not globally unique
export const PARENT_ID_FIELD_NAME = 'parent_id'

/* OData constants */
export const ODATA_PREFIX = '#microsoft.graph.'

export const ODATA_ID_FIELD = '@odata.id'
export const ODATA_ID_FIELD_NACL_CASE = naclCase(ODATA_ID_FIELD)
export const ODATA_TYPE_FIELD = '@odata.type'
export const ODATA_TYPE_FIELD_NACL_CASE = naclCase(ODATA_TYPE_FIELD)
