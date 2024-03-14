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
import {
  setDefaultValueTypeDeploymentAnnotations,
  updateDefaultValues,
} from '../../../src/filters/fields/default_values'
import { JIRA } from '../../../src/constants'
import { FIELD_CONTEXT_TYPE_NAME } from '../../../src/filters/fields/constants'

describe('default values', () => {
  describe('updateDefaultValues', () => {
    let client: MockInterface<clientUtils.HTTPWriteClientInterface>
    let type: ObjectType

    beforeEach(() => {
      client = {
        post: mockFunction<clientUtils.HTTPWriteClientInterface['post']>(),
        put: mockFunction<clientUtils.HTTPWriteClientInterface['put']>(),
        delete: mockFunction<clientUtils.HTTPWriteClientInterface['delete']>(),
        patch: mockFunction<clientUtils.HTTPWriteClientInterface['patch']>(),
      }

      type = new ObjectType({ elemID: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME) })
    })

    it('Should update the edited default value', async () => {
      const before = new InstanceElement('instance', type, {
        name: 'a',
        id: 3,
        options: {
          p1: {
            id: 1,
          },
          p2: {
            id: 2,
          },
        },
        defaultValue: {
          type: 'float',
          optionId: new ReferenceExpression(type.elemID.createNestedID('instance', 'instance', 'options', 'p1'), {}),
        },
      })

      const after = new InstanceElement(
        'instance',
        type,
        {
          name: 'a',
          id: 3,
          options: {
            p1: {
              id: 1,
            },
            p2: {
              id: 2,
            },
          },
          defaultValue: {
            type: 'float',
            optionId: new ReferenceExpression(type.elemID.createNestedID('instance', 'instance', 'options', 'p2'), {}),
          },
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [{ id: '2' }],
        },
      )

      await updateDefaultValues(toChange({ before, after }), client)

      expect(client.put).toHaveBeenCalledWith({
        url: '/rest/api/3/field/2/context/defaultValue',
        data: {
          defaultValues: [
            {
              contextId: 3,
              type: 'float',
              optionId: 2,
            },
          ],
        },
      })
    })

    it('Should remove the removed default value', async () => {
      const before = new InstanceElement('instance', type, {
        name: 'a',
        id: 3,
        defaultValue: {
          type: 'float',
          number: 9,
        },
      })

      const after = new InstanceElement(
        'instance',
        type,
        {
          name: 'a',
          id: 3,
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [{ id: '2' }],
        },
      )

      await updateDefaultValues(toChange({ before, after }), client)

      expect(client.put).toHaveBeenCalledWith({
        url: '/rest/api/3/field/2/context/defaultValue',
        data: {
          defaultValues: [
            {
              contextId: 3,
              type: 'float',
              number: null,
            },
          ],
        },
      })
    })

    it('if context were deleted should do nothing', async () => {
      const before = new InstanceElement('instance', type, {
        name: 'a',
        id: 3,
        defaultValue: {
          type: 'float',
          number: 9,
        },
      })
      await updateDefaultValues(toChange({ before }), client)
      expect(client.put).not.toHaveBeenCalled()
    })
  })

  describe('setDefaultValueTypeDeploymentAnnotations', () => {
    it('should throw an error if defaultValueType is not an objectType', async () => {
      const contextType = new ObjectType({ elemID: new ElemID(JIRA, 'CustomFieldContext') })
      await expect(setDefaultValueTypeDeploymentAnnotations(contextType)).rejects.toThrow()
    })
  })
})
