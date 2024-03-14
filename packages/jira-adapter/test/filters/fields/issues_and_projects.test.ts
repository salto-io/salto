/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import {
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { JIRA } from '../../../src/constants'
import { setContextField } from '../../../src/filters/fields/issues_and_projects'

describe('issues and projects', () => {
  describe('updateDefaultValues', () => {
    let client: MockInterface<clientUtils.HTTPWriteClientInterface>
    let field: InstanceElement
    let context: InstanceElement

    beforeEach(() => {
      client = {
        post: mockFunction<clientUtils.HTTPWriteClientInterface['post']>(),
        put: mockFunction<clientUtils.HTTPWriteClientInterface['put']>(),
        delete: mockFunction<clientUtils.HTTPWriteClientInterface['delete']>(),
        patch: mockFunction<clientUtils.HTTPWriteClientInterface['patch']>(),
      }

      field = new InstanceElement('field', new ObjectType({ elemID: new ElemID(JIRA, 'Field') }), {
        id: 1,
      })

      context = new InstanceElement(
        'context',
        new ObjectType({ elemID: new ElemID(JIRA, 'CustomFieldContext') }),
        {
          id: 2,
          projectIds: ['3', '4'],
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(field.elemID, field)],
        },
      )
    })

    it('should set added and removed ids', async () => {
      const contextAfter = context.clone()
      contextAfter.value.projectIds = ['3', '5']

      const contextChange = toChange({
        before: context,
        after: contextAfter,
      })

      await setContextField({ contextChange, fieldName: 'projectIds', endpoint: 'projects', client })

      expect(client.put).toHaveBeenCalledWith({
        url: '/rest/api/3/field/1/context/2/projects',
        data: {
          projectIds: ['5'],
        },
      })

      expect(client.post).toHaveBeenCalledWith({
        url: '/rest/api/3/field/1/context/2/projects/remove',
        data: {
          projectIds: ['4'],
        },
      })
    })
  })
})
