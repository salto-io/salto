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
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { ARTICLE_TYPE_NAME, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME, ZENDESK } from '../../src/constants'
import {
  createErrorMessageForDefaultTranslationValidator,
  guideDefaultTranslationChangeValidator,
} from '../../src/change_validators/guide_default_translation_change'

describe('guideDefaultTranslationChangeValidator', () => {
  const articleTranslationType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'article_translation'),
  })
  const enTranslation = new InstanceElement(
    'Test1English',
    articleTranslationType,
    {
      locale: new ReferenceExpression(new ElemID(ZENDESK, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME, 'instance', 'en-us')),
    },
    undefined,
  )
  const heTranslation = new InstanceElement(
    'Test2Hebrew',
    articleTranslationType,
    {
      locale: new ReferenceExpression(new ElemID(ZENDESK, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME, 'instance', 'he')),
    },
    undefined,
  )
  const esTranslation = new InstanceElement(
    'Test3Spanish',
    articleTranslationType,
    {
      locale: new ReferenceExpression(new ElemID(ZENDESK, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME, 'instance', 'es')),
    },
    undefined,
  )

  const articleInstance = new InstanceElement(
    'testArticle',
    new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) }),
    {
      author_id: 'author@salto.io',
      comments_disabled: false,
      draft: false,
      promoted: false,
      position: 0,
      section_id: '12345',
      name: 'The name of the article',
      title: 'The title of the article',
      source_locale: new ReferenceExpression(new ElemID(ZENDESK, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME, 'instance', 'he')),
      locale: new ReferenceExpression(new ElemID(ZENDESK, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME, 'instance', 'he')),
      outdated: false,
      permission_group_id: '666',
      body: '<p>ppppp</p>',
      translations: [
        new ReferenceExpression(articleTranslationType.elemID.createNestedID('instance', 'Test1'), heTranslation),
        new ReferenceExpression(articleTranslationType.elemID.createNestedID('instance', 'Test1'), enTranslation),
      ],
      brand: '1',
    },
  )
  heTranslation.annotations[CORE_ANNOTATIONS.PARENT] = [
    new ReferenceExpression(articleInstance.elemID, articleInstance),
  ]
  enTranslation.annotations[CORE_ANNOTATIONS.PARENT] = [
    new ReferenceExpression(articleInstance.elemID, articleInstance),
  ]
  esTranslation.annotations[CORE_ANNOTATIONS.PARENT] = [
    new ReferenceExpression(articleInstance.elemID, articleInstance),
  ]

  it('should return 2 errors if deployment creates, removes and modifies source_locale at the same time', async () => {
    const articleInstanceWithDifferentSrcLocale = articleInstance.clone()
    const esRef = new ReferenceExpression(new ElemID(ZENDESK, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME, 'instance', 'es'))
    articleInstanceWithDifferentSrcLocale.value.source_locale = esRef
    articleInstanceWithDifferentSrcLocale.value.locale = esRef
    articleInstanceWithDifferentSrcLocale.value.translations.push(esTranslation)
    articleInstanceWithDifferentSrcLocale.value.translations =
      articleInstanceWithDifferentSrcLocale.value.translations.filter(
        (translation: ReferenceExpression) => !translation.elemID.isEqual(heTranslation.elemID),
      )
    const errors = await guideDefaultTranslationChangeValidator([
      toChange({ before: articleInstance, after: articleInstanceWithDifferentSrcLocale }),
      toChange({ after: esTranslation }),
      toChange({ before: heTranslation }),
    ])
    expect(errors).toHaveLength(2)
    expect(errors[0]).toEqual(
      createErrorMessageForDefaultTranslationValidator(articleInstance, articleInstance, esTranslation, heTranslation),
    )
    expect(errors[1]).toEqual(
      createErrorMessageForDefaultTranslationValidator(heTranslation, articleInstance, esTranslation, heTranslation),
    )
  })
  it('should not return errors if deployment creates translation and changes source_locale', async () => {
    const articleInstanceWithDifferentSrcLocale = articleInstance.clone()
    const esRef = new ReferenceExpression(new ElemID(ZENDESK, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME, 'instance', 'es'))
    articleInstanceWithDifferentSrcLocale.value.source_locale = esRef
    articleInstanceWithDifferentSrcLocale.value.locale = esRef
    articleInstanceWithDifferentSrcLocale.value.translations.push(esTranslation)
    const errors = await guideDefaultTranslationChangeValidator([
      toChange({ before: articleInstance, after: articleInstanceWithDifferentSrcLocale }),
      toChange({ after: esTranslation }),
    ])
    expect(errors).toHaveLength(0)
  })
  it('should not return errors if deployment deletes translation and changes source_locale', async () => {
    const articleInstanceWithDifferentSrcLocale = articleInstance.clone()
    const enRef = new ReferenceExpression(new ElemID(ZENDESK, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME, 'instance', 'en-us'))
    articleInstanceWithDifferentSrcLocale.value.source_locale = enRef
    articleInstanceWithDifferentSrcLocale.value.locale = enRef
    articleInstanceWithDifferentSrcLocale.value.translations =
      articleInstanceWithDifferentSrcLocale.value.translations.filter(
        (translation: ReferenceExpression) => !translation.elemID.isEqual(heTranslation.elemID),
      )

    const errors = await guideDefaultTranslationChangeValidator([
      toChange({ before: articleInstance, after: articleInstanceWithDifferentSrcLocale }),
      toChange({ before: heTranslation }),
    ])
    expect(errors).toHaveLength(0)
  })
  it('should not return errors if deployment changes source_locale without creating or deleting translations', async () => {
    const articleInstanceWithDifferentSrcLocale = articleInstance.clone()
    const enRef = new ReferenceExpression(new ElemID(ZENDESK, GUIDE_LANGUAGE_SETTINGS_TYPE_NAME, 'instance', 'en-us'))
    articleInstanceWithDifferentSrcLocale.value.source_locale = enRef
    articleInstanceWithDifferentSrcLocale.value.locale = enRef

    const errors = await guideDefaultTranslationChangeValidator([
      toChange({ before: articleInstance, after: articleInstanceWithDifferentSrcLocale }),
    ])
    expect(errors).toHaveLength(0)
  })
  it('should not return errors if deployment changes translations without changing source_locale', async () => {
    const articleInstanceWithDifferentSrcLocale = articleInstance.clone()
    articleInstanceWithDifferentSrcLocale.value.translations.push(esTranslation)
    articleInstanceWithDifferentSrcLocale.value.translations =
      articleInstanceWithDifferentSrcLocale.value.translations.filter(
        (translation: ReferenceExpression) => !translation.elemID.isEqual(enTranslation.elemID),
      )

    const errors = await guideDefaultTranslationChangeValidator([
      toChange({ before: articleInstance, after: articleInstanceWithDifferentSrcLocale }),
      toChange({ after: esTranslation }),
      toChange({ before: enTranslation }),
    ])
    expect(errors).toHaveLength(0)
  })
})
