/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import filterCreator from '../../../src/filters/internal_ids/suite_app_internal_ids'
import { NETSUITE } from '../../../src/constants'
import { LocalFilterOpts } from '../../../src/filter'

describe('suite app internal ids filter tests', () => {
  it('should add the internal id to new instances', async () => {
    const type = new ObjectType({
      elemID: new ElemID(NETSUITE, 'type'),
      annotations: { source: 'soap' },
    })

    const instance = new InstanceElement('instance', type)

    await filterCreator({} as LocalFilterOpts).onDeploy?.([toChange({ after: instance })], {
      elemIdToInternalId: { [instance.elemID.getFullName()]: '2' },
      appliedChanges: [],
      errors: [],
    })
    expect(instance.value).toEqual({ internalId: '2' })
  })
})
