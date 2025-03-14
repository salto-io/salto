/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Values } from '@salto-io/adapter-api'

// TODO update to reflect new scripted field
export const createScriptedFieldValues = (name: string): Values => ({
  name,
  scriptedFieldType: 'DATE_FIELD',
  codeToRun: 'issue.projectObject.key == XYZ17',
  description: 'Description of the scripted field',
})
