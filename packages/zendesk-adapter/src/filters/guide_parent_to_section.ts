/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isAdditionOrModificationChange,
  toChange,
  Values,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'
import { addRemovalChangesId } from './guide_section_and_category'
import {
  CATEGORY_TYPE_NAME,
  SECTION_TYPE_NAME,
  ARTICLES_FIELD,
  SECTIONS_FIELD,
  TRANSLATIONS_FIELD,
  BRAND_FIELD,
  SOURCE_LOCALE_FIELD,
} from '../constants'
import { maybeModifySourceLocaleInGuideObject } from './article/utils'

const log = logger(module)

const PARENT_SECTION_ID_FIELD = 'parent_section_id'

const deleteParentFields = (elem: InstanceElement): void => {
  delete elem.value.direct_parent_id
  delete elem.value.direct_parent_type
}

const addParentFields = (value: Values): void => {
  if (value.parent_section_id === undefined || value.parent_section_id === null) {
    value.direct_parent_id = value.category_id
    value.direct_parent_type = CATEGORY_TYPE_NAME
  } else {
    value.direct_parent_id = value.parent_section_id
    value.direct_parent_type = SECTION_TYPE_NAME
  }
}

// the fields 'direct_parent_id' and 'direct_parent_type' are created during fetch, therefore this
// filter omits these fields in preDeploy. and adds them in onDeploy. During deploy, the field
// 'parent_section_id' is ignored and is deployed as modification change separately later.
// Additionally, this filter sends a separate request when `source_locale` is modified
const filterCreator: FilterCreator = ({ client, oldApiDefinitions, definitions }) => ({
  name: 'guideParentSection',
  preDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
    changes
      .filter(change => getChangeData(change).elemID.typeName === SECTION_TYPE_NAME)
      .map(getChangeData)
      .forEach(deleteParentFields)
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [parentChanges, leftoverChanges] = _.partition(
      changes,
      change => SECTION_TYPE_NAME === getChangeData(change).elemID.typeName,
    )
    addRemovalChangesId(parentChanges)
    const deployResult = await deployChanges(parentChanges, async change => {
      const success = await maybeModifySourceLocaleInGuideObject(change, client, 'sections')
      if (!success) {
        log.error(`Attempting to modify the source_locale field in ${getChangeData(change).elemID.name} has failed `)
      }
      const fieldsToIgnore = [TRANSLATIONS_FIELD, PARENT_SECTION_ID_FIELD, ARTICLES_FIELD, SECTIONS_FIELD, BRAND_FIELD]
      if (!isAdditionChange(change)) {
        fieldsToIgnore.push(SOURCE_LOCALE_FIELD)
      }

      await deployChange({
        change,
        client,
        apiDefinitions: oldApiDefinitions,
        definitions,
        fieldsToIgnore,
      })
    })
    // need to deploy separately parent_section_id if exists since zendesk API does not support
    // parent_section_id if the data request has more fields in it.
    await deployChanges(parentChanges, async change => {
      if (isAdditionOrModificationChange(change) && getChangeData(change).value.parent_section_id !== undefined) {
        const parentSectionInstanceAfter = new InstanceElement(
          getChangeData(change).elemID.name,
          await getChangeData(change).getType(),
          {
            id: getChangeData(change).value.id,
            [PARENT_SECTION_ID_FIELD]: getChangeData(change).value.parent_section_id,
          },
        )
        const parentSectionInstanceBefore = new InstanceElement(
          getChangeData(change).elemID.name,
          await getChangeData(change).getType(),
          {
            id: getChangeData(change).value.id,
          },
        )
        await deployChange({
          change: toChange({ before: parentSectionInstanceBefore, after: parentSectionInstanceAfter }),
          client,
          apiDefinitions: oldApiDefinitions,
          definitions,
        })
      }
    })
    return { deployResult, leftoverChanges }
  },
  onDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
    changes
      .filter(change => getChangeData(change).elemID.typeName === SECTION_TYPE_NAME)
      .map(getChangeData)
      .forEach(elem => addParentFields(elem.value))
  },
})
export default filterCreator
