/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { Event } from 'jest-circus'

type TestBlock = {
  parent?: TestBlock
  name: string
}

const testBlockId = (b: TestBlock): string =>
  b.parent ? [testBlockId(b.parent), b.name].filter(x => x).join(' | ') : ''

type EventStatus = 'start' | 'success' | 'failure'

type TestStatusChangeEvent = {
  id: string
  type: 'test' | 'hook'
  status: EventStatus
}

export const extractStatus = (e: Event): TestStatusChangeEvent | undefined => {
  if (e.name === 'hook_start' || e.name === 'hook_success' || e.name === 'hook_failure') {
    return {
      id: testBlockId({ name: e.hook.type, parent: e.hook.parent }),
      type: 'hook',
      status: e.name.split('_')[1] as EventStatus,
    }
  }

  if (e.name === 'test_fn_start' || e.name === 'test_fn_success' || e.name === 'test_fn_failure') {
    return {
      id: testBlockId({ name: e.test.name, parent: e.test.parent }),
      type: 'test',
      status: e.name.split('_')[2] as EventStatus,
    }
  }

  return undefined
}
