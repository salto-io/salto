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
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import {
  Change, ElemID, getChangeData, InstanceElement, isAdditionChange,
  isInstanceElement, isRemovalChange, ReferenceExpression,
} from '@salto-io/adapter-api'
import { replaceTemplatesWithValues, resolveChangeElement } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'
import { ARTICLE_TYPE_NAME, USER_SEGMENT_TYPE_NAME, ZENDESK } from '../constants'
import { addRemovalChangesId, isTranslation } from './guide_section_and_category'
import { lookupFunc } from './field_references'
import { removeTitleAndBody } from './guide_fetch_article'
import { prepRef } from './article_body'
import { EVERYONE } from './everyone_user_segment'

const log = logger(module)
const { awu } = collections.asynciterable

const USER_SEGMENT_ID_FIELD = 'user_segment_id'

export type TranslationType = {
  title: string
  body?: string
  locale: { id: string }
}

const addTranslationValues = async (change: Change<InstanceElement>): Promise<void> => {
  const resolvedChange = await resolveChangeElement(change, lookupFunc)
  const currentLocale = getChangeData(resolvedChange).value.source_locale
  const translation = getChangeData(resolvedChange).value.translations
    .filter(isTranslation)
    .find((tran: TranslationType) => tran.locale?.id === currentLocale)
  if (translation !== undefined) {
    getChangeData(change).value.title = translation.title
    getChangeData(change).value.body = translation.body ?? ''
  }
}

// The default user_segment we added will be resolved to undefined
// So in order to create a new article we need to add a null value user_segment_id
const setUserSegmentIdForAdditionChanges = (
  changes: Change<InstanceElement>[]
): void => {
  changes
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(articleInstance => articleInstance.value[USER_SEGMENT_ID_FIELD] === undefined)
    .forEach(articleInstance => {
      articleInstance.value[USER_SEGMENT_ID_FIELD] = null
    })
}

/**
 * Deploys articles and adds default user_segment value to visible articles
 */
const filterCreator: FilterCreator = ({ config, client, elementsSource }) => ({
  onFetch: async elements => {
    const everyoneUserSegmentInstance = elements
      .filter(instance => instance.elemID.typeName === USER_SEGMENT_TYPE_NAME)
      .find(instance => instance.elemID.name === EVERYONE)
    if (everyoneUserSegmentInstance === undefined) {
      log.info("Couldn't find Everyone user_segment instance.")
      return
    }
    const articleInstances = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === ARTICLE_TYPE_NAME)
    articleInstances
      .filter(article => article.value[USER_SEGMENT_ID_FIELD] === undefined)
      .forEach(article => {
        article.value[USER_SEGMENT_ID_FIELD] = new ReferenceExpression(
          everyoneUserSegmentInstance.elemID,
          everyoneUserSegmentInstance,
        )
      })
  },

  preDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
    await awu(changes)
      .filter(isAdditionChange)
      .filter(change => getChangeData(change).elemID.typeName === ARTICLE_TYPE_NAME)
      .forEach(async change => {
        // We add the title and the resolved body values for articles creation
        await addTranslationValues(change)
        const instance = getChangeData(change)
        try {
          replaceTemplatesWithValues(
            { values: [instance.value], fieldName: 'body' },
            {},
            prepRef,
          )
        } catch (e) {
          log.error('Error parsing article body value in deployment', e)
        }
      })
  },

  deploy: async (changes: Change<InstanceElement>[]) => {
    const [articleChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        (getChangeData(change).elemID.typeName === ARTICLE_TYPE_NAME)
        && !isRemovalChange(change),
    )
    addRemovalChangesId(articleChanges)
    setUserSegmentIdForAdditionChanges(articleChanges)
    const deployResult = await deployChanges(
      articleChanges,
      async change => {
        await deployChange(
          change, client, config.apiDefinitions, ['translations'],
        )
      },
    )
    return { deployResult, leftoverChanges }
  },

  onDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
    const everyoneUserSegmentElemID = new ElemID(ZENDESK, USER_SEGMENT_TYPE_NAME, 'instance', EVERYONE)
    const everyoneUserSegmentInstance = await elementsSource.get(everyoneUserSegmentElemID)
    changes
      .filter(change => getChangeData(change).elemID.typeName === ARTICLE_TYPE_NAME)
      .map(getChangeData)
      .forEach(articleInstance => {
        removeTitleAndBody(articleInstance)
        if (articleInstance.value[USER_SEGMENT_ID_FIELD] === null) {
          articleInstance.value[USER_SEGMENT_ID_FIELD] = new ReferenceExpression(
            everyoneUserSegmentInstance.elemID,
            everyoneUserSegmentInstance,
          )
        }
      })
  },
})

export default filterCreator
