
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
import {
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { elementSource } from '@salto-io/workspace'
import { GUIDE_LANGUAGE_SETTINGS_TYPE_NAME, ZENDESK } from '../../src/constants'
import { oneTranslationPerLocaleValidator } from '../../src/change_validators'

describe('oneTranslationPerLocalValidator',
  () => {
    const articleType = new ObjectType({
      elemID: new ElemID(ZENDESK, 'article'),
    })
    const articleTranslationType = new ObjectType({
      elemID: new ElemID(ZENDESK, 'article_translation'),
    })
    const guideLanguageSettingsType = new ObjectType({
      elemID: new ElemID(ZENDESK, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME),
    })

    it('should not return an error when article has different translations with different locale', async () => {
      const enTranslation = new InstanceElement(
        'Test1',
        articleTranslationType,
        {
          locale: 'en-us',
        },
        undefined,
      )
      const heTranslation = new InstanceElement(
        'Test2',
        articleTranslationType,
        {
          locale: 'he',
        },
        undefined,
      )
      const esTranslation = new InstanceElement(
        'Test3',
        articleTranslationType,
        {
          locale: new ReferenceExpression(new ElemID(ZENDESK, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME, 'instance', 'es')),
        },
        undefined,
      )
      const esLocale = new InstanceElement(
        'es',
        guideLanguageSettingsType,
        {
          locale: 'es',
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
      heTranslation.annotations[CORE_ANNOTATIONS.PARENT] = [
        new ReferenceExpression(article.elemID, article),
      ]
      enTranslation.annotations[CORE_ANNOTATIONS.PARENT] = [
        new ReferenceExpression(article.elemID, article),
      ]
      esTranslation.annotations[CORE_ANNOTATIONS.PARENT] = [
        new ReferenceExpression(article.elemID, article),
      ]

      const errors = await oneTranslationPerLocaleValidator(
        [toChange({ after: heTranslation })],
        elementSource.createInMemoryElementSource([esLocale, article])
      )
      expect(errors).toHaveLength(0)
    })

    it('should return an error when article has different translations with same locale', async () => {
      const enusLocale = new InstanceElement(
        'en-us',
        guideLanguageSettingsType,
        {
          locale: 'en-us',
        },
      )
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
          // Check that the validator can catch both a string and a reference expression
          locale: new ReferenceExpression(enusLocale.elemID, enusLocale),
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
        articleType.elemID.createNestedID('instance', 'Test2')
      )]
      enTranslation.annotations[CORE_ANNOTATIONS.PARENT] = [new ReferenceExpression(
        articleType.elemID.createNestedID('instance', 'Test2'), article
      )]

      const errors = await oneTranslationPerLocaleValidator(
        [toChange({ after: enTranslation }), toChange({ after: enTranslation2 })],
        elementSource.createInMemoryElementSource([enusLocale, article]),
      )
      expect(errors).toEqual([{
        elemID: article.elemID,
        severity: 'Error',
        message: 'Cannot make this change since there are too many translations per locale',
        detailedMessage: 'More than one translation found for locales en-us. Only one translation per locale is supported.',
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
        [toChange({ after: noParentTranslation })],
        elementSource.createInMemoryElementSource([]),
      )
      expect(errors).toHaveLength(0)
    })
  })
