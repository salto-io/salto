/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import {
  ReferenceExpression,
  isAdditionOrModificationChange,
  getChangeData,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { FilterCreator } from '../../filter'
import { SCRIPTED_FIELD_TYPE } from '../../constants'

// This filter is used to add the issue type names to the scripted fields
const filter: FilterCreator = ({ config }) => ({
  name: 'scriptedFieldsIssueTypesFilter',
  preDeploy: async changes => {
    if (!config.fetch.enableScriptRunnerAddon) {
      return
    }
    changes
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === SCRIPTED_FIELD_TYPE)
      .filter(instance => instance.value.issueTypes !== undefined)
      .forEach(instance => {
        instance.value.issueTypeIds = instance.value.issueTypes
          .filter(isResolvedReferenceExpression)
          .map((issueTypeId: ReferenceExpression) => issueTypeId.value.value.id)
      })
  },
  onDeploy: async changes => {
    if (!config.fetch.enableScriptRunnerAddon) {
      return
    }

    changes
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === SCRIPTED_FIELD_TYPE)
      .forEach(instance => {
        delete instance.value.issueTypeIds
      })
  },
})
export default filter
