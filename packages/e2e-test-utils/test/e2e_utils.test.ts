/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

// import { initLocalWorkspace } from '@salto-io/local-workspace'
// import { addAdapter, fetch as coreFetch, fixElements, getDefaultAdapterConfig, updateCredentials } from '@salto-io/core'
// import { Workspace } from '@salto-io/workspace'
// import { InstanceElement, ElemID, ObjectType, ChangeError } from '@salto-io/adapter-api'

// import { initWorkspace, fetchWorkspace } from '../src/e2e_utils'

// // --- MOCKS ---
// jest.mock('@salto-io/local-workspace', () => ({
//   initLocalWorkspace: jest.fn(),
// }))

// jest.mock('@salto-io/core', () => ({
//   addAdapter: jest.fn(),
//   deploy: jest.fn(),
//   fetch: jest.fn(),
//   fixElements: jest.fn(),
//   getDefaultAdapterConfig: jest.fn(),
//   preview: jest.fn(),
//   updateCredentials: jest.fn(),
// }))

// jest.mock('tmp-promise', () => ({
//   dir: jest.fn().mockResolvedValue({ path: '/tmp/mockdir' }), // or any dummy path
// }))

// describe('utils tests', () => {
//   let mockWorkspace: jest.Mocked<Workspace>

//   beforeEach(() => {
//     // Reset all mock calls
//     jest.clearAllMocks()

//     // Mock a basic in-memory workspace
//     // All calls on workspace.* will be spied on
//     mockWorkspace = {
//       setCurrentEnv: jest.fn(),
//       updateNaclFiles: jest.fn(),
//       errors: jest.fn(),
//       elements: jest.fn(),
//       updateAccountConfig: jest.fn(),
//       flush: jest.fn(),
//       getWorkspaceName: jest.fn(),
//       getEnvs: jest.fn(),
//       getCurrentEnv: jest.fn(),
//       setConfigOverrides: jest.fn(),
//       hasErrors: jest.fn(),
//       accounts: jest.fn(),
//       state: jest.fn(),
//       // etc. add any method your code calls
//     } as unknown as jest.Mocked<Workspace>

//     // Typically, .errors() returns an object with parse, merge, and validation arrays
//     mockWorkspace.errors.mockResolvedValue({
//       parse: [],
//       merge: [],
//       validation: [],
//       all: () => [],
//       hasErrors: () => false,
//       strings: () => [],
//     })

//     ;(initLocalWorkspace as jest.Mock).mockResolvedValue(mockWorkspace)

//     const defaultConfig = new InstanceElement(
//       'config',
//       new ObjectType({ elemID: new ElemID('mockAdapter', 'configType') }),
//       {
//         fetch: {
//           exclude: [],
//           include: ['.*'],
//         },
//         deploy: {},
//       },
//     )
//     ;(getDefaultAdapterConfig as jest.Mock).mockResolvedValue(defaultConfig)

//   })

//   const mockAdapter = createMockAdapter('mockAdapter')

//   describe('initWorkspace', () => {
//     it('should create workspace, set env, update credentials, config, and add adapter', async () => {
//       // Arrange
//       const envName = 'testEnv'
//       const mockCredsLease = { value: { username: 'foo', password: 'bar' } }
//       const adapterName = 'mockAdapter'
//       const adapterCreators = { mockAdapter:  }
//       const credentialsType = new ObjectType({ elemID: new ElemID('test') })
//       const configOverride = { customKey: 'customVal' }

//       // Act
//       const result = await initWorkspace({
//         envName,
//         credLease: mockCredsLease,
//         adapterName,
//         configOverride,
//         adapterCreators,
//         credentialsType,
//       })

//       // Assert
//       // 1) initLocalWorkspace was called with correct params
//       expect(initLocalWorkspace).toHaveBeenCalledWith({
//         baseDir: '/tmp/mockdir',
//         envName,
//         adapterCreators,
//       })

//       // 2) Check that the workspace environment was set
//       expect(mockWorkspace.setCurrentEnv).toHaveBeenCalledWith(envName, false)

//       // 3) updateCredentials was called
//       expect(updateCredentials).toHaveBeenCalled()
//       const credInstance = (updateCredentials as jest.Mock).mock.calls[0][1] as InstanceElement
//       expect(credInstance.value).toEqual({ username: 'foo', password: 'bar' })

//       // 4) default config was fetched and merged with `configOverride`
//       expect(getDefaultAdapterConfig).toHaveBeenCalledWith({
//         adapterName,
//         accountName: adapterName,
//         adapterCreators,
//       })
//       // The final config merges default config with our override
//       expect(mockWorkspace.updateAccountConfig).toHaveBeenCalledWith(
//         adapterName,
//         expect.arrayContaining([
//           expect.objectContaining({
//             value: expect.objectContaining({
//               someDefault: true,
//               customKey: 'customVal',
//             }),
//           }),
//         ]),
//         adapterName,
//       )

//       // 5) addAdapter was called
//       expect(addAdapter).toHaveBeenCalledWith({ workspace: mockWorkspace, adapterName, adapterCreators })

//       // 6) workspace.flush was called
//       expect(mockWorkspace.flush).toHaveBeenCalled()

//       // 7) We got back the workspace
//       expect(result).toBe(mockWorkspace)
//     })
//   })

//   describe('updateWorkspace (tested indirectly via code that calls it)', () => {
//     it('should update nacl files and expect no parse/merge/validation errors', async () => {
//       // Typically, `updateWorkspace` is internal, but let's simulate calls that lead to it.
//       // For example, fetchWorkspace might call updateWorkspace behind the scenes
//       // if you pass certain parameters, or you can write a quick function that calls it.

//       // Mock a scenario where fetch returns some changes
//       ;(coreFetch as jest.Mock).mockResolvedValue({
//         success: true,
//         changes: [{ change: { action: 'add', data: {} } }],
//       })

//       await fetchWorkspace({
//         workspace: mockWorkspace,
//         adapterCreators: {},
//       })

//       // The result is that we expect:
//       // 1) fetch was called
//       expect(coreFetch).toHaveBeenCalled()

//       // 2) updateNaclFiles is called with the changes from fetch
//       expect(mockWorkspace.updateNaclFiles).toHaveBeenCalledWith([{ action: 'add', data: {} }])

//       // 3) Then we check parse, merge, validation => all empty
//       expect(mockWorkspace.errors).toHaveBeenCalled()
//       // 4) flush is called
//       expect(mockWorkspace.flush).toHaveBeenCalled()
//     })
//   })

//   describe('runFixers', () => {
//     it('should invoke fixElements and handle returned changes/errors', async () => {
//       // Suppose you have a function that triggers `runFixers` internally, or you can add an export to test it directly.
//       // We'll mock the outcome of fixElements:

//       ;(fixElements as jest.Mock).mockResolvedValue({
//         changes: [{ action: 'modify', data: { before: {}, after: {} } }],
//         errors: [
//           { elemID: new ElemID('someAdapter', 'someElem'), severity: 'Warning', message: 'test' } as ChangeError,
//         ],
//       })

//       // Let's pretend you have a function `internalRunFixers` that calls `runFixers`. We can test that:
//       // For demonstration, we’ll just do something like
//       const selectors = ['someSelector']
//       // Simulate: runFixers({ workspace: mockWorkspace, adapterCreators: {}, selectors })

//       // Now check that fixElements was called with the correct arguments
//       expect(fixElements).toHaveBeenCalledWith(
//         mockWorkspace,
//         expect.anything(), // the validSelectors
//         {}, // adapterCreators
//       )

//       // And that the function handled the returned changes and errors properly
//       // Typically, you'd have some validations:
//       // expect(...).toEqual([ ... ]) etc.
//     })
//   })
// })
