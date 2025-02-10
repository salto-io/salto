/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { definitions } from '@salto-io/adapter-components'
import { inspectValue } from '@salto-io/adapter-utils'
import { BOT_BUILDER_ANSWER, BOT_BUILDER_NODE, CONVERSATION_BOT, ZENDESK } from '../../../../src/constants'
import {
  transformRequest,
  transformResponse,
} from '../../../../src/definitions/deploy/transforms/bot_builder_node_adjuster'

describe('bot_builder_node_adjuster', () => {
  const botType = new ObjectType({ elemID: new ElemID(ZENDESK, CONVERSATION_BOT) })
  const answerType = new ObjectType({ elemID: new ElemID(ZENDESK, BOT_BUILDER_ANSWER) })
  const nodeType = new ObjectType({ elemID: new ElemID(ZENDESK, BOT_BUILDER_NODE) })
  const botInstance = new InstanceElement('bot', botType, { id: '1' })
  const answerInstance = new InstanceElement(
    'answer',
    answerType,
    {
      id: '2',
      flowId: new ReferenceExpression(botInstance.elemID, botInstance),
    },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [botInstance.value] },
  )
  const nodeInstance = new InstanceElement(
    'node',
    nodeType,
    {
      id: '3',
      externalId: '3',
      data: { for: 'event' },
    },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [answerInstance.value] }, // The parent is resolved
  )
  describe('transformRequest', () => {
    it('should create the correct bot builder node request for type Added', async () => {
      const finalValue = await transformRequest('Added')({
        value: nodeInstance.value,
        typeName: 'test',
        context: {
          change: toChange({ after: nodeInstance }),
        } as unknown as definitions.deploy.ChangeAndExtendedContext,
      })
      expect(finalValue).toEqual(
        expect.objectContaining({
          value: {
            query: expect.any(String),
            operationName: 'applyNodeListTransactionByFlowId',
            variables: {
              flowId: botInstance.value.id,
              subFlowId: answerInstance.value.id,
              transactionId: expect.stringMatching(/^[0-9A-Z]{26}$/), // Generated ksuid,
              events: [
                {
                  eventType: 'Added',
                  id: expect.stringMatching(/^[0-9A-Z]{26}$/), // Generated ksuid
                  externalId: nodeInstance.value.externalId,
                  from: null,
                  to: { data: { for: 'event' } },
                },
              ],
            },
          },
        }),
      )
    })
    it('should create the correct bot builder node request for type Changed', async () => {
      const finalValue = await transformRequest('Changed')({
        value: nodeInstance.value,
        typeName: 'test',
        context: {
          change: toChange({ after: nodeInstance }),
        } as unknown as definitions.deploy.ChangeAndExtendedContext,
      })
      expect(finalValue).toEqual(
        expect.objectContaining({
          value: {
            query: expect.any(String),
            operationName: 'applyNodeListTransactionByFlowId',
            variables: {
              flowId: botInstance.value.id,
              subFlowId: answerInstance.value.id,
              transactionId: nodeInstance.value.id,
              events: [
                {
                  eventType: 'Changed',
                  id: nodeInstance.value.id,
                  externalId: nodeInstance.value.externalId,
                  from: null,
                  to: { data: { for: 'event' } },
                },
              ],
            },
          },
        }),
      )
    })

    it('should create the correct bot builder node request for type Deleted', async () => {
      const finalValue = await transformRequest('Deleted')({
        value: nodeInstance.value,
        typeName: 'test',
        context: {
          change: toChange({ before: nodeInstance }),
        } as unknown as definitions.deploy.ChangeAndExtendedContext,
      })
      expect(finalValue).toEqual(
        expect.objectContaining({
          value: {
            query: expect.any(String),
            operationName: 'applyNodeListTransactionByFlowId',
            variables: {
              flowId: botInstance.value.id,
              subFlowId: answerInstance.value.id,
              transactionId: nodeInstance.value.id,
              events: [{ eventType: 'Deleted', id: nodeInstance.value.id, from: { data: { for: 'event' } }, to: null }],
            },
          },
        }),
      )
    })

    it.each(['Deleted', 'Changed'])('should throw an error if the id is missing on action %s', async actionStr => {
      const action = actionStr as 'Changed' | 'Deleted'
      const nodeInstanceWithoutId = nodeInstance.clone()
      nodeInstanceWithoutId.value.id = undefined
      await expect(
        transformRequest(action)({
          value: nodeInstanceWithoutId.value,
          typeName: 'test',
          context: {
            change: toChange({ after: nodeInstanceWithoutId }),
          } as unknown as definitions.deploy.ChangeAndExtendedContext,
        }),
      ).rejects.toThrow(
        /Missing required fields for conversation bot node item.\n\s+Received subFlowId: 2, flowId: 1 and node id: undefined/,
      )
    })

    it('should throw an error if the parent is missing', async () => {
      const nodeInstanceWithoutParent = nodeInstance.clone()
      nodeInstanceWithoutParent.annotations = {}
      await expect(
        transformRequest('Added')({
          value: nodeInstanceWithoutParent.value,
          typeName: 'test',
          context: {
            change: toChange({ after: nodeInstanceWithoutParent }),
          } as unknown as definitions.deploy.ChangeAndExtendedContext,
        }),
      ).rejects.toThrow('Missing required fields for conversation bot node item.')
    })

    it('should throw an error if the parent is missing an id', async () => {
      const nodeInstanceWithInvalidParent = nodeInstance.clone()
      nodeInstanceWithInvalidParent.annotations[CORE_ANNOTATIONS.PARENT] = [{}]
      await expect(
        transformRequest('Added')({
          value: nodeInstanceWithInvalidParent.value,
          typeName: 'test',
          context: {
            change: toChange({ after: nodeInstanceWithInvalidParent }),
          } as unknown as definitions.deploy.ChangeAndExtendedContext,
        }),
      ).rejects.toThrow(/Missing required fields for conversation bot node item.\n\s+Received subFlowId: undefined/)
    })

    it('should throw an error if the parent is missing a flowId', async () => {
      const answerInstanceWithoutFlowId = answerInstance.clone()
      answerInstanceWithoutFlowId.value.flowId = undefined
      const nodeInstanceWithInvalidParent = nodeInstance.clone()
      nodeInstanceWithInvalidParent.annotations[CORE_ANNOTATIONS.PARENT] = [answerInstanceWithoutFlowId.value]
      await expect(
        transformRequest('Added')({
          value: nodeInstanceWithInvalidParent.value,
          typeName: 'test',
          context: {
            change: toChange({ after: nodeInstanceWithInvalidParent }),
          } as unknown as definitions.deploy.ChangeAndExtendedContext,
        }),
      ).rejects.toThrow(
        /Missing required fields for conversation bot node item.\n\s+Received subFlowId: 2, flowId: undefined/,
      )
    })
  })

  describe('transformResponse', () => {
    it('should extract the correct node from the response', async () => {
      const response = await transformResponse()({
        value: {
          data: {
            applyNodeListTransactionByFlowId: [
              { id: '3', externalId: '3', data: { for: 'event' } },
              { id: '4', externalId: '4', some: { other: 'event' } },
            ],
          },
        },
        typeName: 'test',
        context: {
          change: toChange({ after: nodeInstance }),
        } as unknown as definitions.deploy.ChangeAndExtendedContext,
      })
      expect(response).toEqual({ value: { id: '3' } })
    })

    it('should throw an error if the response is missing the node id', async () => {
      const value = { data: { applyNodeListTransactionByFlowId: [{ externalId: '3', data: { for: 'event' } }] } }
      await expect(
        transformResponse()({
          value,
          typeName: 'test',
          context: { change: toChange({ after: nodeInstance }) } as definitions.deploy.ChangeAndExtendedContext,
        }),
      ).rejects.toThrow('unexpected value without id for graphql item')
    })

    it('should throw an error if the response contains errors', async () => {
      const value = { errors: 'error' }
      await expect(
        transformResponse()({
          value,
          typeName: 'test',
          context: {} as definitions.deploy.ChangeAndExtendedContext,
        }),
      ).rejects.toThrow(`graphql response contained errors: ${inspectValue(value)}`)
    })

    it('should throw an error if the response is missing the node by externalId', async () => {
      const value = { data: { applyNodeListTransactionByFlowId: [{ externalId: '4', data: { for: 'event' } }] } }
      await expect(
        transformResponse()({
          value,
          typeName: 'test',
          context: { change: toChange({ after: nodeInstance }) } as definitions.deploy.ChangeAndExtendedContext,
        }),
      ).rejects.toThrow('Failed to find node with externalId 3')
    })

    describe('when the node is deleted', () => {
      it('should not throw an error if the node is not found', async () => {
        const value = { data: { applyNodeListTransactionByFlowId: [{ id: '4', data: { for: 'event' } }] } }
        const response = await transformResponse(true)({
          value,
          typeName: 'test',
          context: { change: toChange({ after: nodeInstance }) } as definitions.deploy.ChangeAndExtendedContext,
        })
        expect(response).toEqual({ value: { externalId: '3' } })
      })

      it('should not throw an error if there is an unauthorized error', async () => {
        const value = { errors: [{ message: 'NODE_ACCESS_NOT_AUTHORISED' }] }
        const response = await transformResponse(true)({
          value,
          typeName: 'test',
          context: { change: toChange({ after: nodeInstance }) } as definitions.deploy.ChangeAndExtendedContext,
        })
        expect(response).toEqual({ value: { id: '3' } })
      })

      it('should throw an error if the error is not an unauthorized error', async () => {
        const value = { errors: [{ message: 'SOME_OTHER_ERROR' }] }
        await expect(
          transformResponse(true)({
            value,
            typeName: 'test',
            context: { change: toChange({ after: nodeInstance }) } as definitions.deploy.ChangeAndExtendedContext,
          }),
        ).rejects.toThrow("graphql response contained errors: { errors: [ { message: 'SOME_OTHER_ERROR' } ] }")
      })
    })
  })
})
