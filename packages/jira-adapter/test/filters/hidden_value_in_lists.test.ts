/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  Field,
  InstanceElement,
  ListType,
  ObjectType,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { JIRA } from '../../src/constants'
import hiddenValueInListsFilter from '../../src/filters/hidden_value_in_lists'
import { getFilterParams } from '../utils'

describe('hiddenValueInListsFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let instance: InstanceElement
  beforeEach(async () => {
    filter = hiddenValueInListsFilter(getFilterParams()) as typeof filter

    const type = new ObjectType({
      elemID: new ElemID(JIRA, 'someType'),
      fields: {
        hidden: {
          refType: BuiltinTypes.STRING,
          annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
        },
        notHidden: { refType: BuiltinTypes.STRING },
      },
    })

    type.fields.list = new Field(type, 'list', new ListType(type))
    type.fields.obj = new Field(type, 'obj', type)

    instance = new InstanceElement('instance', type, {
      hidden: 'hidden',
      notHidden: 'notHidden',
      list: [
        {
          hidden: 'hidden',
          notHidden: 'notHidden',
          other: 'other',
        },
      ],
      obj: {
        hidden: 'hidden',
        notHidden: 'notHidden',
      },
    })
  })

  it('should remove the hidden value inside the list', async () => {
    await filter.onFetch([instance])
    expect(instance.value).toEqual({
      hidden: 'hidden',
      notHidden: 'notHidden',
      list: [
        {
          notHidden: 'notHidden',
          other: 'other',
        },
      ],
      obj: {
        hidden: 'hidden',
        notHidden: 'notHidden',
      },
    })
  })
})
