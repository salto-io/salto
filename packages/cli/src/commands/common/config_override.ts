/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
