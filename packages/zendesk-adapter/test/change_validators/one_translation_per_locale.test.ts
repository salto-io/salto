
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
import { oneTranslationPerLocaleValidator } from '../../src/change_validators'

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
      )
      const heTranslation = new InstanceElement(
        'Test1',
        articleTranslationType,
        {
          locale: 'he',
        },
        undefined,
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
      heTranslation.annotations[CORE_ANNOTATIONS.PARENT] = [new ReferenceExpression(
        articleType.elemID.createNestedID('instance', 'Test1'), article
      )]
      enTranslation.annotations[CORE_ANNOTATIONS.PARENT] = [new ReferenceExpression(
        articleType.elemID.createNestedID('instance', 'Test1'), article
      )]

      const errors = await oneTranslationPerLocaleValidator(
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
      )
      const enTranslation2 = new InstanceElement(
        'Test2',
        articleTranslationType,
        {
          locale: 'en-us',
        },
        undefined,
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
      enTranslation2.annotations[CORE_ANNOTATIONS.PARENT] = [new ReferenceExpression(
        articleType.elemID.createNestedID('instance', 'Test2'), article
      )]
      enTranslation.annotations[CORE_ANNOTATIONS.PARENT] = [new ReferenceExpression(
        articleType.elemID.createNestedID('instance', 'Test2'), article
      )]

      const errors = await oneTranslationPerLocaleValidator(
        [toChange({ after: enTranslation }), toChange({ after: enTranslation2 })]
      )
      expect(errors).toEqual([{
        elemID: article.elemID,
        severity: 'Error',
        message: `Multiple translations with the same locale found in ${article.elemID.typeName} instance. Only one translation per locale is supported.`,
        detailedMessage: `Instance ${article.elemID.getFullName()} has multiple translations for locales: en-us. Only one translation per locale is supported.`,
      }])
    })
    it('should not return an error when parent does not exist', async () => {
      const noParentTranslation = new InstanceElement(
        'Test1',
        articleTranslationType,
        {
          locale: 'en-us',
        },
        undefined,
      )
      const errors = await oneTranslationPerLocaleValidator(
        [toChange({ after: noParentTranslation })]
      )
      expect(errors).toHaveLength(0)
    })
  })
