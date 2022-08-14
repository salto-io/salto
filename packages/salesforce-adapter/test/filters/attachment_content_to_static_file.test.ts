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

const ATTACHMENTS = 'attachments'

describe('attachments to static file filter', () => {
  let elements: Element[]
  let fields: Record<string, FieldDefinition>
  let attachmentOneAsString: string
  let attachmentOneAsFile: StaticFile
  let attachmentOneName: string
  let attachmentTwoAsString: string
  let attachmentTwoAsFile: StaticFile
  let attachmentTwoName: string
  let attachmentThreeAsString: string
  let attachmentThreeAsFile: StaticFile
  let attachmentThreeName: string

  beforeAll(() => {
    attachmentOneAsString = 'attachment-one'
    attachmentTwoAsString = 'attachment-two'
    attachmentThreeAsString = 'attachment-three'
    attachmentOneName = 'attachmentOne.txt'
    attachmentTwoName = 'attachmentTwo.txt'
    attachmentThreeName = 'attachmentThree.txt'

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

    attachmentOneAsFile = new StaticFile({
      filepath: `${(emailTemplateOne.path ?? []).join('/')}/${attachmentOneName}`,
      content: Buffer.from(attachmentOneAsString),
      encoding: 'utf-8',
    })

    attachmentTwoAsFile = new StaticFile({
      filepath: `${(emailTemplateTwo.path ?? []).join('/')}/${attachmentTwoName}`,
      content: Buffer.from(attachmentTwoAsString),
      encoding: 'utf-8',
    })

    attachmentThreeAsFile = new StaticFile({
      filepath: `${(emailTemplateTwo.path ?? []).join('/')}/${attachmentThreeName}`,
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
      const emailTemplateAfterFilter = elements.filter(isInstanceElement)
        .find(e => e.elemID.name === 'emailTemplateOne')
      expect(emailTemplateAfterFilter?.value[ATTACHMENTS][0].content)
        .toStrictEqual(attachmentOneAsFile)
    })

    it('should extract attachments content to static files when emailTemplate has two attachment', () => {
      const emailTemplateAfterFilter = elements.filter(isInstanceElement)
        .find(e => e.elemID.name === 'emailTemplateTwo')
      expect(emailTemplateAfterFilter?.value[ATTACHMENTS][0].content)
        .toStrictEqual(attachmentTwoAsFile)
      expect(emailTemplateAfterFilter?.value[ATTACHMENTS][1].content)
        .toStrictEqual(attachmentThreeAsFile)
    })

    it('should replace content to undefined', () => {
      const instanceUndefinedPath = elements?.filter(isInstanceElement)
        .find(e => e.path === undefined)
      expect(instanceUndefinedPath?.value[ATTACHMENTS].content).toBe(undefined)
    })
  })
})
