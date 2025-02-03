/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeError,
  isAdditionOrModificationChange,
  isInstanceChange,
  ChangeValidator,
  InstanceElement,
  getChangeData,
} from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { apiNameSync, isInstanceOfTypeSync } from '../filters/utils'
import { OPPORTUNITY_METADATA_TYPE } from '../constants'

type ForbiddenFilterScope = {
  parentType: string
  filterScope: string
}

// cf. https://developer.salesforce.com/docs/atlas.en-us.236.0.api_meta.meta/api_meta/meta_listview.htm#filterScope
const INVALID_FILTERSCOPES: ForbiddenFilterScope[] = [
  {
    parentType: OPPORTUNITY_METADATA_TYPE,
    filterScope: 'MyTerritory',
  },
  {
    parentType: OPPORTUNITY_METADATA_TYPE,
    filterScope: 'MyTeamTerritory',
  },
]

const isFilterScopeInvalid = (instance: InstanceElement): boolean => {
  if (apiNameSync(instance.getTypeSync()) !== 'ListView') {
    return false
  }
  const parents = getParents(instance)
  return INVALID_FILTERSCOPES.some(
    filterScopeDef =>
      parents.some(isInstanceOfTypeSync(filterScopeDef.parentType)) &&
      instance.value.filterScope === filterScopeDef.filterScope,
  )
}

const invalidListViewFilterScopeError = (element: InstanceElement): ChangeError => ({
  elemID: element.elemID,
  severity: 'Error',
  message: 'Invalid filterScope value of a ListView',
  detailedMessage: `${element.elemID.getFullName()} uses '${element.value.filterScope}' as the 'filterScope' property of a ListView element. This is not allowed by SalesForce. See https://developer.salesforce.com/docs/atlas.en-us.236.0.api_meta.meta/api_meta/meta_listview.htm#filterScope`,
})

/**
 * Some scopes are not allowed for ListViews.
 * cf. https://developer.salesforce.com/docs/atlas.en-us.236.0.api_meta.meta/api_meta/meta_listview.htm#filterScope
 */
const changeValidator: ChangeValidator = async changes => {
  const typesOfInterest = INVALID_FILTERSCOPES.map(scopeDef => scopeDef.parentType)
  return changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(elem => getParents(elem).some(isInstanceOfTypeSync(...typesOfInterest)))
    .filter(elem => isFilterScopeInvalid(elem))
    .map(invalidListViewFilterScopeError)
}

export default changeValidator
