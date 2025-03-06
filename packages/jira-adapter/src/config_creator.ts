/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  BuiltinTypes,
  ConfigCreator,
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
} from '@salto-io/adapter-api'
import {
  createDefaultInstanceFromType,
  createMatchingObjectType,
  createOptionsTypeGuard,
} from '@salto-io/adapter-utils'
import { configType } from './config/config'
import * as constants from './constants'

const optionsElemId = new ElemID(constants.JIRA, 'configOptionsType')
const configContextTypeElemId = new ElemID(constants.JIRA, 'configContextType')

type ConfigOptionsType = {
  enableScriptRunnerAddon?: boolean
  enableJSM?: boolean
}

type ConfigContextType = {
  isDataCenter: boolean
}

type DataCenterConfigOptionsType = Omit<ConfigOptionsType, 'enableJSM'>

export const configContextType = createMatchingObjectType<ConfigContextType>({
  elemID: configContextTypeElemId,
  fields: {
    isDataCenter: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: { _required: true },
    },
  },
  annotations: { [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false },
})

export const optionsType = createMatchingObjectType<ConfigOptionsType>({
  elemID: optionsElemId,
  fields: {
    enableScriptRunnerAddon: { refType: BuiltinTypes.BOOLEAN },
    enableJSM: { refType: BuiltinTypes.BOOLEAN },
  },
})

const jiraDataCenterOptionsType = createMatchingObjectType<DataCenterConfigOptionsType>({
  elemID: optionsElemId,
  fields: {
    enableScriptRunnerAddon: {
      refType: BuiltinTypes.BOOLEAN,
    },
  },
})

export const getOptionsType = (configContext?: InstanceElement): ObjectType =>
  configContext?.value.isDataCenter ? jiraDataCenterOptionsType : optionsType

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
  configContextType,
  getOptionsType,
  getConfig,
}
