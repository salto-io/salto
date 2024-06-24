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
import {
  InstanceElement,
  toChange,
  CORE_ANNOTATIONS,
  ReferenceExpression,
  ObjectType,
  ElemID,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { ARTICLE_ATTACHMENT_TYPE_NAME, ARTICLE_TYPE_NAME, ZENDESK } from '../../src/constants'
import { articleAttachmentDependencyChanger } from '../../src/dependency_changers/article_attachment_change'

describe('articleAttachmentDependencyChanger', () => {
  const articleType = new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) })
  const articleAttachmentType = new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_ATTACHMENT_TYPE_NAME) })
  const article = new InstanceElement('article', articleType, {
    attachments: [],
  })
  const articleAttachment = new InstanceElement('attachment1', articleAttachmentType, {}, undefined, {
    [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(article.elemID, article)],
  })

  article.value.attachments = [new ReferenceExpression(articleAttachment.elemID, articleAttachment)]

  it('should add dependency from attachment to its parent in addition of attachment', async () => {
    const inputChanges = new Map([
      [0, toChange({ after: articleAttachment })],
      [1, toChange({ before: article, after: article })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
      [0, new Set()],
      [1, new Set()],
    ])

    const dependencyChanges = [...(await articleAttachmentDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges.length).toBe(1)
    expect(dependencyChanges.every(change => change.action === 'add')).toBe(true)
    expect(dependencyChanges[0].dependency).toMatchObject({ source: 0, target: 1 })
  })
  it('should not add dependency from attachment to its parent in addition of both', async () => {
    const inputChanges = new Map([
      [0, toChange({ after: articleAttachment })],
      [1, toChange({ after: article })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
      [0, new Set()],
      [1, new Set()],
    ])

    const dependencyChanges = [...(await articleAttachmentDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges.length).toBe(0)
  })
  it('should not crush and add dependency if parent is not defined for attachment', async () => {
    const clonedAttachment = articleAttachment.clone()
    clonedAttachment.annotations[CORE_ANNOTATIONS.PARENT] = []
    const inputChanges = new Map([
      [0, toChange({ after: clonedAttachment })],
      [1, toChange({ after: article })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
      [0, new Set()],
      [1, new Set()],
    ])

    const dependencyChanges = [...(await articleAttachmentDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges.length).toBe(0)
  })
  it('should not crush and should add dependency if attachment is not defined in the parent', async () => {
    const clonedArticle = article.clone()
    clonedArticle.value.attachments = []
    const inputChanges = new Map([
      [0, toChange({ after: articleAttachment })],
      [1, toChange({ before: clonedArticle, after: clonedArticle })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
      [0, new Set()],
      [1, new Set()],
    ])

    const dependencyChanges = [...(await articleAttachmentDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges.length).toBe(1)
    expect(dependencyChanges.every(change => change.action === 'add')).toBe(true)
    expect(dependencyChanges[0].dependency).toMatchObject({ source: 0, target: 1 })
  })
})
