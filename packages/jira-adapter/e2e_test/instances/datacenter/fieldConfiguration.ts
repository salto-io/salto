/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Values } from '@salto-io/adapter-api'

export const createFieldConfigurationValues = (name: string): Values => ({
  name,
  description: name,
  fields: {
    'Component_s__array@duu': {
      description:
        'For example operating system, software platform and/or hardware specifications (include as appropriate for the issue).',
      renderer: 'frother-control-renderer',
      isHidden: false,
      isRequired: false,
    },
  },
})
