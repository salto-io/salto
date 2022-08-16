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
import { FilterWith } from '../../src/filter'
import filterCreator from '../../src/filters/attachment_content_to_static_file'
import { SALESFORCE, EMAIL_TEMPLATE_METADATA_TYPE, METADATA_TYPE } from '../../src/constants'
import { defaultFilterContext } from '../utils'

describe('attachments to static file filter', () => {
  const ATTACHMENTS = 'attachments'
  const attachmentOneAsString = 'attachment-one'
  const attachmentTwoAsString = 'attachment-two'
  const attachmentThreeAsString = 'attachment-three'
  const attachmentOneName = 'attachmentOne.txt'
  const attachmentTwoName = 'attachmentTwo.txt'
  const attachmentThreeName = 'attachmentThree.txt'
  let elements: Element[]
  let fields: Record<string, FieldDefinition>
  let attachmentOne: StaticFile
  let attachmentTwo: StaticFile
  let attachmentThree: StaticFile

  beforeAll(() => {


    const emailTemplateID = new ElemID(SALESFORCE, EMAIL_TEMPLATE_METADATA_TYPE)

    fields = {
      [ATTACHMENTS]: { refType: BuiltinTypes.STRING },
    }

    const emailTemplateType = new ObjectType({
      annotations: { [METADATA_TYPE]: EMAIL_TEMPLATE_METADATA_TYPE },
      elemID: emailTemplateID,
      fields,
      path: ['Objects', 'dir'],
    })

    const emailTemplateOne = new InstanceElement('emailTemplateOne', emailTemplateType, {
      [ATTACHMENTS]: [{ name: attachmentOneName, content: attachmentOneAsString }],
    },
    ['Objects', 'dir'])

    const emailTemplateTwo = new InstanceElement('emailTemplateTwo', emailTemplateType, {
      [ATTACHMENTS]: [{ name: attachmentTwoName, content: attachmentTwoAsString },
        { name: attachmentThreeName, content: attachmentThreeAsString }],
    },
    ['Objects', 'dir2'])

    const emailTemplateNoPath = new InstanceElement('emailTemplateNoPath', emailTemplateType, {
      [ATTACHMENTS]: [{ name: attachmentOneName, content: attachmentOneAsString }],
    })

    elements = [emailTemplateOne, emailTemplateTwo, emailTemplateNoPath, emailTemplateType]


    attachmentOne = new StaticFile({
      filepath: 'Objects/dir/attachmentOne.txt',
      content: Buffer.from(attachmentOneAsString),
      encoding: 'utf-8',
    })

    attachmentTwo = new StaticFile({
      filepath: 'Objects/dir2/attachmentTwo.txt',
      content: Buffer.from(attachmentTwoAsString),
      encoding: 'utf-8',
    })

    attachmentThree = new StaticFile({
      filepath: 'Objects/dir2/attachmentThree.txt',
      content: Buffer.from(attachmentThreeAsString),
      encoding: 'utf-8',
    })
  })

  describe('on fetch', () => {
    type FilterType = FilterWith<'onFetch'>
    let filter: FilterType

    beforeAll(async () => {
      filter = filterCreator({ config: defaultFilterContext }) as FilterType
      await filter.onFetch(elements)
    })

    it('should extract attachment content to static file when emailTemplate has one attachment', () => {
      const receivedEmailTemplate = elements.filter(isInstanceElement)
        .find(e => e.elemID.name === 'emailTemplateOne')
      expect(receivedEmailTemplate?.value.attachments[0])
        .toContainValue(attachmentOne)
    })

    it('should extract attachments content to static files when emailTemplate has multiple attachments', () => {
      const receivedEmailTemplate = elements.filter(isInstanceElement)
        .find(e => e.elemID.name === 'emailTemplateTwo')
      expect(receivedEmailTemplate?.value.attachments[0])
        .toContainValue(attachmentTwo)
      expect(receivedEmailTemplate?.value.attachments[1])
        .toContainValue(attachmentThree)
    })

    it('should replace content to undefined when instance has no path', () => {
      const instanceUndefinedPath = elements?.filter(isInstanceElement)
        .find(e => e.path === undefined)
      expect(instanceUndefinedPath?.value.attachments[0]).toContainEntry(['content', undefined])
    })
  })
})
