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
import { filterUtils } from '@salto-io/adapter-components'
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, StaticFile } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/handle_identical_attachment_conflicts'
import { ARTICLE_ATTACHMENT_TYPE_NAME, ARTICLE_TYPE_NAME, ZENDESK } from '../../src/constants'
import { createFilterCreatorParams } from '../utils'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'

const attachmentType = new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_ATTACHMENT_TYPE_NAME) })
const articleType = new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) })
const createAttachment = (name: string, contentText: string, id: number): InstanceElement =>
  new InstanceElement(name, attachmentType, {
    id,
    content: new StaticFile({
      filepath: 'test',
      content: Buffer.from(contentText),
    }),
  })
const createArticle = (attachments: InstanceElement[]): InstanceElement =>
  new InstanceElement('article', articleType, {
    attachments: attachments.map(att => new ReferenceExpression(att.elemID, att)),
  })

describe('handle identical attachments conflicts filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  beforeEach(async () => {
    filter = filterCreator(
      createFilterCreatorParams({
        config: {
          ...DEFAULT_CONFIG,
          [FETCH_CONFIG]: {
            include: [
              {
                type: '.*',
              },
            ],
            exclude: [],
            handleIdenticalAttachmentConflicts: true,
          },
        },
      }),
    ) as FilterType
  })

  describe('onFetch', () => {
    it('should do nothing if flag is false', async () => {
      filter = filterCreator(
        createFilterCreatorParams({
          config: {
            ...DEFAULT_CONFIG,
            [FETCH_CONFIG]: {
              include: [
                {
                  type: '.*',
                },
              ],
              exclude: [],
              handleIdenticalAttachmentConflicts: false,
            },
          },
        }),
      ) as FilterType
      const attachment1 = createAttachment('att1', 'test', 1)
      const attachment2 = createAttachment('att1', 'test', 2)
      const article = createArticle([attachment1, attachment2])
      const elements = [attachment1, attachment2, article]
      await filter.onFetch(elements)
      expect(elements.map(elem => elem.elemID.name)).toEqual(['att1', 'att1', 'article'])
      expect(article.value.attachments.map((att: ReferenceExpression) => att.elemID.name)).toEqual(['att1', 'att1'])
    })
    it('should remove duplicate attachments', async () => {
      const attachment1 = createAttachment('att1', 'test', 1)
      const attachment2 = createAttachment('att1', 'test', 2)
      const attachment3 = createAttachment('att2', 'other', 3)
      const attachment4 = createAttachment('att2', 'other', 4)
      const article = createArticle([attachment1, attachment2, attachment3, attachment4])
      const elements = [attachment1, attachment2, attachment3, attachment4, article]
      await filter.onFetch(elements)
      expect(elements.map(elem => elem.elemID.name)).toEqual(['att1', 'att2', 'article'])
      expect(article.value.attachments.map((att: ReferenceExpression) => att.elemID.name)).toEqual(['att1', 'att2'])
    })
    it('should do nothing if duplicates have different hash', async () => {
      const attachment1 = createAttachment('att1', 'test', 1)
      const attachment2 = createAttachment('att1', 'test2', 2)
      const article = createArticle([attachment1, attachment2])
      const elements = [attachment1, attachment2, article]
      await filter.onFetch(elements)
      expect(elements.map(elem => elem.elemID.name)).toEqual(['att1', 'att1', 'article'])
      expect(article.value.attachments.map((att: ReferenceExpression) => att.elemID.name)).toEqual(['att1', 'att1'])
    })
    it('should do nothing if there are no duplicates', async () => {
      const attachment1 = createAttachment('att1', 'test', 1)
      const attachment2 = createAttachment('att2', 'test', 2)
      const article = createArticle([attachment1, attachment2])
      const elements = [attachment1, attachment2, article]
      await filter.onFetch(elements)
      expect(elements.map(elem => elem.elemID.name)).toEqual(['att1', 'att2', 'article'])
      expect(article.value.attachments.map((att: ReferenceExpression) => att.elemID.name)).toEqual(['att1', 'att2'])
    })
  })
})
