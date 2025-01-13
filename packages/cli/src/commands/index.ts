/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import fetchDef from './fetch'
import { adapterFormatGroupDef } from './adapter_format'
import envGroupDef from './env'
import { accountGroupDef, serviceGroupDef } from './account'
import deployDef from './deploy'
import initDef from './init'
import restoreDef from './restore'
import elementGroupDef from './element'
import workspaceGroupDef from './workspace'
import cancelTaskDef from './cancel_task'

// The order of the builders determines order of appearance in help text
export default [
  initDef,
  envGroupDef,
  accountGroupDef,
  serviceGroupDef, // Deprecated. Maintained for backward compatibility.
  fetchDef,
  adapterFormatGroupDef,
  deployDef,
  restoreDef,
  elementGroupDef,
  workspaceGroupDef,
  cancelTaskDef,
]
