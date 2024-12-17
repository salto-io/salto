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

const SEARCHER_KEY = 'com.atlassian.jira.plugin.system.customfieldtypes:exacttextsearcher'
const TYPE = 'com.atlassian.jira.plugin.system.customfieldtypes:textfield'

export const fieldValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === 'Field')
    .filter(change => change.data.after.value.searcherKey === SEARCHER_KEY && change.data.after.value.type === TYPE)
    .map(change => ({
      elemID: getChangeData(change).elemID,
      severity: 'Error' as SeverityLevel,
      message: 'SearcherKey is invalid for the field type',
      detailedMessage: 'SearcherKey is invalid for the field type.',
    }))
