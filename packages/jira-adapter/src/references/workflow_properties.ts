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

import { FIELD_TYPE_NAME } from '../filters/fields/constants'
import { GROUP_TYPE_NAME, PROJECT_ROLE_TYPE, RESOLUTION_TYPE_NAME } from '../constants'

export const RESOLUTION_KEY_PATTERN = 'jira\\.field\\.resolution'

const KEY_ID_REGEX_TO_TYPE = {
  'jira\\.permission\\..*\\.projectrole': PROJECT_ROLE_TYPE,
  'jira\\.permission\\..*\\.groupCF': FIELD_TYPE_NAME,
  'jira\\.permission\\..*\\.userCF': FIELD_TYPE_NAME,
  [RESOLUTION_KEY_PATTERN]: RESOLUTION_TYPE_NAME,
  'jira\\.permission\\..*\\.group': GROUP_TYPE_NAME,
}

export const getRefType = (key: string): string | undefined =>
  Object.entries(KEY_ID_REGEX_TO_TYPE).find(([keyRegex]) => new RegExp(keyRegex).test(key))?.[1]
