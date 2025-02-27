/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  AdditionChange,
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isAdditionOrModificationChange,
  isInstanceChange,
  ModificationChange,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { APP_PROVISIONING_FIELD_NAMES, APPLICATION_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable

const hasAddedProvisioning = (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
): boolean => {
  const instance = getChangeData(change)

  if (isAdditionChange(change)) {
    return APP_PROVISIONING_FIELD_NAMES.some(field => instance.value[field] !== undefined)
  }
  const beforeValue = change.data.before.value
  return APP_PROVISIONING_FIELD_NAMES.some(
    field => beforeValue[field] === undefined && instance.value[field] !== undefined,
  )
}

/**
 * Validates that application provisioning cannot be added directly.
 * To deploy an application with provisioning, remove the provisioning configuration first,
 * enable it within the service, and perform a fetch.
 */
export const appProvisioningAdditionValidator: ChangeValidator = async changes =>
  awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(hasAddedProvisioning)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === APPLICATION_TYPE_NAME)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error' as const,
      message: 'Application provisioning settings cannot be added via Salto.',
      detailedMessage: `Salto cannot add provisioning settings because credentials are required to establish the initial connection. To deploy this application, remove the following provisioning fields: ${APP_PROVISIONING_FIELD_NAMES.join(', ')} if present. After deployment, configure provisioning settings directly in the Okta Admin Console. Learn more at help.salto.io/en/articles/10199943-deploying-okta-applications-using-salto#h_a3697a03a3.`,
    }))
    .toArray()
