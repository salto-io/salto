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

/* eslint-disable no-console */

import {
  Change,
  ChangeDataType,
  ChangeError,
  ChangeValidator,
  ElemID,
  InstanceElement,
  getChangeData,
  isAdditionChange,
  isInstanceChange,
  isModificationChange,
  isReferenceExpression,
  isRemovalChange,
} from '@salto-io/adapter-api'
import { GUIDE_ITEM_TYPE_NAMES, TRANSLATION_TYPE_NAMES } from '../constants'

const getLocaleChange = (
  changes: readonly Change[],
  refLocaleID: ElemID,
  mode: 'added' | 'removed',
): Change | undefined =>
  changes.find(subChange => {
    if (!isInstanceChange(subChange)) {
      return false
    }
    const subInstance = getChangeData(subChange)
    if (!TRANSLATION_TYPE_NAMES.includes(subInstance.elemID.typeName)) {
      return false
    }
    const localeRef = subInstance.value.locale
    const localeID = isReferenceExpression(localeRef) ? localeRef.elemID : null
    if (refLocaleID && localeID && localeID.isEqual(refLocaleID)) {
      return mode === 'added' ? isAdditionChange(subChange) : isRemovalChange(subChange)
    }
    return false
  })

export const createErrorMessageForDefaultTranslationValidator = (
  referenceChange: InstanceElement,
  parentGuideItem: InstanceElement,
  addedTranslation: ChangeDataType | InstanceElement,
  removedTranslation: ChangeDataType | InstanceElement,
): ChangeError => ({
  elemID: referenceChange.elemID,
  severity: 'Error',
  message: 'Cannot create a new source_locale and delete the old one in the same deployment',
  detailedMessage: `In order to change the source locale for ${parentGuideItem.elemID.getFullName()}, please separate the changes into 2 deployments.
    1. Create a new translation in the desired language (${addedTranslation.elemID.getFullName()}).
    2. Change the source local and delete the old translation (${removedTranslation.elemID.getFullName()}).`,
})

/*
 * Because of the special-casing around changes to source_local in the guide,
 * we currently don't support deployments where the user attempts to do the following things at the same time:
 * 1. Create new translation
 * 2. Change a guide item's source locale to the new created translation
 * 3. Remove the translation that used to be the item's source local
 * This CV is meant to block these deployments, and explain that they should be split into separate deployments
 */
export const guideDefaultTranslationChangeValidator: ChangeValidator = async changes =>
  changes
    .filter(isModificationChange)
    .filter(isInstanceChange)
    .filter(change => GUIDE_ITEM_TYPE_NAMES.includes(getChangeData(change).elemID.typeName))
    .filter(change => change.data.before.value.source_locale !== change.data.after.value.source_locale)
    .flatMap(change => {
      const instance = getChangeData(change)
      const newSourceLocaleID = isReferenceExpression(instance.value.source_locale)
        ? instance.value.source_locale.elemID
        : undefined
      const oldSourceLocaleID = isReferenceExpression(change.data.before.value.source_locale)
        ? change.data.before.value.source_locale.elemID
        : undefined

      const addedSourceLocale =
        newSourceLocaleID !== undefined ? getLocaleChange(changes, newSourceLocaleID, 'added') : undefined
      const removedSourceLocale =
        oldSourceLocaleID !== undefined ? getLocaleChange(changes, oldSourceLocaleID, 'removed') : undefined
      if (addedSourceLocale !== undefined && removedSourceLocale !== undefined) {
        // Out of the 3 interlinked changes, we want to "block" 2 of them: modification to the parent and removal of the translation.
        // This way, the user can deploy the creation of the new translation immediately
        return [
          createErrorMessageForDefaultTranslationValidator(
            instance,
            instance,
            getChangeData(addedSourceLocale),
            getChangeData(removedSourceLocale),
          ),
          createErrorMessageForDefaultTranslationValidator(
            getChangeData(removedSourceLocale) as InstanceElement,
            instance,
            getChangeData(addedSourceLocale),
            getChangeData(removedSourceLocale),
          ),
        ]
      }
      return []
    })
