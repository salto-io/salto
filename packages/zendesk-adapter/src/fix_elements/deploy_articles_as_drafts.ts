/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeError, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { DEPLOY_CONFIG } from '../config'
import { ARTICLE_TRANSLATION_TYPE_NAME } from '../constants'
import { FixElementsHandler } from './types'

const isRelevantElement = (element: unknown): element is InstanceElement =>
  isInstanceElement(element) &&
  element.elemID.typeName === ARTICLE_TRANSLATION_TYPE_NAME &&
  element.value.draft === false

const updateDraftToFalse = (element: InstanceElement): InstanceElement | undefined => {
  const fixedInstance = element.clone()
  fixedInstance.value.draft = true
  return fixedInstance
}

const toError = (element: InstanceElement): ChangeError => ({
  elemID: element.elemID,
  severity: 'Info',
  message: 'Article will be deployed as a Draft',
  detailedMessage: 'Article translation was originally Published, but will be deployed as a Draft',
})

/**
 * Update articles to be deployed to draft if the flag deployArticlesAsDraft is true.
 * These updates are done through article translations.
 */
export const deployArticlesAsDraftHandler: FixElementsHandler =
  ({ config }) =>
  async elements => {
    if (config[DEPLOY_CONFIG]?.deployArticlesAsDraft !== true) {
      return {
        fixedElements: [],
        errors: [],
      }
    }
    const fixedArticleTranslationsWithDraft = elements
      .filter(isRelevantElement)
      .map(updateDraftToFalse)
      .filter(values.isDefined)

    const errors = fixedArticleTranslationsWithDraft.map(toError)

    return {
      fixedElements: fixedArticleTranslationsWithDraft,
      errors,
    }
  }
