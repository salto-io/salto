/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Adapter,
  AdapterOperations,
  BuiltinTypes,
  ChangeError,
  ChangeValidator,
  DetailedChangeWithBaseChange,
  ElemID,
  FixElementsFunc,
  GetAdditionalReferencesFunc,
  InstanceElement,
  ObjectType,
} from '@salto-io/adapter-api'
import { mockFunction } from '@salto-io/test-utils'
import { deploy, DeployResult, fetch, fixElements, preview } from '@salto-io/core'
import { createElementSelectors } from '@salto-io/workspace'
import { e2eDeploy, fetchWorkspace, updateConfig } from '../src/e2e_utils'
import { mockErrors, MockWorkspace, mockWorkspace } from '../src/mocks'

const mockService = 'salto'
// const emptyMockService = 'salto2'

// const ACCOUNTS = [mockService, emptyMockService]

const mockConfigType = new ObjectType({
  elemID: new ElemID(mockService),
  fields: {
    username: { refType: BuiltinTypes.STRING },
    password: { refType: BuiltinTypes.STRING },
    token: { refType: BuiltinTypes.STRING },
    sandbox: { refType: BuiltinTypes.BOOLEAN },
  },
})

const mockAdapterOps = {
  fetch: mockFunction<AdapterOperations['fetch']>().mockResolvedValue({ elements: [] }),
  deploy: mockFunction<AdapterOperations['deploy']>().mockImplementation(({ changeGroup }) =>
    Promise.resolve({ errors: [], appliedChanges: changeGroup.changes }),
  ),
  fixElements: mockFunction<FixElementsFunc>().mockResolvedValue({ fixedElements: [], errors: [] }),
}

const mockAdapter: Adapter = {
  operations: mockFunction<Adapter['operations']>().mockReturnValue({
    ...mockAdapterOps,
    deployModifiers: { changeValidator: mockFunction<ChangeValidator>().mockResolvedValue([]) },
  }),
  authenticationMethods: { basic: { credentialsType: mockConfigType } },
  validateCredentials: mockFunction<Adapter['validateCredentials']>().mockResolvedValue({
    accountId: '',
    accountType: 'Sandbox',
    isProduction: false,
  }),
  getAdditionalReferences: mockFunction<GetAdditionalReferencesFunc>().mockResolvedValue([]),
  configCreator: {
    getConfig: mockFunction<NonNullable<Adapter['configCreator']>['getConfig']>().mockResolvedValue(
      new InstanceElement(ElemID.CONFIG_NAME, mockConfigType, { val: 'bbb' }),
    ),
    optionsType: new ObjectType({
      elemID: new ElemID('test'),
    }),
  },
  configType: new ObjectType({
    elemID: new ElemID('mockAdapter', ElemID.CONFIG_NAME),
  }),
}

const mockAdapterCreator: Record<string, Adapter> = { [mockService]: mockAdapter }
jest.mock('@salto-io/core', () => {
  const actual = jest.requireActual('@salto-io/core')
  return {
    ...actual,
    fetch: jest.fn().mockResolvedValue({ changes: [], mergeErrors: [], success: true }),
    fixElements: jest.fn().mockResolvedValue({ changes: [], errors: [] }),
    preview: jest.fn().mockResolvedValue({ changeErrors: [], size: 0 }),
    deploy: jest.fn().mockResolvedValue({ errors: [], changes: [] }),
  }
})

describe('e2e_utils', () => {
  let workspace: MockWorkspace
  let adapterCreators: Record<string, Adapter>
  beforeEach(() => {
    jest.clearAllMocks()
    workspace = mockWorkspace({ accounts: [mockService] })
    adapterCreators = mockAdapterCreator
  })
  describe('updateConfig', () => {
    it('should update the config correctly', async () => {
      const configOverride = { someKey: 'newValue' }

      await updateConfig({ workspace, adapterName: mockService, configOverride, adapterCreators })
      const newConfig = workspace.updateAccountConfig.mock.calls[0][1] as [InstanceElement]
      expect(newConfig[0].value).toEqual({ someKey: 'newValue', val: 'bbb' })
    })
  })

  describe('fetchWorkspace', () => {
    it('should fail when fetch is not successful', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({ changes: [], mergeErrors: [], success: false })
      await expect(fetchWorkspace({ workspace, adapterCreators })).rejects.toThrow()
    })

    it('should fail if there are workspace errors', async () => {
      workspace.errors.mockResolvedValueOnce(
        mockErrors([{ severity: 'Error', message: 'some error', detailedMessage: 'some error' }]),
      )
      await expect(fetchWorkspace({ workspace, adapterCreators })).rejects.toThrow()
    })

    it('it should not fail if there workspace validation errors are filtered using a validationFilter', async () => {
      workspace.errors.mockResolvedValueOnce(
        mockErrors([{ severity: 'Error', message: 'some error', detailedMessage: 'some error' }]),
      )
      await expect(
        fetchWorkspace({ workspace, adapterCreators, validationFilter: e => !(e.message === 'some error') }),
      ).resolves.not.toThrow()
    })
  })

  describe('e2eDeploy', () => {
    const envElemID = new ElemID('salto', 'env')
    const envObject = new ObjectType({
      elemID: envElemID,
      fields: {
        field: {
          refType: BuiltinTypes.STRING,
        },
      },
    })
    const commonElemID = new ElemID('salto', 'common', 'instance', 'test', 'field')
    const detailedChanges = [
      {
        action: 'remove',
        data: { before: envObject },
        baseChange: {
          action: 'remove',
          data: { before: envObject },
        },
        path: ['bla1'],
        id: envElemID,
      },
      {
        action: 'add',
        data: { after: 'a' },
        baseChange: {
          action: 'add',
          data: { after: 'a' },
        },
        path: ['bla1'],
        id: commonElemID,
      },
    ] as DetailedChangeWithBaseChange[]

    const error: ChangeError = {
      message: 'err',
      detailedMessage: 'err',
      severity: 'Error',
      elemID: new ElemID('test'),
    }

    it('make sure that fixElements runs with the correct arguments', async () => {
      await e2eDeploy({
        workspace,
        detailedChanges,
        adapterCreators,
      })
      const selectors = createElementSelectors(['salto.env', 'salto.common.instance.test'])
      expect(fixElements).toHaveBeenCalledWith(workspace, selectors.validSelectors, mockAdapterCreator)
    })

    it('should not fail if expectedFixerErrors is defined and there are errors', async () => {
      ;(fixElements as jest.Mock).mockResolvedValueOnce({ changes: [], errors: [error] })

      await expect(
        e2eDeploy({
          workspace,
          detailedChanges,
          adapterCreators,
          expectedFixerErrors: [error],
        }),
      ).resolves.not.toThrow()
    })

    it('should fail if expectedFixerErrors is not defined and there are errors', async () => {
      ;(fixElements as jest.Mock).mockResolvedValueOnce({ changes: [], errors: [error] })

      await expect(
        e2eDeploy({
          workspace,
          detailedChanges,
          adapterCreators,
        }),
      ).rejects.toThrow()
    })

    it('should filter actionPlan errors correctly', async () => {
      ;(preview as jest.Mock).mockResolvedValueOnce({ size: 0, changeErrors: [error] })

      await expect(
        e2eDeploy({
          workspace,
          detailedChanges,
          adapterCreators,
          changeErrorFilter: e => !(e.message === 'err'),
        }),
      ).resolves.not.toThrow()
    })

    it('should fail if changeErrorFilter is not defined and there are errors', async () => {
      ;(preview as jest.Mock).mockResolvedValueOnce({ size: 0, changeErrors: [error] })

      await expect(
        e2eDeploy({
          workspace,
          detailedChanges,
          adapterCreators,
        }),
      ).rejects.toThrow()
    })

    it('should not fail if changeErrorFilter is defined and there are errors', async () => {
      ;(preview as jest.Mock).mockResolvedValueOnce({ size: 0, changeErrors: [error] })

      await expect(
        e2eDeploy({
          workspace,
          detailedChanges,
          adapterCreators,
          expectedChangeErrors: [error],
        }),
      ).resolves.not.toThrow()
    })

    it('should not fail if expectedDeployErrors is defined and there are errors', async () => {
      const deployResult: DeployResult = {
        success: true,
        errors: [{ ...error, groupId: '1' }],
        changes: [],
      }
      ;(deploy as jest.Mock).mockResolvedValueOnce(deployResult)

      await expect(
        e2eDeploy({
          workspace,
          detailedChanges,
          adapterCreators,
          expectedDeployErrors: [{ ...error, groupId: '1' }],
        }),
      ).resolves.not.toThrow()
    })

    it('should fail if expectedDeployErrors is not defined and there are errors', async () => {
      const deployResult: DeployResult = {
        success: true,
        errors: [{ ...error, groupId: '1' }],
        changes: [],
      }
      ;(deploy as jest.Mock).mockResolvedValueOnce(deployResult)

      await expect(
        e2eDeploy({
          workspace,
          detailedChanges,
          adapterCreators,
        }),
      ).rejects.toThrow()
    })

    it('should call updateWorkspace after deploy with the correct changes', async () => {
      const deployResult: DeployResult = {
        success: true,
        errors: [],
        changes: [
          { change: detailedChanges[0], serviceChanges: detailedChanges },
          { change: detailedChanges[1], serviceChanges: detailedChanges },
        ],
      }
      ;(deploy as jest.Mock).mockResolvedValueOnce(deployResult)

      await e2eDeploy({
        workspace,
        detailedChanges,
        adapterCreators,
      })
      expect(workspace.updateNaclFiles).toHaveBeenCalledWith(detailedChanges)
    })

    it('should not fail if actionPlanAfterDeploySize is defined and the actionPlanAfterDeploy size is not 0', async () => {
      ;(preview as jest.Mock)
        .mockResolvedValueOnce({ size: 1, changeErrors: [] })
        .mockResolvedValueOnce({ size: 1, changeErrors: [] })

      await expect(
        e2eDeploy({
          workspace,
          detailedChanges,
          adapterCreators,
          actionPlanAfterDeploySize: 1,
        }),
      ).resolves.not.toThrow()
    })
    it('should fail if actionPlanAfterDeploySize is not defined and the actionPlanAfterDeploy size is not 0', async () => {
      ;(preview as jest.Mock)
        .mockResolvedValueOnce({ size: 1, changeErrors: [] })
        .mockResolvedValueOnce({ size: 1, changeErrors: [] })

      await expect(
        e2eDeploy({
          workspace,
          detailedChanges,
          adapterCreators,
        }),
      ).rejects.toThrow()
    })
  })
})
