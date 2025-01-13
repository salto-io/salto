/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { AdapterOperations, ChangeValidator } from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { errors as wsErrors } from '@salto-io/workspace'
import _ from 'lodash'
import { getAdapterChangeValidators } from '../../adapters'
import { checkDeploymentAnnotationsValidator } from './check_deployment_annotations'
import { incomingUnresolvedReferencesValidator } from './incoming_unresolved_references'

const { createChangeValidator } = deployment.changeValidators

const defaultChangeValidators = (errors: wsErrors.Errors): Record<string, ChangeValidator> => ({
  checkDeploymentAnnotations: checkDeploymentAnnotationsValidator,
  incomingUnresolvedReference: incomingUnresolvedReferencesValidator(errors.validation),
})

const getChangeValidators = (
  adapters: Record<string, AdapterOperations>,
  checkOnly: boolean,
  errors: wsErrors.Errors,
): Record<string, ChangeValidator> =>
  _.mapValues(getAdapterChangeValidators(adapters, checkOnly), adapterValidator =>
    createChangeValidator({
      validators: {
        ...defaultChangeValidators(errors),
        adapterValidator,
      },
    }),
  )

export default getChangeValidators
