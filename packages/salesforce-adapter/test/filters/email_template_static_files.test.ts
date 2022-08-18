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
import { Element, ElemID, ObjectType, InstanceElement, isInstanceElement, BuiltinTypes, StaticFile, FieldDefinition } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/email_template_static_files'
import { FilterWith } from '../../src/filter'
import { SALESFORCE, EMAIL_TEMPLATE_METADATA_TYPE, METADATA_TYPE } from '../../src/constants'
import { defaultFilterContext } from '../utils'

describe('emailTemplate static files filter', () => {
  const ATTACHMENTS = 'attachments'
  const CONTENT = 'content'
  const attachmentOneAsString = 'attachment-one'
  const attachmentTwoAsString = 'attachment-two'
  const emailContent = 'email-content'
  const attachmentOneName = 'attachmentOne.txt'
  const attachmentTwoName = 'attachmentTwo.txt'
  let elements: Element[]
  let fields: Record<string, FieldDefinition>
  let attachmentOne: StaticFile
  let attachmentTwo: StaticFile
  let StaticContent: StaticFile

  beforeAll(() => {
    const emailTemplateID = new ElemID(SALESFORCE, EMAIL_TEMPLATE_METADATA_TYPE)

    fields = {
      [CONTENT]: { refType: BuiltinTypes.STRING },
      [ATTACHMENTS]: { refType: BuiltinTypes.STRING },
    }

    const emailTemplateType = new ObjectType({
      annotations: { [METADATA_TYPE]: EMAIL_TEMPLATE_METADATA_TYPE },
      elemID: emailTemplateID,
      fields,
      path: ['Objects', 'dir'],
    })

    attachmentOne = new StaticFile({
      filepath: 'Objects/dir/emailTemplateOne/attachmentOne.txt',
      content: Buffer.from(attachmentOneAsString),
      encoding: 'utf-8',
    })

    attachmentTwo = new StaticFile({
      filepath: 'Objects/dir/emailTemplateTwo/attachmentTwo.txt',
      content: Buffer.from(attachmentTwoAsString),
      encoding: 'utf-8',
    })

    StaticContent = new StaticFile({
      filepath: 'Objects/dir/emailTemplateTwo.email',
      content: Buffer.from(emailContent),
      encoding: 'utf-8',
    })

    const emailTemplateOne = new InstanceElement('emailTemplateOne', emailTemplateType, {
      [ATTACHMENTS]: [{ name: attachmentOneName, content: attachmentOneAsString }],
    },
    ['Objects', 'dir', 'emailTemplateOne'])

    const emailTemplateTwo = new InstanceElement('emailTemplateTwo', emailTemplateType, {
      [ATTACHMENTS]: [{ name: attachmentTwoName, content: attachmentTwoAsString }],
      [CONTENT]: StaticContent,
    },
    ['Objects', 'dir', 'emailTemplateTwo'])

    const emailTemplateNoPath = new InstanceElement('emailTemplateNoPath', emailTemplateType, {
      [ATTACHMENTS]: [{ name: attachmentOneName, content: attachmentOneAsString }],
    })

    elements = [emailTemplateOne, emailTemplateTwo, emailTemplateNoPath, emailTemplateType]
  })

  describe('on fetch', () => {
    type FilterType = FilterWith<'onFetch'>
    let filter: FilterType

    beforeAll(async () => {
      filter = filterCreator({ config: defaultFilterContext }) as FilterType
      await filter.onFetch(elements)
    })

    it('should extract attachment content to static file when emailTemplate has no content as static file', () => {
      const receivedEmailTemplate = elements.filter(isInstanceElement)
        .find(e => e.elemID.name === 'emailTemplateOne')
      expect(receivedEmailTemplate?.value.attachments)
        .toIncludeAllMembers([{ name: attachmentOneName, content: attachmentOne }])
    })

    it('should extract attachment content to static file when emailTemplate has content as static file', () => {
      const receivedEmailTemplate = elements.filter(isInstanceElement)
        .find(e => e.elemID.name === 'emailTemplateTwo')
      expect(receivedEmailTemplate?.value.attachments).toIncludeAllMembers(
        [{ name: attachmentTwoName, content: attachmentTwo }]
      )
      expect(receivedEmailTemplate?.value.content?.filepath).toEqual(
        'Objects/dir/emailTemplateTwo/emailTemplateTwo.email'
      )
    })

    it('should not replace content when instance has no path', () => {
      const instanceUndefinedPath = elements?.filter(isInstanceElement)
        .find(e => e.path === undefined)
      expect(instanceUndefinedPath?.value.attachments)
        .toIncludeAllPartialMembers([{ content: 'attachment-one', name: 'attachmentOne.txt' }])
    })
  })
})
