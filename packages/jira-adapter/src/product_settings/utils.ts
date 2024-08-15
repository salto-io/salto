/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { config } from '@salto-io/adapter-components'
import _ from 'lodash'
import { JiraApiConfig } from '../config/api_config'

export const addTypeNameOverrides = (
  configuration: JiraApiConfig,
  additionalTypes: config.TypeNameOverrideConfig[],
): JiraApiConfig => {
  const duplicateConfig = _.cloneDeep(configuration)
  if (duplicateConfig.platformSwagger.typeNameOverrides === undefined) {
    duplicateConfig.platformSwagger.typeNameOverrides = []
  }
  duplicateConfig.platformSwagger.typeNameOverrides.push(...additionalTypes)
  return duplicateConfig
}
