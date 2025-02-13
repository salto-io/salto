/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { BuiltinTypes, ConfigCreator, ElemID, InstanceElement, ObjectType, Value } from '@salto-io/adapter-api'
import { createDefaultInstanceFromType, createOptionsTypeGuard } from '@salto-io/adapter-utils'
import { configType } from './config/config'
import * as constants from './constants'

const optionsElemId = new ElemID(constants.JIRA, 'configOptionsType')

type ConfigOptionsType = {
  enableScriptRunnerAddon: boolean
  enableJSM?: boolean
}

export const optionsType = (jiraOptionsContext?: InstanceElement): ObjectType => {
  const fields: Value = {
    enableScriptRunnerAddon: { refType: BuiltinTypes.BOOLEAN },
  }
  if (!jiraOptionsContext?.value.isDataCenter) {
    fields.enableJSM = { refType: BuiltinTypes.BOOLEAN }
  }
  return new ObjectType({
    elemID: optionsElemId,
    fields,
  })
}

export const getConfig = async (options?: InstanceElement): Promise<InstanceElement> => {
  const defaultConf = await createDefaultInstanceFromType(ElemID.CONFIG_NAME, configType)
  if (options !== undefined && createOptionsTypeGuard<ConfigOptionsType>(optionsElemId)(options)) {
    if (options.value.enableScriptRunnerAddon) {
      defaultConf.value.fetch.enableScriptRunnerAddon = true
    }
    if (options.value.enableJSM) {
      defaultConf.value.fetch.enableJSM = true
      defaultConf.value.fetch.enableJSMPremium = true
    }
  }
  return defaultConf
}

export const configCreator: ConfigCreator = {
  optionsType,
  getConfig,
}
