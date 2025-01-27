/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { DetailedChange, ElemID, Value } from '@salto-io/adapter-api'
import { mockWorkspace as mockWorkspaceUtil, MockWorkspace } from '@salto-io/e2e-test-utils'
import { getAndValidateActiveAccounts, getTagsForAccounts } from '../../src/commands/common/accounts'
import { getConfigOverrideChanges } from '../../src/commands/common/config_override'

describe('Commands commons tests', () => {
  describe('getAndValidateActiveAccounts with workspace with services', () => {
    const mockWorkspace = mockWorkspaceUtil({ accounts: ['service1', 'service2', 'service3'] })

    it("Should return the workspaces' accounts if no input accounts provided", () => {
      const result = getAndValidateActiveAccounts(mockWorkspace, undefined)
      expect(result).toEqual(mockWorkspace.accounts())
    })

    it('Should return the specified accounts is it exists in the Workspace', () => {
      const result = getAndValidateActiveAccounts(mockWorkspace, ['service1', 'service3'])
      expect(result).toEqual(['service1', 'service3'])
    })

    it('Should throw an error if the account does not exist in the workspace', () => {
      expect(() => getAndValidateActiveAccounts(mockWorkspace, ['wtfService'])).toThrow(
        `Environment ${mockWorkspace.currentEnv()} does not have an account named wtfService`,
      )
    })

    it('Should throw an error if the accounts does not exist in the workspace', () => {
      expect(() => getAndValidateActiveAccounts(mockWorkspace, ['wtfService1', 'wtfService2'])).toThrow(
        `Environment ${mockWorkspace.currentEnv()} does not have accounts named wtfService1, wtfService2`,
      )
    })
  })
  describe('getAndValidateActiveAccounts with workspace with no accounts', () => {
    const mockWorkspace = mockWorkspaceUtil({ accounts: [] })
    it('Should throw an error if no input accounts provided', () => {
      expect(() => getAndValidateActiveAccounts(mockWorkspace, undefined)).toThrow()
    })

    it('Should throw an error if input accounts were provided', () => {
      expect(() => getAndValidateActiveAccounts(mockWorkspace, ['wtfService'])).toThrow()
    })
  })
  describe('getTagsForAccounts', () => {
    let workspace: MockWorkspace

    beforeEach(() => {
      workspace = mockWorkspaceUtil({})
      workspace.accounts = jest
        .fn()
        .mockImplementation((env?: string): string[] => (env ? ['workato'] : ['salesforce', 'netsuite']))
    })
    describe('when not providing specific accounts', () => {
      it('should return tags for all the current env accounts', () => {
        expect(getTagsForAccounts({ workspace })).toStrictEqual({
          'adapter-salesforce': true,
          'adapter-netsuite': true,
        })
      })
    })
    describe('when using a different env', () => {
      it('should return tags for the other env accounts', () => {
        expect(getTagsForAccounts({ workspace, env: 'inactive' })).toStrictEqual({ 'adapter-workato': true })
      })
    })
    describe('when giving unknown accounts', () => {
      it('should return adapter tags only for valid accounts', () => {
        expect(getTagsForAccounts({ workspace, accounts: ['salesforce', 'unknownService'] })).toStrictEqual({
          'adapter-salesforce': true,
        })
      })
    })
  })
  describe('getConfigOverrideChanges', () => {
    const getConfigId = (adapter: string, ...idParts: string[]): ElemID =>
      new ElemID(adapter, ElemID.CONFIG_NAME, 'instance', ElemID.CONFIG_NAME, ...idParts)
    const getConfigChange = (id: ElemID, value: Value): DetailedChange => ({
      id,
      action: 'add',
      data: { after: value },
    })
    describe('with valid arguments from command line and env vars', () => {
      let changes: ReadonlyArray<DetailedChange>
      const envConfig = {
        SALTO_CONFIG_env_str: 'str',
        SALTO_CONFIG_env_num: '12',
        SALTO_CONFIG_env_nested_bool: 'false',
      }
      beforeEach(() => {
        Object.assign(process.env, envConfig)
        const config = ['arg.str=str', 'arg.nested.obj={"num": 1, "complex": {"a": true}}']
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
          getConfigChange(getConfigId('arg', 'nested', 'obj'), { num: 1, complex: { a: true } }),
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
        SALTO_CONFIG_empty: '',
        NOT_SALTO_CONFIG_env_num: '12',
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
