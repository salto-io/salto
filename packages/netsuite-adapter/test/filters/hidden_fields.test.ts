/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, ObjectType } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/hidden_fields'
import { NETSUITE } from '../../src/constants'
import { LocalFilterOpts } from '../../src/filter'

describe('hidden_fields', () => {
  it('should hide requested fields', async () => {
    const type = new ObjectType({
      elemID: new ElemID(NETSUITE, 'someType'),
      fields: {
        internalId: { refType: BuiltinTypes.STRING },
        otherField: { refType: BuiltinTypes.STRING },
      },
      annotations: { source: 'soap' },
    })
    await filterCreator({} as LocalFilterOpts).onFetch?.([type])
    expect(type.fields.internalId.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE]).toBeTruthy()
    expect(type.fields.otherField.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE]).toBeUndefined()
  })
})
