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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { setDefaultValueTypeDeploymentAnnotations, updateDefaultValues } from '../../../src/filters/fields/default_values'
import { JIRA } from '../../../src/constants'

describe('default values', () => {
  describe('updateDefaultValues', () => {
    let client: MockInterface<clientUtils.HTTPWriteClientInterface>
    let field: InstanceElement

    beforeEach(() => {
      client = {
        post: mockFunction<clientUtils.HTTPWriteClientInterface['post']>(),
        put: mockFunction<clientUtils.HTTPWriteClientInterface['put']>(),
        delete: mockFunction<clientUtils.HTTPWriteClientInterface['delete']>(),
        patch: mockFunction<clientUtils.HTTPWriteClientInterface['patch']>(),
      }

      field = new InstanceElement('Field', new ObjectType({ elemID: new ElemID(JIRA, 'Field') }), {
        id: 2,
        contexts: {
          a: {
            name: 'a',
            id: 3,
            defaultValue: {
              type: 'float',
              number: 9,
            },
          },
          b: {
            name: 'b',
            id: 4,
            defaultValue: {
              type: 'float',
              number: 10,
            },
          },
        },
      })
    })

    describe('default values were changed', () => {
      let fieldAfter: InstanceElement

      beforeEach(async () => {
        fieldAfter = field.clone()
        fieldAfter.value.contexts = {
          a: {
            name: 'a',
            id: 3,
          },
          b: {
            name: 'b',
            id: 4,
            defaultValue: {
              type: 'float',
              number: 11,
            },
          },
          c: {
            name: 'c',
            id: 5,
            defaultValue: {
              type: 'float',
              number: 12,
            },
          },
        }
        await updateDefaultValues(
          toChange({ before: field, after: fieldAfter }),
          client,
        )
      })

      it('should call the update the endpoint with the current state of default values', () => {
        expect(client.put).toHaveBeenCalledWith({
          url: '/rest/api/3/field/2/context/defaultValue',
          data: {
            defaultValues: [
              {
                contextId: 4,
                type: 'float',
                number: 11,
              },
              {
                contextId: 5,
                type: 'float',
                number: 12,
              },
              {
                contextId: 3,
                type: 'float',
                number: null,
              },
            ],
          },
        })
      })
    })

    it('should do nothing when there are no context', async () => {
      delete field.value.contexts
      await updateDefaultValues(
        toChange({ after: field }),
        client,
      )
      expect(client.put).not.toHaveBeenCalled()
    })

    it('if context were deleted should do nothing', async () => {
      const fieldAfter = field.clone()
      delete fieldAfter.value.contexts
      await updateDefaultValues(
        toChange({ before: field, after: fieldAfter }),
        client,
      )
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
