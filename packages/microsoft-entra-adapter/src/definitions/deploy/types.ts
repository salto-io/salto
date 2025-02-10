/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions } from '@salto-io/adapter-components'
import { AdditionalAction, ClientOptions } from '../types'

type InstanceDeployApiDefinitions = definitions.deploy.InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>
export type DeployCustomDefinitions = Record<string, InstanceDeployApiDefinitions>
export type DeployRequestDefinition = definitions.deploy.DeployRequestDefinition<ClientOptions>
export type DeployableRequestDefinition = definitions.deploy.DeployableRequestDefinition<ClientOptions>
export type AdjustFunctionSingle = definitions.AdjustFunctionSingle<definitions.deploy.ChangeAndExtendedContext>
export type AdjustFunction = definitions.AdjustFunction<definitions.deploy.ChangeAndExtendedContext>
