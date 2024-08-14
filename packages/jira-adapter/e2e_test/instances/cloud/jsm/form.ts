/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { Values } from '@salto-io/adapter-api'

export const createFormValues = (name: string): Values => ({
  publish: {},
  design: {
    settings: {
      name,
      submit: {
        lock: false,
        pdf: false,
      },
    },
    layout: [
      {
        version: 1,
        type: 'doc',
        content: [],
      },
    ],
    conditions: {},
    sections: {},
    questions: {},
  },
})
