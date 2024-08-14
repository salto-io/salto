/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { isInstanceChange, getChangeData, isAdditionChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { isAllFreeLicense } from '../../utils'
import { PERMISSION_SCHEME_TYPE_NAME } from '../../constants'
import { FilterCreator } from '../../filter'

/**
 * prevents deployment of permission schemes if cloud free plan.
 * Permission schemes that should not be deployed are blocked in the change validator.
 * Permissions schemes that arrived here have a connected project,
 * so issuing an error in the the change validator would fail the deployment of the project as well.
 */
const filter: FilterCreator = ({ client, elementsSource }) => ({
  name: 'deployPermissionSchemeFilter',
  deploy: async changes => {
    if (client.isDataCenter || !(await isAllFreeLicense(elementsSource))) {
      return {
        leftoverChanges: changes,
        deployResult: {
          appliedChanges: [],
          errors: [],
        },
      }
    }
    // the condition for the filter should also include that the matching project is deployed,
    // but we don't have a way to know that at this point and addition is blocked anyway
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        isInstanceChange(change) &&
        isAdditionChange(change) &&
        getChangeData(change).elemID.typeName === PERMISSION_SCHEME_TYPE_NAME,
    )
    return {
      leftoverChanges,
      deployResult: {
        errors: [],
        appliedChanges: relevantChanges,
      },
    }
  },
})
export default filter
