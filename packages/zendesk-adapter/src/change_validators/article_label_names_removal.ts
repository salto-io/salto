/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator, getChangeData, isInstanceChange, isModificationChange } from '@salto-io/adapter-api'
import { ARTICLE_TYPE_NAME } from '../constants'

export const articleLabelNamesRemovalValidator: ChangeValidator = async changes =>
  changes
    .filter(isModificationChange)
    .filter(isInstanceChange)
    .filter(
      change => change.data.before.value.label_names !== undefined && change.data.after.value.label_names === undefined,
    )
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === ARTICLE_TYPE_NAME)
    .flatMap(instance => [
      {
        elemID: instance.elemID,
        severity: 'Warning',
        message: 'Article labels removal is ineffective',
        detailedMessage: `To remove all the labels from ${instance.value.name}, please make sure to put an empty list under label_names field`,
      },
    ])
