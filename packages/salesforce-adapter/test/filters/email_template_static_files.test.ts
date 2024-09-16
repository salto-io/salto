/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, InstanceElement, StaticFile, toChange } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/email_template_static_files'
import { defaultFilterContext } from '../utils'
import { mockTypes } from '../mock_elements'
import { createInstanceElement } from '../../src/transformers/transformer'
import { FilterWith } from './mocks'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'

describe('emailTemplate static files filter', () => {
  const ATTACHMENT_AS_STRING = 'attachment'
  const EMAIL_CONTENT = 'email-content'
  const ATTACHMENT_NAME = 'attachment.txt'

  type FilterType = FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>

  let elements: Element[]
  let filter: FilterType

  beforeEach(() => {
    filter = filterCreator({ config: defaultFilterContext }) as FilterType
  })

  const attachment = new StaticFile({
    filepath: 'salesforce/Records/EmailTemplate/unfiled$public/emailTemplate/attachment.txt',
    content: Buffer.from(ATTACHMENT_AS_STRING, 'base64'),
  })

  const attachmentWithIndexAsName = new StaticFile({
    filepath: 'salesforce/Records/EmailTemplate/unfiled$public/emailTemplate/0_attachment.txt',
    content: Buffer.from(ATTACHMENT_AS_STRING, 'base64'),
  })

  const staticContent = new StaticFile({
    filepath: 'salesforce/Records/emailTemplate.email',
    content: Buffer.from(EMAIL_CONTENT),
  })

  describe('on fetch', () => {
    beforeEach(() => {
      const emailTemplate = createInstanceElement(
        {
          fullName: 'unfiled$public/emailTemplate',
          content: staticContent,
          attachments: [{ name: ATTACHMENT_NAME, content: ATTACHMENT_AS_STRING }],
        },
        mockTypes.EmailTemplate,
      )
      elements = [emailTemplate]
    })
    describe('when indexedEmailTemplateAttachments is disabled', () => {
      beforeEach(() => {
        filter = filterCreator({
          config: {
            ...defaultFilterContext,
            fetchProfile: buildFetchProfile({
              fetchParams: {
                optionalFeatures: {
                  indexedEmailTemplateAttachments: false,
                },
              },
            }),
          },
        }) as FilterType
      })
      describe('attachment as an object', () => {
        beforeEach(async () => {
          const emailNoArrayAttachment = createInstanceElement(
            {
              fullName: 'unfiled$public/emailTemplate',
              content: staticContent,
              attachments: {
                name: ATTACHMENT_NAME,
                content: ATTACHMENT_AS_STRING,
              },
            },
            mockTypes.EmailTemplate,
          )

          elements = [emailNoArrayAttachment]

          await filter.onFetch(elements)
        })

        it('should extract attachment content to static file when emailTemplate has has attachment not in array', () => {
          const receivedEmailTemplate = elements[0] as InstanceElement
          expect(receivedEmailTemplate?.value.attachments).toIncludeSameMembers([
            { name: ATTACHMENT_NAME, content: attachment },
          ])
          expect(receivedEmailTemplate?.value.content?.filepath).toEqual(
            'salesforce/Records/EmailTemplate/unfiled$public/emailTemplate/emailTemplate.email',
          )
        })
      })

      describe('attachment as an array', () => {
        beforeEach(async () => {
          const emailArrayAttachment = createInstanceElement(
            {
              fullName: 'unfiled$public/emailTemplate',
              content: staticContent,
              attachments: [{ name: ATTACHMENT_NAME, content: ATTACHMENT_AS_STRING }],
            },
            mockTypes.EmailTemplate,
          )

          elements = [emailArrayAttachment]

          await filter.onFetch(elements)
        })

        it('should extract attachment content to static file when emailTemplate has attachment in array', () => {
          const receivedEmailTemplate = elements[0] as InstanceElement
          expect(receivedEmailTemplate?.value.attachments).toIncludeSameMembers([
            { name: ATTACHMENT_NAME, content: attachment },
          ])
          expect(receivedEmailTemplate?.value.content?.filepath).toEqual(
            'salesforce/Records/EmailTemplate/unfiled$public/emailTemplate/emailTemplate.email',
          )
        })
      })
    })
    describe('when indexedEmailTemplateAttachments is enabled', () => {
      beforeEach(() => {
        filter = filterCreator({
          config: {
            ...defaultFilterContext,
            fetchProfile: buildFetchProfile({
              fetchParams: {
                optionalFeatures: {
                  indexedEmailTemplateAttachments: true,
                },
              },
            }),
          },
        }) as FilterType
      })
      describe('attachment as an object', () => {
        beforeEach(async () => {
          const emailNoArrayAttachment = createInstanceElement(
            {
              fullName: 'unfiled$public/emailTemplate',
              content: staticContent,
              attachments: {
                name: ATTACHMENT_NAME,
                content: ATTACHMENT_AS_STRING,
              },
            },
            mockTypes.EmailTemplate,
          )

          elements = [emailNoArrayAttachment]

          await filter.onFetch(elements)
        })

        it('should extract attachment content to static file when emailTemplate has has attachment not in array', () => {
          const receivedEmailTemplate = elements[0] as InstanceElement
          expect(receivedEmailTemplate?.value.attachments).toIncludeSameMembers([
            { name: ATTACHMENT_NAME, content: attachmentWithIndexAsName },
          ])
          expect(receivedEmailTemplate?.value.content?.filepath).toEqual(
            'salesforce/Records/EmailTemplate/unfiled$public/emailTemplate/emailTemplate.email',
          )
        })
      })

      describe('attachment as an array', () => {
        beforeEach(async () => {
          const emailArrayAttachment = createInstanceElement(
            {
              fullName: 'unfiled$public/emailTemplate',
              content: staticContent,
              attachments: [{ name: ATTACHMENT_NAME, content: ATTACHMENT_AS_STRING }],
            },
            mockTypes.EmailTemplate,
          )

          elements = [emailArrayAttachment]

          await filter.onFetch(elements)
        })

        it('should extract attachment content to static file when emailTemplate has attachment in array', () => {
          const receivedEmailTemplate = elements[0] as InstanceElement
          expect(receivedEmailTemplate?.value.attachments).toIncludeSameMembers([
            { name: ATTACHMENT_NAME, content: attachmentWithIndexAsName },
          ])
          expect(receivedEmailTemplate?.value.content?.filepath).toEqual(
            'salesforce/Records/EmailTemplate/unfiled$public/emailTemplate/emailTemplate.email',
          )
        })
      })
    })
  })
  describe('deploy flow', () => {
    const ATTACHMENT_AS_BASE64_STRING = 'attachmeng=='
    const ATTACHMENT_AS_BUFFER = Buffer.from(ATTACHMENT_AS_BASE64_STRING, 'base64')

    let deployedInstance: InstanceElement
    beforeEach(async () => {
      deployedInstance = createInstanceElement(
        {
          fullName: 'unfiled$public/emailTemplate',
          content: staticContent,
          attachments: [{ name: ATTACHMENT_NAME, content: ATTACHMENT_AS_BUFFER }],
        },
        mockTypes.EmailTemplate,
      )
    })

    it('should encode the attachment to base64 string on preDeploy and revert back to binary buffer on onDeploy', async () => {
      const changes = [toChange({ after: deployedInstance })]
      // preDeploy - encode the attachment content to base64 string
      await filter.preDeploy(changes)
      expect(deployedInstance.value.attachments).toEqual([
        { name: ATTACHMENT_NAME, content: ATTACHMENT_AS_BASE64_STRING },
      ])
      // onDeploy - decode the attachment content back to binary buffer
      await filter.onDeploy(changes)
      expect(deployedInstance.value.attachments).toEqual([{ name: ATTACHMENT_NAME, content: ATTACHMENT_AS_BUFFER }])
    })
  })
})
