/*
*                      Copyright 2022 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, ReferenceExpression, Values } from '@salto-io/adapter-api'
import { filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { mockClient } from '../../utils'
import { DEFAULT_CONFIG } from '../../../src/config'
import { JIRA } from '../../../src/constants'
import contextReferencesFilter from '../../../src/filters/fields/context_references_filter'

describe('context_references_filter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let fieldType: ObjectType
  let fieldContextType: ObjectType
  beforeEach(() => {
    const { client, paginator } = mockClient()
    filter = contextReferencesFilter({
      client,
      paginator,
      config: DEFAULT_CONFIG,
      elementsSource: buildElementsSourceFromElements([]),
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as typeof filter

    fieldType = new ObjectType({ elemID: new ElemID(JIRA, 'Field') })
    fieldContextType = new ObjectType({ elemID: new ElemID(JIRA, 'CustomFieldContext') })
  })

  it('should add contexts to fields', async () => {
    const field1 = new InstanceElement(
      'field1',
      fieldType,
    )
    const field2 = new InstanceElement(
      'field2',
      fieldType,
    )

    const context1 = new InstanceElement(
      'context1',
      fieldContextType,
      {},
      [],
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(field1.elemID, field1)],
      },
    )

    const context2 = new InstanceElement(
      'context2',
      fieldContextType,
      {},
      [],
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(field1.elemID, field1)],
      },
    )

    await filter.onFetch([field1, field2, context1, context2])
    expect(field1.value.contexts.map((e: Values) => e.elemID.getFullName())).toEqual([
      context1.elemID.getFullName(),
      context2.elemID.getFullName(),
    ])
    expect(field2.value.contexts).toBeUndefined()
  })
})
