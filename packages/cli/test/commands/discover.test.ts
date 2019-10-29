import _ from 'lodash'
import { ElemID, ObjectType } from 'adapter-api'
import {
  Workspace, discover, loadConfig, DetailedChange,
} from 'salto'
import { command, discoverCommand } from '../../src/commands/discover'
import { MockWriteStream, getWorkspaceErrors } from '../mocks'

jest.mock('salto', () => ({
  ...require.requireActual('salto'),
  discover: jest.fn().mockImplementation(() => Promise.resolve([])),
  Workspace: {
    load: jest.fn().mockImplementation(
      config => ({ config, elements: [], hasErrors: () => false }),
    ),
  },
  loadConfig: jest.fn().mockImplementation(
    workspaceDir => ({ baseDir: workspaceDir, additionalBlueprints: [], cacheLocation: '' })
  ),
}))

describe('discover command', () => {
  const workspaceDir = 'dummy_dir'

  let cliOutput: { stdout: MockWriteStream; stderr: MockWriteStream }
  beforeEach(() => {
    cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
  })

  describe('execute', () => {
    beforeEach(async () => {
      await command(workspaceDir, true, cliOutput).execute()
    })
    it('should load the workspace from the provided directory', () => {
      expect(Workspace.load).toHaveBeenCalledWith(loadConfig(workspaceDir))
    })
    it('should call discover', () => {
      expect(discover).toHaveBeenCalled()
    })
  })

  describe('discoverCommand', () => {
    const mockDiscover = jest.fn().mockResolvedValue(Promise.resolve([]))
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
          await discoverCommand(mockWorkspace, true, cliOutput, mockDiscover, mockApprove)
        })
        it('should not update workspace', () => {
          expect(mockWorkspace.updateBlueprints).not.toHaveBeenCalled()
          expect(mockWorkspace.flush).not.toHaveBeenCalled()
        })
      })
      describe('with upstream changes', () => {
        const dummyChanges: DetailedChange[] = [
          {
            id: new ElemID('adapter', 'dummy'),
            action: 'add',
            data: { after: 'asd' },
          },
          {
            id: new ElemID('adapter', 'other'),
            action: 'remove',
            data: { before: 'asd' },
          },
        ]
        beforeEach(() => {
          mockDiscover.mockResolvedValueOnce(Promise.resolve(dummyChanges))
        })
        describe('when called with force', () => {
          beforeEach(async () => {
            await discoverCommand(mockWorkspace, true, cliOutput, mockDiscover, mockApprove)
          })
          it('should apply all changes', () => {
            expect(mockWorkspace.updateBlueprints).toHaveBeenCalledWith(...dummyChanges)
          })
        })
        describe('when initial workspace is empty', () => {
          beforeEach(async () => {
            await discoverCommand(mockWorkspace, false, cliOutput, mockDiscover, mockApprove)
          })
          it('should apply all changes', () => {
            expect(mockWorkspace.updateBlueprints).toHaveBeenCalledWith(...dummyChanges)
          })
        })
        describe('when initial workspace has only config', () => {
          beforeEach(async () => {
            _.set(mockWorkspace, 'elements', [new ObjectType({ elemID: new ElemID('adapter') })])
            await discoverCommand(mockWorkspace, false, cliOutput, mockDiscover, mockApprove)
          })
          it('should apply all changes', () => {
            expect(mockWorkspace.updateBlueprints).toHaveBeenCalledWith(...dummyChanges)
          })
        })
        describe('when initial workspace is not empty', () => {
          beforeEach(() => {
            _.set(mockWorkspace, 'elements', [new ObjectType({ elemID: new ElemID('adapter', 'type') })])
          })
          describe('if no change is approved', () => {
            beforeEach(async () => {
              await discoverCommand(mockWorkspace, false, cliOutput, mockDiscover, mockApprove)
            })
            it('should not update workspace', () => {
              expect(mockWorkspace.updateBlueprints).not.toHaveBeenCalled()
              expect(mockWorkspace.flush).not.toHaveBeenCalled()
            })
          })
          describe('if some changes are approved', () => {
            beforeEach(async () => {
              mockApprove.mockImplementationOnce(changes => [changes[0]])
              await discoverCommand(mockWorkspace, false, cliOutput, mockDiscover, mockApprove)
            })
            it('should update workspace only with approved changes', () => {
              expect(mockWorkspace.updateBlueprints).toHaveBeenCalledWith(dummyChanges[0])
              expect(mockWorkspace.flush).toHaveBeenCalledTimes(1)
            })
          })
        })
      })
    })
    describe('with errored workspace', () => {
      const erroredWorkspace = {
        hasErrors: () => true,
        errors: { strings: () => ['some error'] },
        getWorkspaceErrors,
      } as unknown as Workspace

      it('should fail', async () => {
        await discoverCommand(erroredWorkspace, true, cliOutput, mockDiscover, mockApprove)
        expect(cliOutput.stderr.content).toContain('Error')
      })
    })
  })
})
