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
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  MapType,
  ObjectType,
  ReadOnlyElementsSource,
  ReferenceExpression,
  toChange,
  Values,
} from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { setContextOptions, setOptionTypeDeploymentAnnotations } from '../../../src/filters/fields/context_options'
import { JIRA } from '../../../src/constants'
import JiraClient from '../../../src/client/client'
import { mockClient } from '../../utils'
import { JSP_API_HEADERS } from '../../../src/client/headers'

describe('context options', () => {
  let client: JiraClient
  let connection: MockInterface<clientUtils.APIConnection>
  let parentField: InstanceElement
  let contextInstance: InstanceElement
  let elementSource: ReadOnlyElementsSource
  let paginator: clientUtils.Paginator

  const generateOptions = (count: number): Values =>
    Array.from({ length: count }, (_, i) => ({
      [`p${i}`]: {
        value: `p${i}`,
        disabled: false,
        position: i,
      },
    })).reduce((acc, option) => ({ ...acc, ...option }), {})

  const generateOptionsWithId = (count: number): Values => {
    const options: { [key: string]: { value: string; disabled: boolean; position: number; id: string } } = {}
    Array.from({ length: count }, (_, i) => i).forEach(i => {
      const key = `p${i}`
      options[key] = {
        value: key,
        disabled: false,
        position: i,
        id: `100${i}`,
      }
    })
    return options
  }

  describe('data center', () => {
    describe('setContextOptions', () => {
      beforeEach(() => {
        const { client: cli, connection: conn } = mockClient(true)
        connection = conn
        client = cli
        parentField = new InstanceElement('parentField', new ObjectType({ elemID: new ElemID(JIRA, 'Field') }), {
          id: 2,
        })
        contextInstance = new InstanceElement(
          'context',
          new ObjectType({ elemID: new ElemID(JIRA, 'CustomFieldContext') }),
          {
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
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentField.elemID, parentField)],
          },
        )
        const sourceParentField = parentField.clone()
        delete sourceParentField.value.id
        elementSource = buildElementsSourceFromElements([sourceParentField])
      })
      describe('over 1000 options were changed', () => {
        let contextInstanceAfter: InstanceElement
        let contextInstanceBefore: InstanceElement
        beforeEach(async () => {
          contextInstanceAfter = contextInstance.clone()
          contextInstanceBefore = contextInstance.clone()
          const largeOptionsObject = generateOptions(1001)
          contextInstanceAfter.value.options = largeOptionsObject
          contextInstanceBefore.value.options = Object.fromEntries(
            Object.entries(largeOptionsObject).map(([key, option]) => [key, { ...option, disabled: true }]),
          )
          connection.post.mockResolvedValue({
            data: {
              options: [],
            },
            status: 200,
          })
          await setContextOptions(
            toChange({ before: contextInstanceBefore, after: contextInstanceAfter }),
            client,
            elementSource,
          )
        })
        it('should not batch on reorder but batch modifications', () => {
          expect(connection.put).toHaveBeenCalledTimes(3)
          expect(connection.put).toHaveBeenNthCalledWith(
            2,
            '/rest/salto/1.0/field/2/context/3/option',
            {
              options: [
                expect.objectContaining({
                  disabled: false,
                  value: 'p1000',
                }),
              ],
            },
            undefined,
          )
          expect(connection.put).toHaveBeenNthCalledWith(
            3,
            '/rest/salto/1.0/field/2/context/3/option/move',
            {
              customFieldOptionIds: expect.toBeArrayOfSize(1001),
              position: 'First',
            },
            undefined,
          )
        })
      })
      describe('change has over 1000 additions', () => {
        beforeEach(async () => {
          const largeOptionsObject = generateOptions(1001)
          contextInstance.value.options = largeOptionsObject
          connection.post.mockImplementation(async (_, data) => {
            const { options } = data as { options: unknown[] }
            if (options.length > 1000) {
              throw Error('bad')
            }
            return {
              data: {
                options: [
                  {
                    id: '4',
                    value: 'p1',
                  },
                ],
              },
              status: 200,
            }
          })
          await setContextOptions(toChange({ after: contextInstance }), client, elementSource)
        })
        it('should not batch on reorder', () => {
          expect(connection.put).toHaveBeenCalledTimes(1)
          expect(connection.put).toHaveBeenNthCalledWith(
            1,
            '/rest/salto/1.0/field/2/context/3/option/move',
            {
              customFieldOptionIds: expect.toBeArrayOfSize(1001),
              position: 'First',
            },
            undefined,
          )
        })
        it('should call post with 1000 or less batches', () => {
          expect(connection.post).toHaveBeenCalledTimes(2)
          expect(connection.post).toHaveBeenNthCalledWith(
            2,
            '/rest/salto/1.0/field/2/context/3/option',
            {
              options: [
                expect.objectContaining({
                  value: 'p1000',
                  disabled: false,
                }),
              ],
            },
            undefined,
          )
          expect(contextInstance.value.options.p1.id).toEqual('4')
        })
      })
    })
  })
  describe('setContextOptions', () => {
    beforeEach(() => {
      const { client: cli, connection: conn } = mockClient()
      connection = conn
      client = cli

      parentField = new InstanceElement('parentField', new ObjectType({ elemID: new ElemID(JIRA, 'Field') }), { id: 2 })

      contextInstance = new InstanceElement(
        'context',
        new ObjectType({ elemID: new ElemID(JIRA, 'CustomFieldContext') }),
        {
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
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentField.elemID, parentField)],
        },
      )

      const sourceParentField = parentField.clone()
      delete sourceParentField.value.id
      elementSource = buildElementsSourceFromElements([sourceParentField])
    })

    it('if change is removal, should do nothing', async () => {
      await setContextOptions(toChange({ before: contextInstance }), client, elementSource)
      expect(connection.post).not.toHaveBeenCalled()
      expect(connection.put).not.toHaveBeenCalled()
      expect(connection.delete).not.toHaveBeenCalled()
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
        connection.post.mockResolvedValue({
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
        await setContextOptions(toChange({ after: contextInstance }), client, elementSource)
      })

      it('should call the add endpoint with all of the options', () => {
        expect(connection.post).toHaveBeenCalledWith(
          '/rest/api/3/field/2/context/3/option',
          {
            options: [
              expect.objectContaining({
                value: 'p1',
                disabled: false,
              }),
            ],
          },
          undefined,
        )
        expect(contextInstance.value.options.p1.id).toEqual('4')
      })
    })

    describe('change has over 1000 additions', () => {
      beforeEach(async () => {
        const largeOptionsObject = generateOptions(1001)
        contextInstance.value.options = largeOptionsObject
        connection.post.mockImplementation(async (_, data) => {
          const { options } = data as { options: unknown[] }
          if (options.length > 1000) {
            throw Error('bad')
          }
          return {
            data: {
              options: [
                {
                  id: '4',
                  value: 'p1',
                },
              ],
            },
            status: 200,
          }
        })
        await setContextOptions(toChange({ after: contextInstance }), client, elementSource)
      })

      it('should call post with 1000 or less batches', () => {
        expect(connection.post).toHaveBeenCalledTimes(2)
        expect(connection.post).toHaveBeenNthCalledWith(
          2,
          '/rest/api/3/field/2/context/3/option',
          {
            options: [
              expect.objectContaining({
                value: 'p1000',
                disabled: false,
              }),
            ],
          },
          undefined,
        )
        expect(contextInstance.value.options.p1.id).toEqual('4')
      })
    })

    it('when response is invalid should throw an error', async () => {
      connection.post.mockResolvedValue({
        data: [],
        status: 200,
      })
      await expect(setContextOptions(toChange({ after: contextInstance }), client, elementSource)).rejects.toThrow()
    })

    it('when option name and value are different deploy successfully', async () => {
      contextInstance.value.options = {
        p1: {
          value: 'p2',
          disabled: false,
          position: 0,
        },
      }
      connection.post.mockResolvedValue({
        data: {
          options: [
            {
              id: '10',
              value: 'p2',
            },
          ],
        },
        status: 200,
      })
      await setContextOptions(toChange({ after: contextInstance }), client, elementSource)
      expect(connection.post).toHaveBeenCalledWith(
        '/rest/api/3/field/2/context/3/option',
        {
          options: [
            expect.objectContaining({
              value: 'p2',
              disabled: false,
            }),
          ],
        },
        undefined,
      )
      expect(contextInstance.value.options.p1.id).toEqual('10')
    })

    it('when option name and value are crossed deploy successfully', async () => {
      contextInstance.value.options = {
        p1: {
          value: 'p2',
          disabled: false,
          position: 0,
        },
        p2: {
          value: 'p1',
          disabled: false,
          position: 0,
        },
      }
      connection.post.mockResolvedValue({
        data: {
          options: [
            {
              id: '10',
              value: 'p2',
            },
            {
              id: '20',
              value: 'p1',
            },
          ],
        },
        status: 200,
      })
      await setContextOptions(toChange({ after: contextInstance }), client, elementSource)
      expect(connection.post).toHaveBeenCalledWith(
        '/rest/api/3/field/2/context/3/option',
        {
          options: [
            expect.objectContaining({
              value: 'p2',
              disabled: false,
            }),
            expect.objectContaining({
              value: 'p1',
              disabled: false,
            }),
          ],
        },
        undefined,
      )
      expect(contextInstance.value.options.p1.id).toEqual('10')
      expect(contextInstance.value.options.p2.id).toEqual('20')
    })
    describe('over 1000 options were changed', () => {
      let contextInstanceAfter: InstanceElement
      let contextInstanceBefore: InstanceElement

      beforeEach(async () => {
        contextInstanceAfter = contextInstance.clone()
        contextInstanceBefore = contextInstance.clone()
        const largeOptionsObject = generateOptions(1001)
        contextInstanceAfter.value.options = largeOptionsObject
        contextInstanceBefore.value.options = Object.fromEntries(
          Object.entries(largeOptionsObject).map(([key, option]) => [key, { ...option, disabled: true }]),
        )
        connection.put.mockImplementation(async (_, data) => {
          const { customFieldOptionIds, options } = data as { customFieldOptionIds: unknown[]; options: unknown[] }
          if (customFieldOptionIds?.length > 1000 || options?.length > 1000) {
            throw Error('bad')
          }
          return {
            data: {
              options: [],
            },
            status: 200,
          }
        })
        await setContextOptions(
          toChange({ before: contextInstanceBefore, after: contextInstanceAfter }),
          client,
          elementSource,
        )
      })

      it('should call put with only 1000 or less batches', () => {
        expect(connection.put).toHaveBeenCalledTimes(4)
        expect(connection.put).toHaveBeenNthCalledWith(
          2,
          '/rest/api/3/field/2/context/3/option',
          {
            options: [
              expect.objectContaining({
                disabled: false,
                value: 'p1000',
              }),
            ],
          },
          undefined,
        )
        // check reorder is also using up to 1000 options at a time.
        expect(connection.put).toHaveBeenNthCalledWith(
          4,
          '/rest/api/3/field/2/context/3/option/move',
          {
            customFieldOptionIds: [undefined],
            position: 'Last',
          },
          undefined,
        )
      })
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
            cascadingOptions: {
              c11: {
                value: 'c11',
                disabled: false,
                position: 1,
              },
              c12: {
                value: 'c12',
                disabled: false,
                position: 0,
              },
            },
          },
        }
        connection.post.mockResolvedValue({
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
          client,
          elementSource,
        )
      })

      it('should call the add endpoint with the added options', () => {
        expect(connection.post).toHaveBeenCalledWith(
          '/rest/api/3/field/2/context/3/option',
          {
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
          undefined,
        )
        expect(contextInstanceAfter.value.options.p2.cascadingOptions.c11.id).toEqual('4')
        expect(contextInstanceAfter.value.options.p2.cascadingOptions.c12.id).toEqual('5')
      })

      it('should call the modify endpoint with the modified options', () => {
        expect(connection.put).toHaveBeenCalledWith(
          '/rest/api/3/field/2/context/3/option',
          {
            options: [
              {
                id: '10047',
                value: 'p2',
                disabled: true,
              },
            ],
          },
          undefined,
        )
      })

      it('should call the delete endpoint with the removed options', () => {
        expect(connection.delete).toHaveBeenCalledWith('/rest/api/3/field/2/context/3/option/10048', undefined)
      })

      it('should call the reorder endpoint with the after option ids', () => {
        expect(connection.put).toHaveBeenCalledWith(
          '/rest/api/3/field/2/context/3/option/move',
          {
            customFieldOptionIds: ['10047'],
            position: 'First',
          },
          undefined,
        )

        expect(connection.put).toHaveBeenCalledWith(
          '/rest/api/3/field/2/context/3/option/move',
          {
            customFieldOptionIds: ['5', '4'],
            position: 'First',
          },
          undefined,
        )
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
  describe('more than 10K', () => {
    describe('setContextOptions', () => {
      beforeEach(() => {
        const { client: cli, connection: conn, paginator: pgi } = mockClient(true)
        connection = conn
        client = cli
        paginator = pgi
        parentField = new InstanceElement('parentField', new ObjectType({ elemID: new ElemID(JIRA, 'Field') }), {
          id: 2,
        })
        contextInstance = new InstanceElement(
          'context',
          new ObjectType({ elemID: new ElemID(JIRA, 'CustomFieldContext') }),
          {
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
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentField.elemID, parentField)],
          },
        )
        const sourceParentField = parentField.clone()
        delete sourceParentField.value.id
        elementSource = buildElementsSourceFromElements([sourceParentField])
      })
      describe('change has over 10K options', () => {
        // Set long timeout as we create instance with more than 10K options
        jest.setTimeout(1000 * 60 * 1)
        let contextInstanceAfter: InstanceElement
        let contextInstanceBefore: InstanceElement
        const tenKOptions = generateOptionsWithId(10010)

        beforeEach(async () => {
          connection.post.mockImplementation(async (url, data) => {
            if (url === '/secure/admin/EditCustomFieldOptions!add.jspa') {
              return {
                data: {},
                status: 200,
              }
            }

            const { options } = data as { options: unknown[] }
            if (options.length > 1000) {
              throw Error('bad')
            }
            return {
              data: {
                options: [],
              },
              status: 200,
            }
          })
          connection.get.mockResolvedValueOnce({
            status: 200,
            data: {
              startAt: 0,
              total: 1,
              values: [
                {
                  id: '10010000',
                  value: 'p10000',
                  disabled: false,
                },
              ],
            },
          })
          connection.get.mockResolvedValueOnce({
            status: 200,
            data: {
              startAt: 0,
              total: 1,
              values: [
                {
                  id: '10010000',
                  value: 'p10000',
                  disabled: false,
                },
                {
                  id: '1001000011',
                  value: 'c11',
                  disabled: false,
                  optionId: '10010000',
                },
              ],
            },
          })
        })
        it('should use public API for first 10K options, and than use private API for all other options.', async () => {
          const optionsAfter = tenKOptions
          contextInstanceAfter = contextInstance.clone()
          contextInstanceAfter.value.options = optionsAfter
          await setContextOptions(toChange({ after: contextInstanceAfter }), client, elementSource)
          expect(connection.post).toHaveBeenCalledTimes(20)
          expect(connection.post).toHaveBeenNthCalledWith(
            11,
            '/secure/admin/EditCustomFieldOptions!add.jspa',
            new URLSearchParams({ addValue: 'p10000', fieldConfigId: contextInstanceAfter.value.id }),
            {
              headers: JSP_API_HEADERS,
              params: undefined,
              responseType: undefined,
            },
          )
        })
        it('should use only private API if all added options are over 10K', async () => {
          const optionsBefore = tenKOptions
          contextInstanceBefore = contextInstance.clone()
          contextInstanceBefore.value.options = optionsBefore
          contextInstanceAfter = contextInstanceBefore.clone()
          contextInstanceAfter.value.options.p10010 = {
            value: 'p10010',
            disabled: false,
            position: 10010,
          }
          await setContextOptions(
            toChange({ before: contextInstanceBefore, after: contextInstanceAfter }),
            client,
            elementSource,
          )
          expect(connection.post).toHaveBeenCalledTimes(1)
          expect(connection.post).toHaveBeenNthCalledWith(
            1,
            '/secure/admin/EditCustomFieldOptions!add.jspa',
            new URLSearchParams({ addValue: 'p10010', fieldConfigId: contextInstanceAfter.value.id }),
            {
              headers: JSP_API_HEADERS,
              params: undefined,
              responseType: undefined,
            },
          )
        })
        it('should add cascading options through private API', async () => {
          const optionsBefore = tenKOptions
          contextInstanceBefore = contextInstance.clone()
          contextInstanceBefore.value.options = optionsBefore
          contextInstanceAfter = contextInstanceBefore.clone()
          contextInstanceAfter.value.options.p10000 = {
            value: 'p10000',
            disabled: false,
            cascadingOptions: {
              c11: {
                value: 'c11',
                disabled: false,
                position: 0,
              },
            },
            position: 10000,
          }
          await setContextOptions(
            toChange({ before: contextInstanceBefore, after: contextInstanceAfter }),
            client,
            elementSource,
            paginator,
          )
          expect(connection.post).toHaveBeenCalledTimes(2)
          expect(connection.post).toHaveBeenNthCalledWith(
            2,
            '/secure/admin/EditCustomFieldOptions!add.jspa',
            new URLSearchParams({
              addValue: 'c11',
              fieldConfigId: contextInstanceAfter.value.id,
              selectedParentOptionId: '10010000',
            }),
            {
              headers: JSP_API_HEADERS,
              params: undefined,
              responseType: undefined,
            },
          )
        })
      })
    })
  })
})
