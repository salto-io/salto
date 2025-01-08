/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  ChangeError,
  ChangeValidator,
  InstanceElement,
  getChangeData,
  isAdditionChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { entraConstants } from '../../constants'

const { APPLICATION_TYPE_NAME, SERVICE_PRINCIPAL_TYPE_NAME } = entraConstants.TOP_LEVEL_TYPES

const createApplicationSetupMessage = (instance: InstanceElement): ChangeError => {
  const appType = instance.elemID.typeName === APPLICATION_TYPE_NAME ? 'app registration' : 'application'
  return {
    elemID: instance.elemID,
    severity: 'Info',
    message: `Credentials setup may be required for the new ${appType}`,
    detailedMessage: `The newly created ${appType} may require additional credentials setup.`,
    deployActions: {
      postAction: {
        title: `Complete the ${appType} setup`,
        description: `The new ${appType} (${instance.value.displayName}) currently lacks credentials. If needed, please configure credentials in the Entra admin center.`,
        showOnFailure: false,
        subActions: [],
      },
    },
  }
}
/**
 * This validator will return a message for each new application or service principal instance,
 * suggesting to complete the credentials setup in the Entra admin center.
 */
export const applicationSetupValidator: ChangeValidator = async changes =>
  changes
    .filter(isAdditionChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(instance =>
      ([APPLICATION_TYPE_NAME, SERVICE_PRINCIPAL_TYPE_NAME] as string[]).includes(instance.elemID.typeName),
    )
    .map(instance => createApplicationSetupMessage(instance))
