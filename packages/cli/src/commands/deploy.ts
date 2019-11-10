import { deploy, PlanItem, ItemStatus } from 'salto'
import { getChangeElement, ActionName } from 'adapter-api'
import { setInterval } from 'timers'
import { logger } from '@salto/logging'
import { EOL } from 'os'
import Prompts from '../prompts'
import { createCommandBuilder } from '../command_builder'
import {
  CliCommand, CliOutput, ParsedCliInput, WriteStream, CliExitCode, SpinnerCreator,
} from '../types'
import {
  formatActionStart, formatItemDone,
  formatCancelAction, formatActionInProgress,
  formatItemError, deployPhaseEpilogue,
} from '../formatter'
import { shouldDeploy, getConfigFromUser } from '../callbacks'
import { loadWorkspace, updateWorkspace } from '../workspace'

const log = logger(module)

const CURRENT_ACTION_POLL_INTERVAL = 5000

type Action = {
  item: PlanItem
  startTime: Date
  pollerId: ReturnType<typeof setTimeout>
}

export class DeployCommand implements CliCommand {
  readonly stdout: WriteStream
  readonly stderr: WriteStream
  private actions: Map<string, Action>

  constructor(
    private readonly workspaceDir: string,
    readonly force: boolean,
    { stdout, stderr }: CliOutput,
    private readonly spinnerCreator: SpinnerCreator,
  ) {
    this.stdout = stdout
    this.stderr = stderr
    this.actions = new Map<string, Action>()
  }

  endAction(itemId: string): void {
    const action = this.actions.get(itemId)
    if (action) {
      if (action.startTime && action.item) {
        this.stdout.write(formatItemDone(action.item, action.startTime))
      }
      if (action.pollerId) {
        clearInterval(action.pollerId)
      }
    }
  }

  pollAction(itemId: string, actionName: ActionName, startTime: Date): void {
    this.stdout.write(formatActionInProgress(itemId, actionName, startTime))
  }

  errorAction(itemId: string, details: string): void {
    const action = this.actions.get(itemId)
    if (action) {
      this.stderr.write(formatItemError(itemId, details))
      if (action.pollerId) {
        clearInterval(action.pollerId)
      }
    }
  }

  cancelAction(itemId: string, parentItemName: string): void {
    this.stderr.write(formatCancelAction(itemId, parentItemName))
  }

  startAction(itemId: string, item: PlanItem): void {
    const startTime = new Date()
    const pollerId = setInterval(() => {
      this.pollAction(itemId, item.parent().action, startTime)
    }, CURRENT_ACTION_POLL_INTERVAL)
    const action = {
      item,
      startTime,
      pollerId,
    }
    this.actions.set(itemId, action)
    this.stdout.write(formatActionStart(item))
  }

  updateAction(item: PlanItem, status: ItemStatus, details?: string): void {
    const itemId = getChangeElement(item.parent()).elemID.getFullName()
    if (itemId) {
      if (status === 'started') {
        this.startAction(itemId, item)
      } else if (this.actions.has(itemId) && status === 'finished') {
        this.endAction(itemId)
      } else if (this.actions.has(itemId) && status === 'error' && details) {
        this.errorAction(itemId, details)
      } else if (status === 'cancelled' && details) {
        this.cancelAction(itemId, details)
      }
    }
  }

  async execute(): Promise<CliExitCode> {
    log.debug(`running deploy command on '${this.workspaceDir}' [force=${this.force}]`)
    const planSpinner = this.spinnerCreator(Prompts.PREVIEW_STARTED, {})
    const { workspace, errored } = await loadWorkspace(this.workspaceDir, this.stderr)
    if (errored) {
      planSpinner.fail(Prompts.PREVIEW_FAILED)
      return CliExitCode.AppError
    }
    planSpinner.succeed(Prompts.PREVIEW_FAILED)
    const result = await deploy(workspace,
      getConfigFromUser,
      shouldDeploy({ stdout: this.stdout, stderr: this.stderr }),
      (item: PlanItem, step: ItemStatus, details?: string) =>
        this.updateAction(item, step, details),
      this.force)
    this.stdout.write(deployPhaseEpilogue)
    this.stdout.write(EOL)
    if (result.changes) {
      const changes = [...result.changes]
      return await updateWorkspace(workspace, this.stderr, ...changes)
        ? CliExitCode.Success
        : CliExitCode.AppError
    }
    return result.sucesses ? CliExitCode.Success : CliExitCode.AppError
  }
}

type DeployArgs = {
  force: boolean
}
type DeployParsedCliInput = ParsedCliInput<DeployArgs>

const deployBuilder = createCommandBuilder({
  options: {
    command: 'deploy',
    aliases: ['dep'],
    description: 'Deploys the current blueprints config to the target services',
    keyed: {
      force: {
        alias: ['f'],
        describe: 'Do not ask for approval before deploying the changes',
        boolean: true,
        default: false,
        demandOption: false,
      },
    },
  },

  async build(
    input: DeployParsedCliInput,
    output: CliOutput,
    spinnerCreator: SpinnerCreator
  ): Promise<CliCommand> {
    return new DeployCommand('.', input.args.force, output, spinnerCreator)
  },
})

export default deployBuilder
