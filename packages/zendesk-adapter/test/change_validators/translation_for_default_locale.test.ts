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
    const guideLocaleTypename = 'guide_locale'
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
    const helpCenterLocaleType = new ObjectType(
      { elemID: new ElemID(ZENDESK, guideLocaleTypename) }
    )


    const helpCenterLocaleInstance = new InstanceElement(
      'instance',
      helpCenterLocaleType,
      {
        id: 'en-us',
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
                helpCenterLocaleType.elemID.createNestedID('instance', 'Test1'), helpCenterLocaleInstance
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
          detailedMessage: `${invalidSectionInstance.elemID.typeName} instance "${invalidSectionInstance.elemID.name}" must have a translation for the source locale ${invalidSectionInstance.value.source_locale.value.value.id}`,
        }])
      })

    it('should not return an error when section has translation for source_locale',
      async () => {
        const validSectionInstance = new InstanceElement(
          'instance',
          sectionType,
          {
            id: 1,
            name: 'name',
            description: 'description',
            source_locale: new ReferenceExpression(
              helpCenterLocaleType.elemID.createNestedID('instance', 'Test1'),
              helpCenterLocaleInstance
            ),
            translations:
              [
                new ReferenceExpression(
                  enSectionTranslationInstance.elemID.createNestedID('instance', 'Test1'),
                  enSectionTranslationInstance
                ),
              ],
          }
        )
        const errors = await translationForDefaultLocaleValidator(
          [toChange({ after: validSectionInstance })]
        )
        expect(errors).toHaveLength(0)
      })

    it('should not return an error when article has translation for source_locale',
      async () => {
        const validArticleInstance = new InstanceElement(
          'instance',
          articleType,
          {
            id: 1,
            name: 'name',
            description: 'description',
            source_locale: new ReferenceExpression(
              helpCenterLocaleType.elemID.createNestedID('instance', 'Test1'),
              helpCenterLocaleInstance
            ),
            translations:
          [
            new ReferenceExpression(
              enArticleTranslationInstance.elemID.createNestedID('instance', 'Test1'),
              enArticleTranslationInstance
            ),
          ],
          }
        )
        const errors = await translationForDefaultLocaleValidator(
          [toChange({ after: validArticleInstance })]
        )
        expect(errors).toHaveLength(0)
      })
  })
