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
  let attachmentTwoAsString: string
  let attachmentTwoAsFile: StaticFile

  beforeAll(() => {
    attachmentOneAsString = 'attachment-one'
    attachmentTwoAsString = 'attachment-two'

    const emailTemplateID = new ElemID(SALESFORCE, EMAIL_TEMPLATE_METADATA_TYPE)

    fields = {
      [ATTACHMENTS]: { refType: BuiltinTypes.STRING },
    }

    const emailTemplateType = new ObjectType({
      annotations: { [METADATA_TYPE]: EMAIL_TEMPLATE_METADATA_TYPE},
      elemID: emailTemplateID,
      fields,
      path: ['Objects', 'dir'],
    })

    const emailTemplateOne = new InstanceElement('emailTemplateOne', emailTemplateType, {
      [ATTACHMENTS]: [{ name: 'attachment-one', content: attachmentOneAsString }],
    })

    const emailTemplateTwo = new InstanceElement('emailTemplateTwo', emailTemplateType, {
      [ATTACHMENTS]: [{ name: 'attachment-one', content: attachmentOneAsString },
        { name: 'attachment-two', content: attachmentTwoAsString }],
    })
  })

  describe('on fetch', () => {
    type FilterType = FilterWith<'onFetch'>
    let filter: FilterType
    beforeAll(async () => {
      filter = filterCreator({ config: defaultFilterContext }) as FilterType
    })
    describe('extract attachments to static file', () => {
      beforeAll(async () => {
        await filter.onFetch(elements)
      })
      it('should create static file when emailTemplate has one attachment', () => {
      })
      it('should create static files when emailTemplate has two attachment', () => {
      })
    })
  })
})