/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { JIRA, WORKFLOW_TYPE_NAME } from '../../src/constants'
import removeEmptyValuesFilter from '../../src/filters/remove_empty_values'
import { getFilterParams } from '../utils'

describe('removeEmptyValues', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let instance: InstanceElement
  let type: ObjectType
  beforeEach(async () => {
    filter = removeEmptyValuesFilter(getFilterParams({})) as typeof filter

    type = new ObjectType({
      elemID: new ElemID(JIRA, WORKFLOW_TYPE_NAME),
    })

    instance = new InstanceElement('instance', type, {
      empty: [],
      notEmpty: 'a',
    })
  })

  it('should remove empty value from relevant type', async () => {
    await filter.onFetch([instance])
    expect(instance.value).toEqual({
      notEmpty: 'a',
    })
  })
  it('should not remove empty value from irrelevant type', async () => {
    const irrelevantType = new ObjectType({
      elemID: new ElemID(JIRA, 'irrelevant'),
    })

    instance = new InstanceElement('instance', irrelevantType, {
      empty: [],
      notEmpty: 'a',
    })

    await filter.onFetch([instance])
    expect(instance.value).toEqual({
      empty: [],
      notEmpty: 'a',
    })
  })
})
