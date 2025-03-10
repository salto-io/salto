/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  ChangeError,
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isInstanceChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import { definitions as definitionUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { BRAND_TYPE_NAME } from '../constants'
import ZendeskClient from '../client/client'
import { isBrand, invalidBrandChange } from './guide_activation'
import { Options } from '../definitions/types'

const invalidBrandAdditionChange = (
  change: Change<InstanceElement>,
  fieldToCheck: 'has_help_center' | 'help_center_state',
): boolean => {
  if (!isBrand(getChangeData(change))) {
    return false
  }
  return isAdditionChange(change) && change.data.after.value[fieldToCheck] === true
}

/**
 * We currently do not support the creation or deletion of help centers (guide) using Salto.
 * If the help center is created/deleted as part of an existing brand and no other changes are made
 * to the brand, issue a warning on the change.
 * If the help center was created during an addition of a brand, it also issues a warning.
 */
export const helpCenterCreationOrRemovalValidator: (
  client: ZendeskClient,
  definitions: definitionUtils.ApiDefinitions<Options>,
) => ChangeValidator = (client, definitions) => async changes => {
  const relevantChanges = changes
    .filter(isInstanceChange)
    .filter(change => getChangeData(change).elemID.typeName === BRAND_TYPE_NAME)
    .filter(
      change => invalidBrandChange(change, 'has_help_center') || invalidBrandAdditionChange(change, 'has_help_center'),
    )
  if (_.isEmpty(relevantChanges)) {
    return []
  }

  const defQuery = definitionUtils.queryWithDefault(definitions.fetch?.instances ?? {})
  const serviceUrl = defQuery.query(BRAND_TYPE_NAME)?.element?.topLevel?.serviceUrl?.path

  return relevantChanges.flatMap((change: Change): ChangeError[] => {
    if (isModificationChange(change)) {
      return [
        {
          elemID: getChangeData(change).elemID,
          severity: 'Warning',
          message: 'Creation or removal of help center for a brand is not supported via Salto.',
          // we expect the service url to always exist.
          detailedMessage: `Creation or removal of help center for brand ${getChangeData(change).elemID.getFullName()} is not supported via Salto.
      To create or remove a help center, please go to ${client.getUrl().href}${serviceUrl?.slice(1)}`,
        },
      ]
    }
    return [
      {
        elemID: getChangeData(change).elemID,
        severity: 'Warning',
        message: 'Creation of a brand with a help center is not supported via Salto.',
        detailedMessage: `Creation of a brand with a help center is not supported via Salto. The brand ${getChangeData(change).elemID.getFullName()} will be created without a help center. After creating the brand, 
            to create a help center, please go to ${client.getUrl().href}${serviceUrl?.slice(1)}`,
      },
    ]
  })
}
