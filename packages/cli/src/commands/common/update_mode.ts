/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { nacl } from '@salto-io/workspace'
import { KeyedOption } from '../../types'

export type UpdateModeArg = {
  mode: nacl.RoutingMode
}

export const UPDATE_MODE_OPTION: KeyedOption<UpdateModeArg> = {
  name: 'mode',
  alias: 'm',
  required: false,
  description: 'Choose an update mode. Options - [default, align]',
  type: 'string',
  // 'override' and 'isolated' are undocumented
  choices: ['default', 'align', 'override', 'isolated'],
  default: 'default',
}
