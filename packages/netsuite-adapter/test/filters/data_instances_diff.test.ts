/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/data_instances_diff'
import { NETSUITE } from '../../src/constants'
import { LocalFilterOpts } from '../../src/filter'

describe('data_instances_diff', () => {
  it('preDeploy should remove identical fields', async () => {
    const type = new ObjectType({
      elemID: new ElemID(NETSUITE, 'Customer'),
      annotations: { source: 'soap' },
    })
    const beforeInstance = new InstanceElement('name', type, {
      identical1: 1,
      identical2: [2, 3],
      identical3: { a: 1 },
      identical4: [{ a: 1 }],
      diff1: 1,
      diff2: [2, 3],
      diff3: { a: 1 },
      diff4: [{ a: 1 }],
    })

    const afterInstance = new InstanceElement('name', type, {
      identical1: 1,
      identical2: [2, 3],
      identical3: { a: 1 },
      identical4: [{ a: 1 }],
      diff1: 2,
      diff2: [2, 4],
      diff3: { b: 1 },
      diff4: [{ a: 3 }],
    })
    await filterCreator({} as LocalFilterOpts).preDeploy?.([
      toChange({ before: beforeInstance, after: afterInstance }),
      toChange({ before: type, after: type }),
    ])
    expect(afterInstance.value).toEqual({
      diff1: 2,
      diff2: [2, 4],
      diff3: { b: 1 },
      diff4: [{ a: 3 }],
    })
  })
})
