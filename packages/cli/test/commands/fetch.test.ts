import _ from 'lodash'
import { ElemID, ObjectType } from 'adapter-api'
import {
  Workspace, fetch, loadConfig, FetchChange, DetailedChange,
} from 'salto'
import { command, fetchCommand } from '../../src/commands/fetch'
import { MockWriteStream, getWorkspaceErrors, dummyChanges } from '../mocks'

jest.mock('salto', () => ({
  ...require.requireActual('salto'),
  fetch: jest.fn().mockImplementation(() => Promise.resolve({ changes: [], mergeErrors: [] })),
  Workspace: {
    load: jest.fn().mockImplementation(
      config => ({ config, elements: [], hasErrors: () => false }),
    ),
  },
  loadConfig: jest.fn().mockImplementation(
    workspaceDir => ({ baseDir: workspaceDir, additionalBlueprints: [], cacheLocation: '' })
  ),
}))

describe('fetch command', () => {
  const workspaceDir = 'dummy_dir'

  let cliOutput: { stdout: MockWriteStream; stderr: MockWriteStream }
  beforeEach(() => {
    cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
  })

  describe('execute', () => {
    describe('with errored workspace', () => {
      const erroredWorkspace = {
        hasErrors: () => true,
        errors: { strings: () => ['some error'] },
        getWorkspaceErrors,
      } as unknown as Workspace

      it('should fail', async () => {
        (Workspace.load as jest.Mock).mockResolvedValueOnce(Promise.resolve(erroredWorkspace))
        await command(workspaceDir, true, false, cliOutput).execute()
        expect(cliOutput.stderr.content).toContain('Failed to load workspace')
      })
    })

    describe('with valid workspace', () => {
      beforeEach(async () => {
        await command(workspaceDir, true, false, cliOutput).execute()
      })

      it('should load the workspace from the provided directory', () => {
        expect(Workspace.load).toHaveBeenCalledWith(loadConfig(workspaceDir))
      })
      it('should call fetch', () => {
        expect(fetch).toHaveBeenCalled()
      })
    })

    describe('fetch command', () => {
      const mockFetch = jest.fn().mockResolvedValue(
        Promise.resolve({ changes: [], mergeErrors: [] })
      )
      const mockApprove = jest.fn().mockResolvedValue(Promise.resolve([]))
      describe('with valid workspace', () => {
        let mockWorkspace: Workspace
        beforeEach(() => {
          mockWorkspace = {
            hasErrors: () => false,
            elements: [],
            updateBlueprints: jest.fn(),
            flush: jest.fn(),
          } as unknown as Workspace
        })

        describe('with no upstream changes', () => {
          beforeEach(async () => {
            await fetchCommand(mockWorkspace, true, false, cliOutput, mockFetch, mockApprove)
          })
          it('should not update workspace', () => {
            expect(mockWorkspace.updateBlueprints).not.toHaveBeenCalled()
            expect(mockWorkspace.flush).not.toHaveBeenCalled()
          })
        })
        describe('with upstream changes', () => {
          beforeEach(() => {
            mockFetch.mockResolvedValueOnce(Promise.resolve({
              changes: dummyChanges.map(
                (change: DetailedChange): FetchChange => ({ change, serviceChange: change })
              ),
              mergeErrors: [],
            }))
          })
          describe('when called with force', () => {
            beforeEach(async () => {
              await fetchCommand(mockWorkspace, true, false, cliOutput, mockFetch, mockApprove)
            })
            it('should deploy all changes', () => {
              expect(mockWorkspace.updateBlueprints).toHaveBeenCalledWith(...dummyChanges)
            })
          })
          describe('when initial workspace is empty', () => {
            beforeEach(async () => {
              await fetchCommand(mockWorkspace, false, false, cliOutput, mockFetch, mockApprove)
            })
            it('should deploy all changes', () => {
              expect(mockWorkspace.updateBlueprints).toHaveBeenCalledWith(...dummyChanges)
            })
          })
          describe('when initial workspace has only config', () => {
            beforeEach(async () => {
              _.set(mockWorkspace, 'elements', [new ObjectType({ elemID: new ElemID('adapter') })])
              await fetchCommand(mockWorkspace, false, false, cliOutput, mockFetch, mockApprove)
            })
            it('should deploy all changes', () => {
              expect(mockWorkspace.updateBlueprints).toHaveBeenCalledWith(...dummyChanges)
            })
          })
          describe('when initial workspace is not empty', () => {
            beforeEach(() => {
              _.set(mockWorkspace, 'elements', [new ObjectType({ elemID: new ElemID('adapter', 'type') })])
            })
            describe('if no change is approved', () => {
              beforeEach(async () => {
                await fetchCommand(mockWorkspace, false, false, cliOutput, mockFetch, mockApprove)
              })
              it('should not update workspace', () => {
                expect(mockWorkspace.updateBlueprints).not.toHaveBeenCalled()
                expect(mockWorkspace.flush).not.toHaveBeenCalled()
              })
            })
            describe('if some changes are approved', () => {
              beforeEach(async () => {
                mockApprove.mockImplementationOnce(changes => [changes[0]])
              })
              it('should update workspace only with approved changes', async () => {
                await fetchCommand(mockWorkspace, false, false, cliOutput, mockFetch, mockApprove)
                expect(mockWorkspace.updateBlueprints).toHaveBeenCalledWith(dummyChanges[0])
                expect(mockWorkspace.flush).toHaveBeenCalledTimes(1)
              })

              it('should exit if errors identified in workspace after update', async () => {
                mockWorkspace.getWorkspaceErrors = () => [{
                  sourceFragments: [],
                  error: 'Error',
                  severity: 'Error',
                }]
                mockWorkspace.hasErrors = () => (true)

                await fetchCommand(mockWorkspace, false, false, cliOutput, mockFetch, mockApprove)
                expect(mockWorkspace.updateBlueprints).toHaveBeenCalledWith(dummyChanges[0])
                expect(cliOutput.stderr.content).toContain('Failed to load workspace')
                expect(cliOutput.stderr.content).toContain('Error')
                expect(mockWorkspace.flush).not.toHaveBeenCalled()
              })
              it('should not exit if warning identified in workspace after update', async () => {
                mockWorkspace.getWorkspaceErrors = () => [{
                  sourceFragments: [],
                  error: 'Warning',
                  severity: 'Warning',
                }]
                mockWorkspace.hasErrors = () => true

                await fetchCommand(mockWorkspace, false, false, cliOutput, mockFetch, mockApprove)
                expect(mockWorkspace.updateBlueprints).toHaveBeenCalledWith(dummyChanges[0])
                expect(cliOutput.stderr.content).toContain('Failed to load workspace')
                expect(cliOutput.stderr.content).toContain('Warning')
                expect(mockWorkspace.flush).toHaveBeenCalled()
              })
            })
          })
        })
      })
    })
  })
})
