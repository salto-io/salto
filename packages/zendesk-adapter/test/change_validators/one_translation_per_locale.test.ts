
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
import {
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { ZENDESK } from '../../src/constants'
import { oneTranslationPerLocalValidator } from '../../src/change_validators'

describe('oneTranslationPerLocalValidator',
  () => {
    const articleType = new ObjectType({
      elemID: new ElemID(ZENDESK, 'article'),
    })
    const articleTranslationType = new ObjectType({
      elemID: new ElemID(ZENDESK, 'article_translation'),
    })

    it('should not return an error when article have different translations with different locale', async () => {
      const enTranslation = new InstanceElement(
        'Test1',
        articleTranslationType,
        {
          locale: 'en-us',
        },
        undefined,
        {
          _parent: [],
        },
      )
      const heTranslation = new InstanceElement(
        'Test1',
        articleTranslationType,
        {
          locale: 'he',
        },
        undefined,
        {
          _parent: [],
        },
      )
      const article = new InstanceElement(
        'Test1',
        articleType,
        {
          translations: [
            new ReferenceExpression(
              articleTranslationType.elemID.createNestedID('instance', 'Test1'), heTranslation
            ),
            new ReferenceExpression(
              articleTranslationType.elemID.createNestedID('instance', 'Test1'), enTranslation
            ),
          ],
        },
      )
      heTranslation.annotations[CORE_ANNOTATIONS.PARENT].push(new ReferenceExpression(
        articleType.elemID.createNestedID('instance', 'Test1'), article
      ))
      enTranslation.annotations[CORE_ANNOTATIONS.PARENT].push(new ReferenceExpression(
        articleType.elemID.createNestedID('instance', 'Test1'), article
      ))

      const errors = await oneTranslationPerLocalValidator(
        [toChange({ after: heTranslation })]
      )
      expect(errors).toHaveLength(0)
    })

    it('should return an error when article have different translations with same locale', async () => {
      const enTranslation = new InstanceElement(
        'Test2',
        articleTranslationType,
        {
          locale: 'en-us',
        },
        undefined,
        {
          _parent: [],
        },
      )
      const enTranslation2 = new InstanceElement(
        'Test2',
        articleTranslationType,
        {
          locale: 'en-us',
        },
        undefined,
        {
          _parent: [],
        },
      )
      const article = new InstanceElement(
        'Test2',
        articleType,
        {
          translations: [
            new ReferenceExpression(
              articleTranslationType.elemID.createNestedID('instance', 'Test2'), enTranslation2
            ),
            new ReferenceExpression(
              articleTranslationType.elemID.createNestedID('instance', 'Test2'), enTranslation
            ),
          ],
        },
      )
      enTranslation2.annotations[CORE_ANNOTATIONS.PARENT].push(new ReferenceExpression(
        articleType.elemID.createNestedID('instance', 'Test2'), article
      ))
      enTranslation.annotations[CORE_ANNOTATIONS.PARENT].push(new ReferenceExpression(
        articleType.elemID.createNestedID('instance', 'Test2'), article
      ))

      const errors = await oneTranslationPerLocalValidator(
        [toChange({ after: enTranslation })]
      )
      expect(errors).toEqual([{
        elemID: article.elemID,
        severity: 'Error',
        message: `${article.elemID.getFullName()} cannot have multiple translations with the same locale`,
        detailedMessage: `${article.elemID.getFullName()} cannot have multiple translations with the same locale`,
      }])
    })
  })
