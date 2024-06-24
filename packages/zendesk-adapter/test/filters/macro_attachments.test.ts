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
import FormData from 'form-data'
import {
  ObjectType,
  ElemID,
  InstanceElement,
  isInstanceElement,
  StaticFile,
  CORE_ANNOTATIONS,
  ReferenceExpression,
  ListType,
  BuiltinTypes,
  getChangeData,
  ModificationChange,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { createFilterCreatorParams } from '../utils'
import ZendeskClient from '../../src/client/client'
import { ZENDESK, MACRO_TYPE_NAME } from '../../src/constants'
import filterCreator, { ATTACHMENTS_FIELD_NAME, MACRO_ATTACHMENT_TYPE_NAME } from '../../src/filters/macro_attachments'

const mockDeployChange = jest.fn()
jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      deployChange: jest.fn((...args) => mockDeployChange(...args)),
    },
  }
})

describe('macro attachment filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'deploy' | 'onFetch'>
  let filter: FilterType
  let mockGet: jest.SpyInstance
  let mockPost: jest.SpyInstance
  const macroType = new ObjectType({
    elemID: new ElemID(ZENDESK, MACRO_TYPE_NAME),
    fields: {
      [ATTACHMENTS_FIELD_NAME]: { refType: new ListType(BuiltinTypes.NUMBER) },
    },
  })
  const macroId = 11
  const attachmentId = 111
  const attachmentType = new ObjectType({
    elemID: new ElemID(ZENDESK, MACRO_ATTACHMENT_TYPE_NAME),
  })
  const filename = 'test.txt'
  const content = Buffer.from('test')
  beforeEach(async () => {
    jest.clearAllMocks()
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    filter = filterCreator(createFilterCreatorParams({ client })) as FilterType
  })

  describe('onFetch', () => {
    let macroInstance: InstanceElement
    beforeEach(() => {
      macroInstance = new InstanceElement('macro', macroType, {
        id: macroId,
        title: 'test',
        active: true,
        actions: [
          {
            field: 'status',
            value: 'open',
          },
        ],
        [ATTACHMENTS_FIELD_NAME]: [attachmentId],
      })
    })
    it('should create macro attachment instances', async () => {
      mockGet = jest.spyOn(client, 'get')
      mockGet.mockImplementation(params => {
        if (params.url === `/api/v2/macros/${macroInstance.value.id}/attachments`) {
          return {
            status: 200,
            data: {
              macro_attachments: [
                {
                  id: attachmentId,
                  filename,
                  content_type: 'text/plain',
                  content_url: `https://myBrand.zendesk.com/api/v2/macros/attachments/${attachmentId}/content`,
                },
              ],
            },
          }
        }
        if (params.url === `/api/v2/macros/attachments/${attachmentId}/content`) {
          return {
            status: 200,
            data: content,
          }
        }
        throw new Error('Err')
      })
      const elements = [macroType, macroInstance].map(e => e.clone())
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
        'zendesk.macro',
        'zendesk.macro.instance.macro',
        'zendesk.macro_attachment',
        'zendesk.macro_attachment.instance.test__test_txt@uuv',
      ])
      const instances = elements.filter(isInstanceElement)
      const macro = instances.find(e => e.elemID.typeName === MACRO_TYPE_NAME)
      expect(macro?.value).toEqual(macroInstance.value)
      const attachment = instances.find(e => e.elemID.typeName === MACRO_ATTACHMENT_TYPE_NAME)
      expect(attachment?.value).toEqual({
        id: attachmentId,
        filename,
        contentType: 'text/plain',
        content: new StaticFile({
          filepath: 'zendesk/macro_attachment/test__test.txt',
          encoding: 'binary',
          content,
        }),
      })
    })
    describe('invalid attachments response', () => {
      it('should return no attachments if response is an array', async () => {
        mockGet = jest.spyOn(client, 'get')
        mockGet.mockImplementation(params => {
          if (params.url === `/api/v2/macros/${macroInstance.value.id}/attachments`) {
            return {
              status: 200,
              data: [
                {
                  macro_attachments: [
                    {
                      id: attachmentId,
                      filename,
                      content_type: 'text/plain',
                      content_url: `https://myBrand.zendesk.com/api/v2/macros/attachments/${attachmentId}/content`,
                    },
                  ],
                },
              ],
            }
          }
          if (params.url === `/api/v2/macros/attachments/${attachmentId}/content`) {
            return {
              status: 200,
              data: content,
            }
          }
          throw new Error('Err')
        })
        const elements = [macroType, macroInstance].map(e => e.clone())
        await filter.onFetch(elements)
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
          'zendesk.macro',
          'zendesk.macro.instance.macro',
          'zendesk.macro_attachment',
        ])
      })
      it('should return no attachments if attachment response is in invalid format', async () => {
        mockGet = jest.spyOn(client, 'get')
        mockGet.mockImplementation(params => {
          if (params.url === `/api/v2/macros/${macroInstance.value.id}/attachments`) {
            return {
              status: 200,
              data: {
                macro_attachments: [
                  {
                    id: attachmentId,
                    filename,
                    content_url: `https://myBrand.zendesk.com/api/v2/macros/attachments/${attachmentId}/content`,
                  },
                ],
              },
            }
          }
          if (params.url === `/api/v2/macros/attachments/${attachmentId}/content`) {
            return {
              status: 200,
              data: content,
            }
          }
          throw new Error('Err')
        })
        const elements = [macroType, macroInstance].map(e => e.clone())
        await filter.onFetch(elements)
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
          'zendesk.macro',
          'zendesk.macro.instance.macro',
          'zendesk.macro_attachment',
        ])
      })
      it('should not return attachment if its content is invalid', async () => {
        mockGet = jest.spyOn(client, 'get')
        mockGet.mockImplementation(params => {
          if (params.url === `/api/v2/macros/${macroInstance.value.id}/attachments`) {
            return {
              status: 200,
              data: {
                macro_attachments: [
                  {
                    id: attachmentId,
                    filename,
                    content_type: 'text/plain',
                    content_url: `https://myBrand.zendesk.com/api/v2/macros/attachments/${attachmentId}/content`,
                  },
                ],
              },
            }
          }
          if (params.url === `/api/v2/macros/attachments/${attachmentId}/content`) {
            return {
              status: 200,
              data: 123456,
            }
          }
          throw new Error('Err')
        })
        const elements = [macroType, macroInstance].map(e => e.clone())
        await filter.onFetch(elements)
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
          'zendesk.macro',
          'zendesk.macro.instance.macro',
          'zendesk.macro_attachment',
          'zendesk.macro_attachment.instance.test__test_txt@uuv',
        ])
        const attachmentInst = elements
          .filter(isInstanceElement)
          .find(e => e.elemID.getFullName() === 'zendesk.macro_attachment.instance.test__test_txt@uuv')
        expect(attachmentInst?.value.content).not.toBeDefined()
      })
      it('should return attachment without content if response with invalid status', async () => {
        mockGet = jest.spyOn(client, 'get')
        mockGet.mockImplementation(params => {
          if (params.url === `/api/v2/macros/${macroInstance.value.id}/attachments`) {
            return {
              status: 200,
              data: {
                macro_attachments: [
                  {
                    id: attachmentId,
                    filename,
                    content_type: 'text/plain',
                    content_url: `https://myBrand.zendesk.com/api/v2/macros/attachments/${attachmentId}/content`,
                  },
                ],
              },
            }
          }
          if (params.url === `/api/v2/macros/attachments/${attachmentId}/content`) {
            throw Error('status 500')
          }
          throw new Error('Err')
        })
        const elements = [macroType, macroInstance].map(e => e.clone())
        await filter.onFetch(elements)
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
          'zendesk.macro',
          'zendesk.macro.instance.macro',
          'zendesk.macro_attachment',
          'zendesk.macro_attachment.instance.test__test_txt@uuv',
        ])
        const attachmentInst = elements
          .filter(isInstanceElement)
          .find(e => e.elemID.getFullName() === 'zendesk.macro_attachment.instance.test__test_txt@uuv')
        expect(attachmentInst?.value.content).not.toBeDefined()
      })
    })
  })
  describe('deploy', () => {
    let attachmentInstance: InstanceElement
    let macroInstance: InstanceElement
    beforeEach(() => {
      attachmentInstance = new InstanceElement('attachment', attachmentType, {
        filename,
        contentType: 'text/plain',
        content: new StaticFile({
          filepath: 'zendesk/macro_attachment/test__test.txt',
          encoding: 'binary',
          content,
        }),
      })
      macroInstance = new InstanceElement('macro', macroType, {
        title: 'test',
        active: true,
        actions: [
          {
            field: 'status',
            value: 'open',
          },
        ],
        [ATTACHMENTS_FIELD_NAME]: [new ReferenceExpression(attachmentInstance.elemID, attachmentInstance)],
      })
      attachmentInstance.annotate({
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(macroInstance.elemID, macroInstance)],
      })
    })
    it('should pass the correct params to deployChange and client on create', async () => {
      const clonedMacro = macroInstance.clone()
      const clonedAttachment = attachmentInstance.clone()
      mockDeployChange.mockImplementation(async () => ({ macro: { id: macroId } }))
      mockPost = jest.spyOn(client, 'post')
      mockPost.mockResolvedValueOnce({
        status: 201,
        data: {
          macro_attachment: {
            id: attachmentId,
            filename,
            content_type: 'text/plain',
            content_url: `https://myBrand.zendesk.com/api/v2/macros/attachments/${attachmentId}/content`,
          },
        },
      })
      const res = await filter.deploy([
        { action: 'add', data: { after: clonedMacro } },
        { action: 'add', data: { after: clonedAttachment } },
      ])
      expect(mockPost).toHaveBeenCalledTimes(1)
      expect(mockPost).toHaveBeenCalledWith({
        url: '/api/v2/macros/attachments',
        data: expect.any(FormData),
        headers: expect.anything(),
      })
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      const resolvedClonedMacro = clonedMacro.clone()
      resolvedClonedMacro.value[ATTACHMENTS_FIELD_NAME] = [attachmentId]
      // It's actually not deployed with id but its added to the element that we check
      resolvedClonedMacro.value.id = macroId
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: resolvedClonedMacro } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        undefined,
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(2)
      expect(res.deployResult.appliedChanges[0]).toEqual({ action: 'add', data: { after: resolvedClonedMacro } })
      const resolvedAttachment = clonedAttachment.clone()
      resolvedAttachment.value.content = content
      // It's actually not deployed with id but its added to the element that we check
      resolvedAttachment.value.id = attachmentId
      expect(res.deployResult.appliedChanges[1].action).toEqual('add')
      expect((getChangeData(res.deployResult.appliedChanges[1]) as InstanceElement).value).toEqual(
        resolvedAttachment.value,
      )
    })
    it('should pass the correct params to deployChange and client on modify - with parent', async () => {
      const newAttachmentId = 123
      const clonedMacro = macroInstance.clone()
      clonedMacro.value.id = macroId
      const clonedAttachment = attachmentInstance.clone()
      clonedAttachment.value.id = attachmentId
      clonedMacro.value[ATTACHMENTS_FIELD_NAME] = [new ReferenceExpression(clonedAttachment.elemID, clonedAttachment)]
      clonedAttachment.annotations[CORE_ANNOTATIONS.PARENT] = [new ReferenceExpression(clonedMacro.elemID, clonedMacro)]
      const clonedBeforeMacro = clonedMacro.clone()
      const clonedAfterMacro = clonedMacro.clone()
      clonedAfterMacro.value.title = `${clonedAfterMacro.value.title}-edited`
      const clonedBeforeAttachment = clonedAttachment.clone()
      const clonedAfterAttachment = clonedAttachment.clone()
      clonedAfterAttachment.value.filename = `${clonedAfterAttachment.value.filename}-edited`

      mockDeployChange.mockImplementation(async () => ({ macro: { id: macroId } }))
      mockPost = jest.spyOn(client, 'post')
      mockPost.mockResolvedValueOnce({
        status: 201,
        data: {
          macro_attachment: {
            id: newAttachmentId,
            filename: `${filename}-edited`,
            content_type: 'text/plain',
            content_url: `https://myBrand.zendesk.com/api/v2/macros/attachments/${newAttachmentId}/content`,
          },
        },
      })
      const res = await filter.deploy([
        { action: 'modify', data: { before: clonedBeforeMacro, after: clonedAfterMacro } },
        { action: 'modify', data: { before: clonedBeforeAttachment, after: clonedAfterAttachment } },
      ])
      expect(mockPost).toHaveBeenCalledTimes(1)
      expect(mockPost).toHaveBeenCalledWith({
        url: '/api/v2/macros/attachments',
        data: expect.any(FormData),
        headers: expect.anything(),
      })
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      const resolvedClonedBeforeMacro = clonedBeforeMacro.clone()
      const resolvedClonedAfterMacro = clonedAfterMacro.clone()
      resolvedClonedBeforeMacro.value[ATTACHMENTS_FIELD_NAME] = [attachmentId]
      resolvedClonedAfterMacro.value[ATTACHMENTS_FIELD_NAME] = [newAttachmentId]
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'modify', data: { before: resolvedClonedBeforeMacro, after: resolvedClonedAfterMacro } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        undefined,
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(2)
      expect(res.deployResult.appliedChanges[0]).toEqual({
        action: 'modify',
        data: { before: resolvedClonedBeforeMacro, after: resolvedClonedAfterMacro },
      })
      const resolvedBeforeAttachment = clonedBeforeAttachment.clone()
      const resolvedAfterAttachment = clonedAfterAttachment.clone()
      resolvedBeforeAttachment.value.content = content
      resolvedAfterAttachment.value.content = content
      resolvedAfterAttachment.value.id = newAttachmentId
      expect(res.deployResult.appliedChanges[1].action).toEqual('modify')
      expect((res.deployResult.appliedChanges[1] as ModificationChange<InstanceElement>).data.before.value).toEqual(
        resolvedBeforeAttachment.value,
      )
      expect((res.deployResult.appliedChanges[1] as ModificationChange<InstanceElement>).data.after.value).toEqual(
        resolvedAfterAttachment.value,
      )
    })
    it('should pass the correct params to deployChange and client on modify - just child', async () => {
      const newAttachmentId = 123
      const clonedMacro = macroInstance.clone()
      clonedMacro.value.id = macroId
      const clonedAttachment = attachmentInstance.clone()
      clonedAttachment.value.id = attachmentId
      clonedMacro.value[ATTACHMENTS_FIELD_NAME] = [new ReferenceExpression(clonedAttachment.elemID, clonedAttachment)]
      clonedAttachment.annotations[CORE_ANNOTATIONS.PARENT] = [new ReferenceExpression(clonedMacro.elemID, clonedMacro)]
      const clonedBeforeAttachment = clonedAttachment.clone()
      const clonedAfterAttachment = clonedAttachment.clone()
      clonedAfterAttachment.value.filename = `${clonedAfterAttachment.value.filename}-edited`

      mockDeployChange.mockImplementation(async () => ({ macro: { id: macroId } }))
      mockPost = jest.spyOn(client, 'post')
      mockPost.mockResolvedValueOnce({
        status: 201,
        data: {
          macro_attachment: {
            id: newAttachmentId,
            filename: `${filename}-edited`,
            content_type: 'text/plain',
            content_url: `https://myBrand.zendesk.com/api/v2/macros/attachments/${newAttachmentId}/content`,
          },
        },
      })
      const res = await filter.deploy([
        { action: 'modify', data: { before: clonedBeforeAttachment, after: clonedAfterAttachment } },
      ])
      expect(mockPost).toHaveBeenCalledTimes(1)
      expect(mockPost).toHaveBeenCalledWith({
        url: '/api/v2/macros/attachments',
        data: expect.any(FormData),
        headers: expect.anything(),
      })
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      const resolvedClonedBeforeMacro = clonedMacro.clone()
      const resolvedClonedAfterMacro = clonedMacro.clone()
      resolvedClonedBeforeMacro.value[ATTACHMENTS_FIELD_NAME] = [attachmentId]
      resolvedClonedAfterMacro.value[ATTACHMENTS_FIELD_NAME] = [newAttachmentId]
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'modify', data: { before: resolvedClonedBeforeMacro, after: resolvedClonedAfterMacro } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        undefined,
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      const resolvedBeforeAttachment = clonedBeforeAttachment.clone()
      const resolvedAfterAttachment = clonedAfterAttachment.clone()
      resolvedBeforeAttachment.value.content = content
      resolvedAfterAttachment.value.content = content
      resolvedAfterAttachment.value.id = newAttachmentId
      expect(res.deployResult.appliedChanges[0].action).toEqual('modify')
      expect((res.deployResult.appliedChanges[0] as ModificationChange<InstanceElement>).data.before.value).toEqual(
        resolvedBeforeAttachment.value,
      )
      expect((res.deployResult.appliedChanges[0] as ModificationChange<InstanceElement>).data.after.value).toEqual(
        resolvedAfterAttachment.value,
      )
    })
    it('should pass the correct params to deployChange and client on remove', async () => {
      const clonedMacro = macroInstance.clone()
      clonedMacro.value.id = macroId
      const clonedAttachment = attachmentInstance.clone()
      clonedAttachment.value.id = attachmentId
      clonedMacro.value[ATTACHMENTS_FIELD_NAME] = [new ReferenceExpression(clonedAttachment.elemID, clonedAttachment)]
      clonedAttachment.annotations[CORE_ANNOTATIONS.PARENT] = [new ReferenceExpression(clonedMacro.elemID, clonedMacro)]
      mockDeployChange.mockImplementation(async () => ({ macro: { id: macroId } }))
      mockPost = jest.spyOn(client, 'post')
      mockPost.mockResolvedValueOnce({ status: 200 })
      const res = await filter.deploy([
        { action: 'remove', data: { before: clonedAttachment } },
        { action: 'remove', data: { before: clonedMacro } },
      ])
      expect(mockPost).toHaveBeenCalledTimes(0)
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      const resolvedClonedMacro = clonedMacro.clone()
      resolvedClonedMacro.value[ATTACHMENTS_FIELD_NAME] = [attachmentId]
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'remove', data: { before: resolvedClonedMacro } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        undefined,
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(2)
      expect(res.deployResult.appliedChanges[0]).toEqual({ action: 'remove', data: { before: resolvedClonedMacro } })
      const resolvedAttachment = clonedAttachment.clone()
      resolvedAttachment.value.content = content
      expect(res.deployResult.appliedChanges[1].action).toEqual('remove')
      expect((getChangeData(res.deployResult.appliedChanges[1]) as InstanceElement).value).toEqual(
        resolvedAttachment.value,
      )
    })
    it('should not deploy parent if the deployment of the child failed', async () => {
      const clonedMacro = macroInstance.clone()
      const clonedAttachment = attachmentInstance.clone()
      mockDeployChange.mockImplementation(async () => ({ macro: { id: macroId } }))
      mockPost = jest.spyOn(client, 'post')
      mockPost.mockImplementationOnce(() => {
        throw new Error('err')
      })
      const res = await filter.deploy([
        { action: 'add', data: { after: clonedMacro } },
        { action: 'add', data: { after: clonedAttachment } },
      ])
      expect(mockPost).toHaveBeenCalledTimes(1)
      expect(mockPost).toHaveBeenCalledWith({
        url: '/api/v2/macros/attachments',
        data: expect.any(FormData),
        headers: expect.anything(),
      })
      expect(mockDeployChange).toHaveBeenCalledTimes(0)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(2)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
  })
})
