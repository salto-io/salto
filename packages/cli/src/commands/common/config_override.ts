/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { DetailedChange, Value, ElemID } from '@salto-io/adapter-api'
import { KeyedOption } from '../../types'

export type ConfigOverrideArg = {
  config?: string[]
}

export const CONFIG_OVERRIDE_OPTION: KeyedOption<ConfigOverrideArg> = {
  name: 'config',
  alias: 'C',
  required: false,
  description: 'Overriding values for configuration (format: <account>.<path>=<value>)',
  type: 'stringsList',
}

const SALTO_ENV_PREFIX = 'SALTO'
const SALTO_ENV_CONFIG_PREFIX = `${SALTO_ENV_PREFIX}_CONFIG_`

export const convertValueType = (value: string): Value => {
  try {
    return JSON.parse(value)
  } catch (e) {
    return value
  }
}

const createChangeFromEnv = ([name, value]: [string, string]): DetailedChange => {
  const [adapter, ...idPath] = name.slice(SALTO_ENV_CONFIG_PREFIX.length).split('_')
  const id = new ElemID(adapter, ElemID.CONFIG_NAME, 'instance', ElemID.CONFIG_NAME, ...idPath)
  return { id, action: 'add', data: { after: convertValueType(value) } }
}

const isSaltoConfigEnv = (entry: [string, string?]): entry is [string, string] => {
  const [name, value] = entry
  return (
    name.length > SALTO_ENV_CONFIG_PREFIX.length &&
    name.startsWith(SALTO_ENV_CONFIG_PREFIX) &&
    value !== undefined &&
    value.length > 0
  )
}

const getConfigOverridesFromEnv = (): DetailedChange[] =>
  Object.entries(process.env).filter(isSaltoConfigEnv).map(createChangeFromEnv)

const createChangeFromArg = (overrideArg: string): DetailedChange => {
  const match = overrideArg.match(/^(\w+)\.([\w.]+)=(.+)$/)
  if (match === null) {
    throw new Error(`Invalid format for config override: ${overrideArg}. should be <account>.<path>=<value>`)
  }
  const [adapter, idPath, value] = match.slice(1)
  const id = new ElemID(adapter, ElemID.CONFIG_NAME, 'instance', ElemID.CONFIG_NAME, ...idPath.split('.'))
  return { id, action: 'add', data: { after: convertValueType(value) } }
}

export const getConfigOverrideChanges = ({ config }: ConfigOverrideArg): DetailedChange[] => [
  ...getConfigOverridesFromEnv(),
  ...(config ?? []).map(createChangeFromArg),
]
