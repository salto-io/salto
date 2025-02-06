/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { dependencyChange, DependencyChanger, getChangeData, isInstanceChange } from '@salto-io/adapter-api'
import { getParent } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { FORM_TYPE } from '../constants'

export const formsDependencyChanger: DependencyChanger = async changes => {
  const formChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter(change => isInstanceChange(change.change) && getChangeData(change.change).elemID.typeName === FORM_TYPE)

  const formsByProject = _.groupBy(formChanges, ({ change }) => getParent(getChangeData(change)).elemID.getFullName())

  return Object.values(formsByProject).flatMap(formList =>
    formList.slice(1).map((currentForm, index) => {
      const previousForm = formList[index]
      return dependencyChange('add', previousForm.key, currentForm.key)
    }),
  )
}
