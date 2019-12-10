import _ from 'lodash'
import { deploy, PlanItem, ItemStatus } from 'salto'
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

const ACTION_INPROGRESS_INTERVAL = 5000

type Action = {
  item: PlanItem
  startTime: Date
  intervalId: ReturnType<typeof setTimeout>
}

export class DeployCommand implements CliCommand {
  readonly stdout: WriteStream
  readonly stderr: WriteStream
  private actions: Map<string, Action>

  constructor(
    private readonly workspaceDir: string,
    readonly force: boolean,
    readonly services: string[] | undefined,
    { stdout, stderr }: CliOutput,
    private readonly spinnerCreator: SpinnerCreator,
  ) {
    this.stdout = stdout
    this.stderr = stderr
    this.actions = new Map<string, Action>()
  }

  private endAction(itemName: string): void {
    const action = this.actions.get(itemName)
    if (action) {
      if (action.startTime && action.item) {
        this.stdout.write(formatItemDone(action.item, action.startTime))
      }
      if (action.intervalId) {
        clearInterval(action.intervalId)
      }
    }
  }

  private errorAction(itemName: string, details: string): void {
    const action = this.actions.get(itemName)
    if (action) {
      this.stderr.write(formatItemError(itemName, details))
      if (action.intervalId) {
        clearInterval(action.intervalId)
      }
    }
  }

  private cancelAction(itemName: string, parentItemName: string): void {
    this.stderr.write(formatCancelAction(itemName, parentItemName))
  }

  private startAction(itemName: string, item: PlanItem): void {
    const startTime = new Date()
    const intervalId = setInterval(() => {
      this.stdout.write(formatActionInProgress(itemName, item.parent().action, startTime))
    }, ACTION_INPROGRESS_INTERVAL)
    const action = {
      item,
      startTime,
      intervalId,
    }
    this.actions.set(itemName, action)
    this.stdout.write(formatActionStart(item))
  }

  updateAction(item: PlanItem, status: ItemStatus, details?: string): void {
    const itemName = item.getElementName()
    if (itemName) {
      if (status === 'started') {
        this.startAction(itemName, item)
      } else if (this.actions.has(itemName) && status === 'finished') {
        this.endAction(itemName)
      } else if (this.actions.has(itemName) && status === 'error' && details) {
        this.errorAction(itemName, details)
      } else if (status === 'cancelled' && details) {
        this.cancelAction(itemName, details)
      }
    }
  }

  async execute(): Promise<CliExitCode> {
    log.debug(`running deploy command on '${this.workspaceDir}' [force=${this.force}]`)
    const { workspace, errored } = await loadWorkspace(this.workspaceDir,
      { stderr: this.stderr, stdout: this.stdout }, this.spinnerCreator)
    if (errored) {
      return CliExitCode.AppError
    }

    if (this.services) {
      const diffServices = _.difference(this.services, workspace.config.services || [])
      if (diffServices.length > 0) {
        throw new Error(`Not all services (${diffServices}) are set up for this workspace`)
      }
    }

    const planSpinner = this.spinnerCreator(Prompts.PREVIEW_STARTED, {})
    const result = await deploy(workspace,
      getConfigFromUser,
      shouldDeploy(this.stdout, planSpinner),
      (item: PlanItem, step: ItemStatus, details?: string) =>
        this.updateAction(item, step, details),
      this.services,
      this.force)

    const nonErroredActions = [...this.actions.keys()]
      .filter(action => !result.errors.map(error => error.elementId).includes(action))
    this.stdout.write(deployPhaseEpilogue(nonErroredActions.length, result.errors.length))

    if (result.changes) {
      const changes = [...result.changes]
      this.stdout.write(EOL)
      return await updateWorkspace(workspace, { stderr: this.stderr, stdout: this.stdout },
        ...changes)
        ? CliExitCode.Success
        : CliExitCode.AppError
    }
    this.stdout.write(EOL)
    return result.success ? CliExitCode.Success : CliExitCode.AppError
  }
}

type DeployArgs = {
  force: boolean
  services: string[]
}
type DeployParsedCliInput = ParsedCliInput<DeployArgs>

const deployBuilder = createCommandBuilder({
  options: {
    command: 'deploy',
    description: 'Deploys the current blueprints config to the target services',
    keyed: {
      force: {
        alias: ['f'],
        describe: 'Do not ask for approval before deploying the changes',
        boolean: true,
        default: false,
        demandOption: false,
      },
      services: {
        alias: 's',
        describe: 'Specific services to perform this action for (default=all)',
        string: true,
      },
    },
  },

  async build(
    input: DeployParsedCliInput,
    output: CliOutput,
    spinnerCreator: SpinnerCreator
  ): Promise<CliCommand> {
    return new DeployCommand('.', input.args.force, input.args.services, output, spinnerCreator)
  },
})

export default deployBuilder
