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
import { BuiltinTypes, ElemID, InstanceElement, MapType, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { setContextOptions, setOptionTypeDeploymentAnnotations } from '../../../src/filters/fields/context_options'
import { JIRA } from '../../../src/constants'

describe('context options', () => {
  describe('setContextOptions', () => {
    let client: MockInterface<clientUtils.HTTPWriteClientInterface>
    let parentField: InstanceElement
    let contextInstance: InstanceElement

    beforeEach(() => {
      client = {
        post: mockFunction<clientUtils.HTTPWriteClientInterface['post']>(),
        put: mockFunction<clientUtils.HTTPWriteClientInterface['put']>(),
        delete: mockFunction<clientUtils.HTTPWriteClientInterface['delete']>(),
        patch: mockFunction<clientUtils.HTTPWriteClientInterface['patch']>(),
      }

      parentField = new InstanceElement('parentField', new ObjectType({ elemID: new ElemID(JIRA, 'Field') }), { id: 2 })

      contextInstance = new InstanceElement('context', new ObjectType({ elemID: new ElemID(JIRA, 'CustomFieldContext') }), {
        id: 3,
        options: [
          {
            id: '10047',
            value: 'p1',
            disabled: false,
            position: 0,
          },
          {
            id: '10048',
            value: 'p2',
            disabled: false,
            position: 1,
          },
        ],
      })
    })

    it('if change is removal, should do nothing', async () => {
      await setContextOptions(toChange({ before: contextInstance }), parentField, client)
      expect(client.post).not.toHaveBeenCalled()
      expect(client.put).not.toHaveBeenCalled()
      expect(client.delete).not.toHaveBeenCalled()
    })

    describe('change is addition', () => {
      beforeEach(async () => {
        contextInstance.value.options = {
          p1: {
            value: 'p1',
            disabled: false,
            position: 0,
          },
        }
        client.post.mockResolvedValue({
          data: {
            options: [
              {
                id: '4',
                value: 'p1',
              },
            ],
          },
          status: 200,
        })
        await setContextOptions(
          toChange({ after: contextInstance }),
          parentField,
          client
        )
      })

      it('should call the add endpoint with all of the options', () => {
        expect(client.post).toHaveBeenCalledWith({
          url: '/rest/api/3/field/2/context/3/option',
          data: {
            options: [
              expect.objectContaining({
                value: 'p1',
                disabled: false,
              }),
            ],
          },
        })
        expect(contextInstance.value.options.p1.id).toEqual('4')
      })
    })

    it('when response is invalid should throw an error', async () => {
      client.post.mockResolvedValue({
        data: [],
        status: 200,
      })
      await expect(setContextOptions(
        toChange({ after: contextInstance }),
        parentField,
        client
      )).rejects.toThrow()
    })

    describe('options were changed', () => {
      let contextInstanceAfter: InstanceElement

      beforeEach(async () => {
        contextInstanceAfter = contextInstance.clone()
        contextInstanceAfter.value.options = {
          p2: {
            id: '10047',
            value: 'p2',
            disabled: true,
            position: 1,
          },
          c11: {
            value: 'c11',
            disabled: false,
            optionId: new ReferenceExpression(
              contextInstance.elemID.createNestedID('options', 'p2'),
              {
                id: '10047',
                value: 'p2',
                disabled: true,
                position: 1,
              }
            ),
            position: 1,
          },
          c12: {
            value: 'c12',
            disabled: false,
            optionId: new ReferenceExpression(
              contextInstance.elemID.createNestedID('options', 'p2'),
              {
                id: '10047',
                value: 'p2',
                disabled: true,
                position: 1,
              }
            ),
            position: 0,
          },
        }
        client.post.mockResolvedValue({
          data: {
            options: [
              {
                id: '4',
                value: 'c11',
                optionId: '10047',
              },
              {
                id: '5',
                value: 'c12',
                optionId: '10047',
              },
            ],
          },
          status: 200,
        })
        await setContextOptions(
          toChange({ before: contextInstance, after: contextInstanceAfter }),
          parentField,
          client
        )
      })

      it('should call the add endpoint with the added options', () => {
        expect(client.post).toHaveBeenCalledWith({
          url: '/rest/api/3/field/2/context/3/option',
          data: {
            options: [
              {
                value: 'c12',
                disabled: false,
                optionId: '10047',
              },
              {
                value: 'c11',
                disabled: false,
                optionId: '10047',
              },
            ],
          },
        })
        expect(contextInstanceAfter.value.options.c11.id).toEqual('4')
        expect(contextInstanceAfter.value.options.c12.id).toEqual('5')
      })

      it('should call the modify endpoint with the modified options', () => {
        expect(client.put).toHaveBeenCalledWith({
          url: '/rest/api/3/field/2/context/3/option',
          data: {
            options: [
              {
                id: '10047',
                value: 'p2',
                disabled: true,
              },
            ],
          },
        })
      })

      it('should call the delete endpoint with the removed options', () => {
        expect(client.delete).toHaveBeenCalledWith({
          url: '/rest/api/3/field/2/context/3/option/10048',
        })
      })

      it('should call the reorder endpoint with the after option ids', () => {
        expect(client.put).toHaveBeenCalledWith({
          url: '/rest/api/3/field/2/context/3/option/move',
          data: {
            customFieldOptionIds: [
              '10047',
            ],
            position: 'First',
          },
        })

        expect(client.put).toHaveBeenCalledWith({
          url: '/rest/api/3/field/2/context/3/option/move',
          data: {
            customFieldOptionIds: [
              '5',
              '4',
            ],
            position: 'First',
          },
        })
      })
    })
  })

  describe('setOptionTypeDeploymentAnnotations', () => {
    it('should throw an error if options is not a map type', async () => {
      const contextType = new ObjectType({
        elemID: new ElemID(JIRA, 'CustomFieldContext'),
        fields: {
          options: {
            refType: BuiltinTypes.STRING,
          },
        },
      })

      await expect(setOptionTypeDeploymentAnnotations(contextType)).rejects.toThrow()
    })

    it('should throw an error if options inner type is not an object type', async () => {
      const contextType = new ObjectType({
        elemID: new ElemID(JIRA, 'CustomFieldContext'),
        fields: {
          options: {
            refType: new MapType(BuiltinTypes.STRING),
          },
        },
      })

      await expect(setOptionTypeDeploymentAnnotations(contextType)).rejects.toThrow()
    })

    it('should not throw an error for a valid type', async () => {
      const optionType = new ObjectType({
        elemID: new ElemID(JIRA, 'CustomFieldContextOption'),
        fields: {
          someValue: { refType: BuiltinTypes.STRING },
        },
      })
      const contextType = new ObjectType({
        elemID: new ElemID(JIRA, 'CustomFieldContext'),
        fields: {
          options: {
            refType: new MapType(optionType),
          },
        },
      })

      await setOptionTypeDeploymentAnnotations(contextType)
    })
  })
})
