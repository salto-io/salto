/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { definitions, deployment } from '@salto-io/adapter-components'
import { AdditionalAction, ClientOptions } from '../../types'
import { DeployCustomDefinitions } from './types'
import { createEntraCustomizations } from '../entra/deploy'
import { defaultAdjust, omitReadOnlyFields } from './utils'
import { createIntuneCustomizations } from '../intune/deploy'

const createCustomizations = (): DeployCustomDefinitions =>
  _.merge(createEntraCustomizations(), createIntuneCustomizations())

export const createDeployDefinitions = (): definitions.deploy.DeployApiDefinitions<
  AdditionalAction,
  ClientOptions
> => ({
  instances: {
    default: {
      requestsByAction: {
        default: {
          request: {
            context: deployment.helpers.DEFAULT_CONTEXT,
            transformation: {
              adjust: defaultAdjust,
            },
          },
          condition: {
            transformForCheck: {
              adjust: omitReadOnlyFields,
            },
          },
        },
        customizations: {},
      },
      changeGroupId: deployment.grouping.selfGroup,
    },
    customizations: createCustomizations(),
  },
})
