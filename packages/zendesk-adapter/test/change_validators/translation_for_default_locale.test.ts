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
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { ZENDESK } from '../../src/constants'
import { translationForDefaultLocaleValidator } from '../../src/change_validators'
import { DEFAULT_CONFIG } from '../../src/config'

const { replaceInstanceTypeForDeploy } = elementUtils.ducktype

describe('translationForDefaultLocaleValidator',
  () => {
    const sectionTypeName = 'section'
    const sectionTranslationTypename = 'section_translation'
    const guideLanguageSettingsTypeName = 'guide_language_settings'
    const sectionType = new ObjectType({ elemID: new ElemID(ZENDESK, sectionTypeName) })
    const sectionTranslationType = new ObjectType(
      { elemID: new ElemID(ZENDESK, sectionTranslationTypename) }
    )
    const articleTypeName = 'article'
    const articleTranslationTypename = 'article_translation'
    const articleType = new ObjectType({ elemID: new ElemID(ZENDESK, articleTypeName) })
    const articleTranslationType = new ObjectType(
      { elemID: new ElemID(ZENDESK, articleTranslationTypename) }
    )
    const guideLanguageSettingsType = new ObjectType(
      { elemID: new ElemID(ZENDESK, guideLanguageSettingsTypeName) }
    )


    const guideLanguageSettingsInstance = new InstanceElement(
      'instance',
      guideLanguageSettingsType,
      {
        locale: 'en-us',
        brand: 1,
      }
    )
    const guideLanguageSettingsHe = new InstanceElement(
      'instance',
      guideLanguageSettingsType,
      {
        locale: 'he',
        brand: 1,
      }
    )

    const enSectionTranslationInstance = new InstanceElement(
      'instance',
      sectionTranslationType,
      {
        locale: 'en-us',
        title: 'name',
        body: 'description',
      }
    )
    const enArticleTranslationInstance = new InstanceElement(
      'instance',
      articleTranslationType,
      {
        locale: 'en-us',
        title: 'name',
        body: 'description',
      }
    )
    const enArticleTranslationInstanceReferenceLocale = new InstanceElement(
      'instance',
      articleTranslationType,
      {
        locale: new ReferenceExpression(
          guideLanguageSettingsInstance.elemID.createNestedID('instance', 'Test1'), guideLanguageSettingsInstance
        ),
        title: 'name',
        body: 'description',
      }
    )
    const heSectionTranslationInstance = new InstanceElement(
      'instance',
      sectionTranslationType,
      {
        locale: 'he',
        title: 'name',
        body: 'description',
      }
    )

    it('should return an error when section does not have translation for source_locale',
      async () => {
        const invalidSectionInstance = replaceInstanceTypeForDeploy({
          instance: new InstanceElement(
            'instance',
            sectionType,
            {
              id: 1,
              name: 'name',
              description: 'description',
              source_locale: new ReferenceExpression(
                guideLanguageSettingsInstance.elemID.createNestedID('instance', 'Test1'), guideLanguageSettingsInstance
              ),
              translations: [new ReferenceExpression(
                heSectionTranslationInstance.elemID.createNestedID('instance', 'Test1'),
                heSectionTranslationInstance
              )],
            }
          ),
          config: DEFAULT_CONFIG.apiDefinitions,
        })
        const errors = await translationForDefaultLocaleValidator(
          [toChange({ after: invalidSectionInstance })]
        )
        expect(errors).toEqual([{
          elemID: invalidSectionInstance.elemID,
          severity: 'Error',
          message: `${invalidSectionInstance.elemID.typeName} instance does not have a translation for the source locale`,
          detailedMessage: `${invalidSectionInstance.elemID.typeName} instance "${invalidSectionInstance.elemID.name}" must have a translation for the source locale ${invalidSectionInstance.value.source_locale.value.value.locale}`,
        }])
      })

    it('should not return an error when section has translation for source_locale',
      async () => {
        const validSectionInstance = replaceInstanceTypeForDeploy({
          instance: new InstanceElement(
            'instance',
            sectionType,
            {
              id: 1,
              name: 'name',
              description: 'description',
              source_locale: new ReferenceExpression(
                guideLanguageSettingsInstance.elemID.createNestedID('instance', 'Test1'),
                guideLanguageSettingsInstance
              ),
              translations:
              [
                new ReferenceExpression(
                  enSectionTranslationInstance.elemID.createNestedID('instance', 'Test1'),
                  enSectionTranslationInstance
                ),
              ],
            }
          ),
          config: DEFAULT_CONFIG.apiDefinitions,
        })
        const errors = await translationForDefaultLocaleValidator(
          [toChange({ after: validSectionInstance })]
        )
        expect(errors).toHaveLength(0)
      })

    it('should not return an error when article has translation for source_locale',
      async () => {
        const validArticleInstance = replaceInstanceTypeForDeploy({
          instance: new InstanceElement(
            'instance',
            articleType,
            {
              id: 1,
              name: 'name',
              description: 'description',
              source_locale: new ReferenceExpression(
                guideLanguageSettingsInstance.elemID.createNestedID('instance', 'Test1'),
                guideLanguageSettingsInstance
              ),
              translations:
          [
            new ReferenceExpression(
              enArticleTranslationInstance.elemID.createNestedID('instance', 'Test1'),
              enArticleTranslationInstance
            ),
          ],
            }
          ),
          config: DEFAULT_CONFIG.apiDefinitions,
        })
        const errors = await translationForDefaultLocaleValidator(
          [toChange({ after: validArticleInstance })]
        )
        expect(errors).toHaveLength(0)
      })
    it('should not return an error when article has translation for source_locale, locale is a reference expression',
      async () => {
        const validArticleInstance = replaceInstanceTypeForDeploy({
          instance: new InstanceElement(
            'instance',
            articleType,
            {
              id: 1,
              name: 'name',
              description: 'description',
              source_locale: new ReferenceExpression(
                guideLanguageSettingsInstance.elemID.createNestedID('instance', 'Test1'),
                guideLanguageSettingsInstance
              ),
              translations:
                [
                  new ReferenceExpression(
                    enArticleTranslationInstanceReferenceLocale.elemID.createNestedID('instance', 'Test1'),
                    enArticleTranslationInstanceReferenceLocale
                  ),
                ],
            }
          ),
          config: DEFAULT_CONFIG.apiDefinitions,
        })
        const errors = await translationForDefaultLocaleValidator(
          [toChange({ after: validArticleInstance })]
        )
        expect(errors).toHaveLength(0)
      })
    it('should return an error when article does not have translation for source_locale, locale is a reference expression',
      async () => {
        const invalidArticleInstance = replaceInstanceTypeForDeploy({
          instance: new InstanceElement(
            'instance',
            articleType,
            {
              id: 1,
              name: 'name',
              description: 'description',
              source_locale: new ReferenceExpression(
                guideLanguageSettingsHe.elemID.createNestedID('instance', 'Test1'),
                guideLanguageSettingsHe
              ),
              translations:
                [
                  new ReferenceExpression(
                    enArticleTranslationInstanceReferenceLocale.elemID.createNestedID('instance', 'Test1'),
                    enArticleTranslationInstanceReferenceLocale
                  ),
                ],
            }
          ),
          config: DEFAULT_CONFIG.apiDefinitions,
        })
        const errors = await translationForDefaultLocaleValidator(
          [toChange({ after: invalidArticleInstance })]
        )
        expect(errors).toEqual([{
          elemID: invalidArticleInstance.elemID,
          severity: 'Error',
          message: `${invalidArticleInstance.elemID.typeName} instance does not have a translation for the source locale`,
          detailedMessage: `${invalidArticleInstance.elemID.typeName} instance "${invalidArticleInstance.elemID.name}" must have a translation for the source locale ${invalidArticleInstance.value.source_locale.value.value.locale}`,
        }])
      })
  })
