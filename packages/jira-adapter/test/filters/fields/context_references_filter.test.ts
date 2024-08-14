/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  Values,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { getFilterParams } from '../../utils'
import { JIRA } from '../../../src/constants'
import contextReferencesFilter from '../../../src/filters/fields/context_references_filter'

describe('context_references_filter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let fieldType: ObjectType
  let fieldContextType: ObjectType
  beforeEach(() => {
    filter = contextReferencesFilter(getFilterParams()) as typeof filter

    fieldType = new ObjectType({ elemID: new ElemID(JIRA, 'Field') })
    fieldContextType = new ObjectType({ elemID: new ElemID(JIRA, 'CustomFieldContext') })
  })

  it('should add contexts to fields', async () => {
    const field1 = new InstanceElement('field1', fieldType)
    const field2 = new InstanceElement('field2', fieldType)

    const context1 = new InstanceElement('context1', fieldContextType, {}, [], {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(field1.elemID, field1)],
    })

    const context2 = new InstanceElement('context2', fieldContextType, {}, [], {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(field1.elemID, field1)],
    })

    await filter.onFetch([field1, field2, context1, context2])
    expect(field1.value.contexts.map((e: Values) => e.elemID.getFullName())).toEqual([
      context1.elemID.getFullName(),
      context2.elemID.getFullName(),
    ])
    expect(field2.value.contexts).toBeUndefined()
  })
})
