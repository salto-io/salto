/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { Element, InstanceElement, StaticFile } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/email_template_static_files'
import { FilterWith } from '../../src/filter'
import { defaultFilterContext } from '../utils'
import { mockTypes } from '../mock_elements'
import { createInstanceElement } from '../../src/transformers/transformer'

describe('emailTemplate static files filter', () => {
  const ATTACHMENT_AS_STRING = 'attachment'
  const EMAILCONTENT = 'email-content'
  const ATTACHMENT_NAME = 'attachment.txt'
  let elements: Element[]

  const attachment = new StaticFile({
    filepath: 'salesforce/Records/EmailTemplate/unfiled$public/emailTemplate/attachment.txt',
    content: Buffer.from(ATTACHMENT_AS_STRING, 'base64'),
  })

  const staticContent = new StaticFile({
    filepath: 'salesforce/Records/emailTemplate.email',
    content: Buffer.from(EMAILCONTENT),
  })

  describe('on fetch', () => {
    type FilterType = FilterWith<'onFetch'>
    let filter: FilterType

    describe('attachment as an object', () => {
      beforeAll(async () => {
        const emailNoArrayAttachment = createInstanceElement({ fullName: 'unfiled$public/emailTemplate',
          content: staticContent,
          attachments: { name: ATTACHMENT_NAME, content: ATTACHMENT_AS_STRING } },
        mockTypes.EmailTemplate)

        elements = [emailNoArrayAttachment]

        filter = filterCreator({ config: defaultFilterContext }) as FilterType
        await filter.onFetch(elements)
      })

      it('should extract attachment content to static file when emailTemplate has has attachment not in array', () => {
        const receivedEmailTemplate = elements[0] as InstanceElement
        expect(receivedEmailTemplate?.value.attachments).toIncludeSameMembers(
          [{ name: ATTACHMENT_NAME, content: attachment }]
        )
        expect(receivedEmailTemplate?.value.content?.filepath).toEqual(
          'salesforce/Records/EmailTemplate/unfiled$public/emailTemplate/emailTemplate.email'
        )
      })
    })

    describe('attachment as an array', () => {
      beforeAll(async () => {
        const emailArrayAttachment = createInstanceElement({ fullName: 'unfiled$public/emailTemplate',
          content: staticContent,
          attachments: [{ name: ATTACHMENT_NAME, content: ATTACHMENT_AS_STRING }] },
        mockTypes.EmailTemplate)

        elements = [emailArrayAttachment]

        filter = filterCreator({ config: defaultFilterContext }) as FilterType
        await filter.onFetch(elements)
      })

      it('should extract attachment content to static file when emailTemplate has attachment in array', () => {
        const receivedEmailTemplate = elements[0] as InstanceElement
        expect(receivedEmailTemplate?.value.attachments).toIncludeSameMembers(
          [{ name: ATTACHMENT_NAME, content: attachment }]
        )
        expect(receivedEmailTemplate?.value.content?.filepath).toEqual(
          'salesforce/Records/EmailTemplate/unfiled$public/emailTemplate/emailTemplate.email'
        )
      })
    })
  })
})
