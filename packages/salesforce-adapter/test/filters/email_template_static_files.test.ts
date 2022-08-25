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
import { Element, ElemID, ObjectType, InstanceElement, BuiltinTypes, StaticFile, FieldDefinition } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/email_template_static_files'
import { FilterWith } from '../../src/filter'
import { SALESFORCE, EMAIL_TEMPLATE_METADATA_TYPE, METADATA_TYPE } from '../../src/constants'
import { defaultFilterContext } from '../utils'

describe('emailTemplate static files filter', () => {
  const ATTACHMENTS = 'attachments'
  const CONTENT = 'content'
  const FULL_NAME = 'fullName'
  const ATTACHMENTONEASSTRING = 'attachment-one'
  const ATTACHMENTTWOASSTRING = 'attachment-two'
  const EMAILCONTENT = 'email-content'
  const ATTACHMENTONENAME = 'attachmentOne.txt'
  const ATTACHMENTTWONAME = 'attachmentTwo.txt'
  let elements: Element[]
  let fields: Record<string, FieldDefinition>
  let attachmentOne: StaticFile
  let attachmentTwo: StaticFile
  let staticContentOne: StaticFile
  let staticContentTwo: StaticFile

  beforeAll(() => {
    const emailTemplateID = new ElemID(SALESFORCE, EMAIL_TEMPLATE_METADATA_TYPE)

    fields = {
      [CONTENT]: { refType: BuiltinTypes.STRING },
      [ATTACHMENTS]: { refType: BuiltinTypes.STRING },
      [FULL_NAME]: { refType: BuiltinTypes.STRING },
    }

    const emailType = new ObjectType({
      annotations: { [METADATA_TYPE]: EMAIL_TEMPLATE_METADATA_TYPE },
      elemID: emailTemplateID,
      fields,
      path: ['Objects', 'dir'],
    })

    attachmentOne = new StaticFile({
      filepath: 'salesforce/Records/EmailTemplate/unfiled$public/emailTemplateOne/attachmentOne.txt',
      content: Buffer.from(ATTACHMENTONEASSTRING),
      encoding: 'utf-8',
    })

    attachmentTwo = new StaticFile({
      filepath: 'salesforce/Records/EmailTemplate/unfiled$public/emailTemplateTwo/attachmentTwo.txt',
      content: Buffer.from(ATTACHMENTTWOASSTRING),
      encoding: 'utf-8',
    })

    staticContentOne = new StaticFile({
      filepath: 'Objects/dir/emailTemplateOne.email',
      content: Buffer.from(EMAILCONTENT),
      encoding: 'utf-8',
    })

    staticContentTwo = new StaticFile({
      filepath: 'Objects/dir/emailTemplateTwo.email',
      content: Buffer.from(EMAILCONTENT),
      encoding: 'utf-8',
    })

    const emailNoArrayAttachment = new InstanceElement('emailTemplateOne', emailType, {
      [ATTACHMENTS]: { name: ATTACHMENTONENAME, content: ATTACHMENTONEASSTRING },
      [CONTENT]: staticContentOne,
      [FULL_NAME]: 'unfiled$public/emailTemplateOne',
    },
    ['Objects', 'dir', 'emailTemplateOne'])

    const emailArrayAttachment = new InstanceElement('emailTemplateTwo', emailType, {
      [ATTACHMENTS]: [{ name: ATTACHMENTTWONAME, content: ATTACHMENTTWOASSTRING }],
      [CONTENT]: staticContentTwo,
      [FULL_NAME]: 'unfiled$public/emailTemplateTwo',
    },
    ['Objects', 'dir', 'emailTemplateTwo'])

    const emailTemplateNoContent = new InstanceElement('emailTemplateNoContent', emailType, {
      [ATTACHMENTS]: [{ name: ATTACHMENTONENAME, content: ATTACHMENTONEASSTRING }],
    })

    elements = [emailNoArrayAttachment, emailArrayAttachment, emailTemplateNoContent, emailType]
  })

  describe('on fetch', () => {
    type FilterType = FilterWith<'onFetch'>
    let filter: FilterType

    beforeAll(async () => {
      filter = filterCreator({ config: defaultFilterContext }) as FilterType
      await filter.onFetch(elements)
    })

    it('should extract attachment content to static file when emailTemplate has has attachment not in array', () => {
      const receivedEmailTemplate = elements[0] as InstanceElement
      expect(receivedEmailTemplate?.value.attachments).toIncludeSameMembers(
        [{ name: ATTACHMENTONENAME, content: attachmentOne }]
      )
      expect(receivedEmailTemplate?.value.content?.filepath).toEqual(
        'salesforce/Records/EmailTemplate/unfiled$public/emailTemplateOne/emailTemplateOne.email'
      )
    })

    it('should extract attachment content to static file when emailTemplate has attachment in array', () => {
      const receivedEmailTemplate = elements[1] as InstanceElement
      expect(receivedEmailTemplate?.value.attachments).toIncludeSameMembers(
        [{ name: ATTACHMENTTWONAME, content: attachmentTwo }]
      )
      expect(receivedEmailTemplate?.value.content?.filepath).toEqual(
        'salesforce/Records/EmailTemplate/unfiled$public/emailTemplateTwo/emailTemplateTwo.email'
      )
    })

    it('should not replace content when emailTemplate instance has no full name', () => {
      const instanceUndefinedPath = elements[2] as InstanceElement
      expect(instanceUndefinedPath?.value.attachments)
        .toIncludeSameMembers([{ name: ATTACHMENTONENAME, content: ATTACHMENTONEASSTRING }])
    })
  })
})
