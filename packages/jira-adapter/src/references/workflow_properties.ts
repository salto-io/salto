/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
  'approval\\.field\\.id': FIELD_TYPE_NAME,
  'approval\\.pre-populated\\.field\\.id': FIELD_TYPE_NAME,
}

export const getRefType = (key: string): string | undefined =>
  Object.entries(KEY_ID_REGEX_TO_TYPE).find(([keyRegex]) => new RegExp(keyRegex).test(key))?.[1]
