/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { BuiltinTypes, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { JIRA } from '../../src/constants'
import removeSelfFilter from '../../src/filters/remove_self'
import { getFilterParams } from '../utils'

describe('removeSelfFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let instance: InstanceElement
  let type: ObjectType
  beforeEach(async () => {
    filter = removeSelfFilter(getFilterParams({})) as typeof filter

    type = new ObjectType({
      elemID: new ElemID(JIRA, 'someType'),
      fields: {
        self: { refType: BuiltinTypes.STRING },
      },
    })

    instance = new InstanceElement('instance', type, {
      self: 'someSelf',
      obj: {
        self: 'someSelf2',
        other: 'other',
      },
      other: 'other',
    })
  })

  it('should remove self from types', async () => {
    await filter.onFetch([type])
    expect(type.fields.self).toBeUndefined()
  })
  it('should remove self from instanecs', async () => {
    await filter.onFetch([instance])
    expect(instance.value).toEqual({
      other: 'other',
      obj: {
        other: 'other',
      },
    })
  })
})
