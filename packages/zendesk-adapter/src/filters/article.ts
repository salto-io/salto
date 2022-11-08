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
  BuiltinTypes, Change, ElemID, getChangeData, InstanceElement, isAdditionChange,
  isInstanceElement, isRemovalChange, ObjectType, ReferenceExpression,
} from '@salto-io/adapter-api'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import { replaceTemplatesWithValues, resolveChangeElement } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'
import { ARTICLE_TYPE_NAME, USER_SEGMENT_TYPE_NAME, ZENDESK } from '../constants'
import { addRemovalChangesId, isTranslation } from './help_center_section_and_category'
import { lookupFunc } from './field_references'
import { removeTitleAndBody } from './help_center_fetch_article'
import { prepRef } from './article_body'

const log = logger(module)
const { awu } = collections.asynciterable
const { RECORDS_PATH } = elementsUtils

const USER_SEGMENT_ID_FIELD = 'user_segment_id'
const EVERYONE = 'Everyone'

export type TranslationType = {
  title: string
  body?: string
  locale: { id: string }
}

const EVERYONE_USER_SEGMENT = new InstanceElement(
  EVERYONE,
  new ObjectType({
    elemID: new ElemID(ZENDESK, USER_SEGMENT_TYPE_NAME),
    fields: {
      user_type: { refType: BuiltinTypes.STRING },
      built_in: { refType: BuiltinTypes.BOOLEAN },
      name: { refType: BuiltinTypes.STRING },
    },
  }),
  { user_type: EVERYONE, built_in: true, name: EVERYONE },
  [ZENDESK, RECORDS_PATH, USER_SEGMENT_TYPE_NAME, EVERYONE],
)

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
const verifyUserSegmentIdForAdditionChanges = (
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
const filterCreator: FilterCreator = ({ config, client }) => ({
  onFetch: async elements => {
    const articleInstances = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === ARTICLE_TYPE_NAME)
    if (articleInstances.length === 0) {
      return
    }

    articleInstances
      .filter(article => _.isEmpty(article.value[USER_SEGMENT_ID_FIELD]))
      .forEach(article => {
        article.value[USER_SEGMENT_ID_FIELD] = new ReferenceExpression(
          EVERYONE_USER_SEGMENT.elemID,
          EVERYONE_USER_SEGMENT,
        )
      })
    elements.push(EVERYONE_USER_SEGMENT)
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
    verifyUserSegmentIdForAdditionChanges(articleChanges)
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
    changes
      .filter(change => getChangeData(change).elemID.typeName === ARTICLE_TYPE_NAME)
      .map(getChangeData)
      .forEach(articleInstance => {
        removeTitleAndBody(articleInstance)
        if (articleInstance.value[USER_SEGMENT_ID_FIELD] === null) {
          articleInstance.value[USER_SEGMENT_ID_FIELD] = new ReferenceExpression(
            EVERYONE_USER_SEGMENT.elemID,
            EVERYONE_USER_SEGMENT,
          )
        }
      })
  },
})

export default filterCreator
