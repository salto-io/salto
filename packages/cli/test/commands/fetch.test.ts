import { ElemID, ObjectType, Element } from 'adapter-api'
import {
  Workspace, fetch, loadConfig, FetchChange, DetailedChange, FetchProgressEvents, StepEmitter,
} from 'salto'
import { EventEmitter } from 'pietile-eventemitter'
import { Spinner, SpinnerCreator, CliExitCode } from '../../src/types'
import { command, fetchCommand } from '../../src/commands/fetch'
import { MockWriteStream, getWorkspaceErrors, dummyChanges, mockSpinnerCreator, mockLoadConfig,
  elements as mockElements } from '../mocks'
import Prompts from '../../src/prompts'

jest.mock('salto', () => ({
  ...jest.requireActual('salto'),
  fetch: jest.fn().mockImplementation(() => Promise.resolve({
    changes: [],
    mergeErrors: [],
    sucess: true,
  })),
  Workspace: {
    load: jest.fn().mockImplementation(
      config => ({ config, elements: [], hasErrors: () => false }),
    ),
  },
  loadConfig: jest.fn().mockImplementation((workspaceDir: string) => mockLoadConfig(workspaceDir)),
}))


describe('fetch command', () => {
  const workspaceDir = 'dummy_dir'
  let spinners: Spinner[]
  let spinnerCreator: SpinnerCreator
  const services = ['salesforce']
  let cliOutput: { stdout: MockWriteStream; stderr: MockWriteStream }

  beforeEach(() => {
    cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
    spinners = []
    spinnerCreator = mockSpinnerCreator(spinners)
  })

  describe('execute', () => {
    describe('with errored workspace', () => {
      beforeEach(async () => {
        const erroredWorkspace = {
          hasErrors: () => true,
          errors: { strings: () => ['some error'] },
          config: { services },
          getWorkspaceErrors,
        } as unknown as Workspace
        (Workspace.load as jest.Mock).mockResolvedValueOnce(Promise.resolve(erroredWorkspace))
        await command(workspaceDir, true, false, cliOutput, spinnerCreator, services).execute()
      })

      it('should fail', async () => {
        expect(cliOutput.stderr.content).toContain('Error')
        expect(fetch).not.toHaveBeenCalled()
      })
    })

    describe('with valid workspace', () => {
      beforeEach(async () => {
        await command(workspaceDir, true, false, cliOutput, spinnerCreator, services).execute()
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
        Promise.resolve({ changes: [], mergeErrors: [], success: true })
      )
      const mockFailedFetch = jest.fn().mockResolvedValue(
        Promise.resolve({ changes: [], mergeErrors: [], success: false })
      )
      const mockEmptyApprove = jest.fn().mockResolvedValue(Promise.resolve([]))

      const mockWorkspace = (elements?: Element[]): Workspace => ({
        hasErrors: () => false,
        elements: elements || [],
        config: { services },
        updateBlueprints: jest.fn(),
        flush: jest.fn(),
      } as unknown as Workspace)

      describe('with emitters called', () => {
        const mockFetchWithEmitter: jest.Mock = jest.fn((
          _workspace,
          _services,
          progressEmitter: EventEmitter<FetchProgressEvents>
        ) => {
          const getChangesEmitter = new StepEmitter()
          progressEmitter.emit('changesWillBeFetched', getChangesEmitter, ['adapterName'])
          getChangesEmitter.emit('completed')
          const calculateDiffEmitter = new StepEmitter()
          progressEmitter.emit('diffWillBeCalculated', calculateDiffEmitter)
          calculateDiffEmitter.emit('failed')
          return Promise.resolve({ changes: [], mergeErrors: [], success: true })
        })
        beforeEach(async () => {
          await fetchCommand({
            workspace: mockWorkspace(),
            force: true,
            interactive: false,
            output: cliOutput,
            inputServices: services,
            fetch: mockFetchWithEmitter,
            getApprovedChanges: mockEmptyApprove,
          })
        })
        it('should start at least one step', () => {
          expect(cliOutput.stdout.content).toContain('>>>')
        })
        it('should finish one step', () => {
          expect(cliOutput.stdout.content).toContain('vvv')
        })
        it('should fail one step', () => {
          expect(cliOutput.stdout.content).toContain('xxx')
        })
      })
      describe('with no upstream changes', () => {
        let workspace: Workspace
        beforeEach(async () => {
          workspace = mockWorkspace()
          await fetchCommand({
            workspace,
            force: true,
            interactive: false,
            output: cliOutput,
            inputServices: services,
            fetch: mockFetch,
            getApprovedChanges: mockEmptyApprove,
          })
        })
        it('should not update workspace', () => {
          expect(workspace.updateBlueprints).not.toHaveBeenCalled()
          expect(workspace.flush).not.toHaveBeenCalled()
        })
      })
      describe('with upstream changes', () => {
        const mockFetchWithChanges = jest.fn().mockResolvedValue(
          {
            changes: dummyChanges.map(
              (change: DetailedChange): FetchChange => ({ change, serviceChange: change })
            ),
            mergeErrors: [],
            success: true,
          }
        )
        describe('when called with force', () => {
          let workspace: Workspace
          beforeEach(async () => {
            workspace = mockWorkspace()
            const result = await fetchCommand({
              workspace,
              force: true,
              interactive: false,
              inputServices: services,
              output: cliOutput,
              fetch: mockFetchWithChanges,
              getApprovedChanges: mockEmptyApprove,
            })
            expect(result).toBe(CliExitCode.Success)
          })
          it('should deploy all changes', () => {
            expect(workspace.updateBlueprints).toHaveBeenCalledWith(...dummyChanges)
          })
        })
        describe('when initial workspace is empty', () => {
          const workspace = mockWorkspace()
          beforeEach(async () => {
            await fetchCommand({
              workspace,
              force: false,
              interactive: false,
              inputServices: services,
              output: cliOutput,
              fetch: mockFetchWithChanges,
              getApprovedChanges: mockEmptyApprove,
            })
          })
          it('should deploy all changes', () => {
            expect(workspace.updateBlueprints).toHaveBeenCalledWith(...dummyChanges)
          })
        })
        describe('when initial workspace is not empty', () => {
          describe('if no change is approved', () => {
            let workspace: Workspace
            beforeEach(async () => {
              workspace = mockWorkspace([new ObjectType({ elemID: new ElemID('adapter', 'type') })])
              await fetchCommand({
                workspace,
                force: false,
                interactive: false,
                inputServices: services,
                output: cliOutput,
                fetch: mockFetchWithChanges,
                getApprovedChanges: mockEmptyApprove,
              })
            })
            it('should not update workspace', () => {
              expect(workspace.updateBlueprints).not.toHaveBeenCalled()
              expect(workspace.flush).not.toHaveBeenCalled()
            })
          })
          describe('if some changes are approved', () => {
            const mockSingleChangeApprove = jest.fn().mockImplementation(changes =>
              Promise.resolve([changes[0]]))

            it('should update workspace only with approved changes', async () => {
              const workspace = mockWorkspace(mockElements())
              await fetchCommand({
                workspace,
                force: false,
                interactive: false,
                inputServices: services,
                output: cliOutput,
                fetch: mockFetchWithChanges,
                getApprovedChanges: mockSingleChangeApprove,
              })
              expect(workspace.updateBlueprints).toHaveBeenCalledWith(dummyChanges[0])
              expect(workspace.flush).toHaveBeenCalledTimes(1)
            })

            it('should exit if errors identified in workspace after update', async () => {
              const workspace = mockWorkspace(mockElements())
              workspace.getWorkspaceErrors = async () => [{
                sourceFragments: [],
                message: 'BLA Error',
                severity: 'Error',
              }]
              workspace.hasErrors = () => true

              await fetchCommand({
                workspace,
                force: false,
                interactive: false,
                inputServices: services,
                output: cliOutput,
                fetch: mockFetchWithChanges,
                getApprovedChanges: mockSingleChangeApprove,
              })
              expect(workspace.updateBlueprints).toHaveBeenCalledWith(dummyChanges[0])
              expect(cliOutput.stderr.content).toContain('Error')
              expect(cliOutput.stderr.content).toContain('BLA Error')
              expect(workspace.flush).not.toHaveBeenCalled()
            })
            it('should not exit if warning identified in workspace after update', async () => {
              const workspace = mockWorkspace(mockElements())
              workspace.getWorkspaceErrors = async () => [{
                sourceFragments: [],
                message: 'BLA Warning',
                severity: 'Warning',
              }]
              workspace.hasErrors = () => true

              await fetchCommand({
                workspace,
                force: false,
                interactive: false,
                inputServices: services,
                output: cliOutput,
                fetch: mockFetchWithChanges,
                getApprovedChanges: mockSingleChangeApprove,
              })
              expect(workspace.updateBlueprints).toHaveBeenCalledWith(dummyChanges[0])
              expect(cliOutput.stderr.content).not.toContain(Prompts.SHOULDCONTINUE(1))
              expect(cliOutput.stdout.content).not.toContain(Prompts.SHOULDCONTINUE(1))
              expect(cliOutput.stdout.content).toContain('Warning')
              expect(cliOutput.stdout.content).toContain('BLA Warning')
              expect(workspace.flush).toHaveBeenCalled()
            })
            it('should not update workspace if fetch failed', async () => {
              const workspace = mockWorkspace(mockElements())
              await fetchCommand({
                workspace,
                force: false,
                interactive: false,
                inputServices: services,
                output: cliOutput,
                fetch: mockFailedFetch,
                getApprovedChanges: mockSingleChangeApprove,
              })
              expect(cliOutput.stderr.content).toContain('Error')
              expect(workspace.flush).not.toHaveBeenCalled()
              expect(workspace.updateBlueprints).not.toHaveBeenCalled()
            })
          })
        })
      })
    })
  })
})
