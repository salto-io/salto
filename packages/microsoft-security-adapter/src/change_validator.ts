/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator } from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { createDeployDefinitions } from './definitions'
import { entraConstants } from './constants'
import { Options } from './definitions/types'
import changeValidators from './change_validators'

export default (): Record<string, ChangeValidator> => ({
  createCheckDeploymentBasedOnDefinitions:
    deployment.changeValidators.createCheckDeploymentBasedOnDefinitionsValidator<Options>({
      deployDefinitions: createDeployDefinitions(),
      typesDeployedViaParent: [entraConstants.APP_ROLE_TYPE_NAME],
    }),
  ...changeValidators(),
})
