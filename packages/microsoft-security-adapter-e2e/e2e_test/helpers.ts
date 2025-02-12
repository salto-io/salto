/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { ChangeError, DetailedChangeWithBaseChange, InstanceElement, toChange } from '@salto-io/adapter-api'
import { getDetailedChanges } from '@salto-io/adapter-utils'
import { e2eUtils } from '@salto-io/microsoft-security-adapter'
import { ValidationError } from '@salto-io/workspace'
import { modificationChangesBeforeAndAfterOverrides } from './mock_elements'
import './jest_matchers'

const {
  entraConstants: { TOP_LEVEL_TYPES: entraTopLevelTypes },
} = e2eUtils

export const getModificationDetailedChangesFromInstances = ({
  firstFetchInstances,
  instancesToModify,
}: {
  firstFetchInstances: InstanceElement[]
  instancesToModify: InstanceElement[]
}): DetailedChangeWithBaseChange[] => {
  const firstFetchInstancesByElemID = _.keyBy(firstFetchInstances, inst => inst.elemID.getFullName())
  const changes = instancesToModify.map(afterPartial => {
    const before = firstFetchInstancesByElemID[afterPartial.elemID.getFullName()]
    expect(before).toBeDefinedWithElemID(afterPartial.elemID)
    const after = before.clone()
    _.merge(after.value, afterPartial.value)
    return toChange({ before, after })
  })
  return changes.flatMap(change => getDetailedChanges(change))
}

export const getModificationDetailedChangesForCleanup = (
  instancesToModify: InstanceElement[],
): DetailedChangeWithBaseChange[] => {
  const changes = instancesToModify.map(before => {
    const after = before.clone()
    _.merge(after.value, modificationChangesBeforeAndAfterOverrides[before.elemID.typeName].before)
    return toChange({ before, after })
  })
  return changes.flatMap(change => getDetailedChanges(change))
}

// These are expected CV errors when adding a new Application or ServicePrincipal instance
export const microsoftSecurityDeployChangeErrorFilter = (error: ChangeError): boolean => {
  const builtInReadOnlyFieldsValidationFilter = (): boolean =>
    error.severity === 'Warning' &&
    error.detailedMessage.includes('The following read-only fields were changed and cannot be deployed:')

  const credentialsSetupValidationFilter = (): boolean =>
    error.severity === 'Info' &&
    (error.detailedMessage.includes('The newly created app registration may require additional credentials setup.') ||
      error.detailedMessage.includes('The newly created application may require additional credentials setup.'))

  return !builtInReadOnlyFieldsValidationFilter() && !credentialsSetupValidationFilter()
}

// TODO SALTO-7238: Remove this filter once we better handle the domain name references
export const microsoftSecurityCleanupValidationFilter = (error: ValidationError): boolean =>
  !(
    error.elemID
      .getFullName()
      .includes('microsoft_security.EntraDomain.instance.e2eAdapter_onmicrosoft_com@v.domainNameReferences.') &&
    error.message === 'Element has unresolved references'
  )

// TODO SALTO-7238: Remove this filter once we better handle the domain name references
export const microsoftSecurityCleanupChangeErrorFilter = (error: ChangeError): boolean =>
  !(
    error.severity === 'Warning' &&
    error.elemID.typeName === entraTopLevelTypes.GROUP_TYPE_NAME &&
    error.message === 'Some elements contain references to this deleted element'
  )
