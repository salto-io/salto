/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { FIELD_TYPE_NAME } from '../filters/fields/constants'

export const EXACT_TEXT_SEARCHER_KEY = 'com.atlassian.jira.plugin.system.customfieldtypes:exacttextsearcher'
export const TEXT_FIELD_TYPE = 'com.atlassian.jira.plugin.system.customfieldtypes:textfield'

export const fieldValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === FIELD_TYPE_NAME)
    .filter(
      instance => instance.value.searcherKey === EXACT_TEXT_SEARCHER_KEY && instance.value.type === TEXT_FIELD_TYPE,
    )
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'SearcherKey is invalid for the field type',
      detailedMessage:
        'This field was created using JIT and cannot be deployed. To resolve this issue, edit the NaCl file, and in the searchKey field, replace "exacttextsearcher" with "textsearcher".',
    }))
