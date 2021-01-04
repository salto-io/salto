/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { DetailedChange, ElemID, Value } from '@salto-io/adapter-api'
import * as mocks from '../mocks'
import { getAndValidateActiveServices } from '../../src/commands/common/services'
import { getConfigOverrideChanges } from '../../src/commands/common/config_override'

describe('Commands commons tests', () => {
  describe('getAndValidateActiveServices with workspace with services', () => {
    const mockWorkspace = mocks.mockLoadWorkspace('ws', undefined, undefined, undefined, ['service1', 'service2', 'service3'])

    it('Should return the workspaces\' services if no input services provided', () => {
      const result = getAndValidateActiveServices(mockWorkspace, undefined)
      expect(result).toEqual(mockWorkspace.services())
    })

    it('Should return the specified services is it exists in the Workspace', () => {
      const result = getAndValidateActiveServices(mockWorkspace, ['service1', 'service3'])
      expect(result).toEqual(['service1', 'service3'])
    })

    it('Should throw an errir if the service does not exist in the workspace', () => {
      expect(() => getAndValidateActiveServices(mockWorkspace, ['wtfService'])).toThrow()
    })
  })
  describe('getAndValidateActiveServices with workspace with no services', () => {
    const mockWorkspace = mocks.mockLoadWorkspace('ws', undefined, undefined, undefined, [])
    it('Should throw an error if no input services provided', () => {
      expect(() => getAndValidateActiveServices(mockWorkspace, undefined)).toThrow()
    })

    it('Should throw an error if input services were provided', () => {
      expect(() => getAndValidateActiveServices(mockWorkspace, ['wtfService'])).toThrow()
    })
  })
  describe('getConfigOverrideChanges', () => {
    const getConfigId = (adapter: string, ...idParts: string[]): ElemID => (
      new ElemID(adapter, ElemID.CONFIG_NAME, 'instance', ElemID.CONFIG_NAME, ...idParts)
    )
    const getConfigChange = (id: ElemID, value: Value): DetailedChange => (
      { id, action: 'add', data: { after: value } }
    )
    describe('with valid arguments from command line and env vars', () => {
      let changes: ReadonlyArray<DetailedChange>
      const envConfig = {
        // eslint-disable-next-line @typescript-eslint/camelcase
        SALTO_CONFIG_env_str: 'str',
        // eslint-disable-next-line @typescript-eslint/camelcase
        SALTO_CONFIG_env_num: '12',
        // eslint-disable-next-line @typescript-eslint/camelcase
        SALTO_CONFIG_env_nested_bool: 'false',
      }
      beforeEach(() => {
        Object.assign(process.env, envConfig)
        const config = [
          'arg.str=str',
          'arg.nested.obj={"num": 1, "complex": {"a": true}}',
        ]
        changes = getConfigOverrideChanges({ config })
      })
      afterEach(() => {
        Object.keys(envConfig).forEach(key => {
          delete process.env[key]
        })
      })
      it('should create changes from command line arguments', () => {
        expect(changes).toContainEqual(getConfigChange(getConfigId('arg', 'str'), 'str'))
        expect(changes).toContainEqual(
          getConfigChange(getConfigId('arg', 'nested', 'obj'), { num: 1, complex: { a: true } })
        )
      })
      it('should create changes from environment variables', () => {
        expect(changes).toContainEqual(getConfigChange(getConfigId('env', 'str'), 'str'))
        expect(changes).toContainEqual(getConfigChange(getConfigId('env', 'num'), 12))
        expect(changes).toContainEqual(getConfigChange(getConfigId('env', 'nested', 'bool'), false))
      })
      it('should put command line arguments after environment variables', () => {
        // This is important because we want values from the command line to override values
        // from the environment
        const firstEnvChange = changes.findIndex(change => change.id.adapter === 'env')
        const argChangeIndices = changes
          .map((change, idx) => ({ idx, src: change.id.adapter }))
          .filter(({ src }) => src === 'arg')
          .map(({ idx }) => idx)

        argChangeIndices.forEach(idx => expect(idx).toBeGreaterThan(firstEnvChange))
      })
    })
    describe('with invalid command arg format', () => {
      it('should throw an error', () => {
        const config = ['bla.foo']
        expect(() => getConfigOverrideChanges({ config })).toThrow()
      })
    })
    describe('with invalid environment variable format', () => {
      let changes: DetailedChange[]
      const envConfig = {
        // eslint-disable-next-line @typescript-eslint/camelcase
        SALTO_CONFIG_empty: '',
        // eslint-disable-next-line @typescript-eslint/camelcase
        NOT_SALTO_CONFIG_env_num: '12',
        // eslint-disable-next-line @typescript-eslint/camelcase
        SALTO_CONFIG: 'false',
      }
      beforeEach(() => {
        Object.assign(process.env, envConfig)
        changes = getConfigOverrideChanges({})
      })
      afterEach(() => {
        Object.keys(envConfig).forEach(key => {
          delete process.env[key]
        })
      })
      it('should not set the variable', () => {
        expect(changes).toHaveLength(0)
      })
    })
  })
})
