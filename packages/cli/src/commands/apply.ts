import { apply, PlanItem, Workspace, loadConfig } from 'salto'
import { createCommandBuilder } from '../command_builder'
import { CliCommand, CliOutput, ParsedCliInput, WriteStream, CliExitCode } from '../types'
import {
  createActionStartOutput, createActionInProgressOutput, createItemDoneOutput,
  formatWorkspaceErrors,
} from '../formatter'
import { shouldApply, getConfigFromUser } from '../callbacks'


const CURRENT_ACTION_POLL_INTERVAL = 5000

export class ApplyCommand implements CliCommand {
  readonly stdout: WriteStream
  readonly stderr: WriteStream
  private currentAction: PlanItem | undefined
  private currentActionStartTime: Date | undefined
  private currentActionPollerID: ReturnType<typeof setTimeout> | undefined

  constructor(
    private readonly workspaceDir: string,
    readonly force: boolean,
    { stdout, stderr }: CliOutput
  ) {
    this.stdout = stdout
    this.stderr = stderr
  }

  endCurrentAction(): void {
    if (this.currentActionPollerID && this.currentAction && this.currentActionStartTime) {
      clearInterval(this.currentActionPollerID)
      this.stdout.write(createItemDoneOutput(this.currentAction, this.currentActionStartTime))
    }
    this.currentAction = undefined
  }

  pollCurrentAction(): void {
    if (this.currentActionStartTime && this.currentAction) {
      this.stdout.write(
        createActionInProgressOutput(this.currentAction, this.currentActionStartTime)
      )
    }
  }

  updateCurrentAction(action: PlanItem): void {
    this.endCurrentAction()
    this.currentAction = action
    this.currentActionStartTime = new Date()
    this.stdout.write(createActionStartOutput(action))
    this.currentActionPollerID = setInterval(this.pollCurrentAction, CURRENT_ACTION_POLL_INTERVAL)
  }

  async execute(): Promise<CliExitCode> {
    const config = await loadConfig(this.workspaceDir)
    const workspace: Workspace = await Workspace.load(config)
    if (workspace.hasErrors()) {
      this.stderr.write(formatWorkspaceErrors(workspace.getWorkspaceErrors()))
      return CliExitCode.AppError
    }
    await apply(workspace,
      getConfigFromUser,
      shouldApply({ stdout: this.stdout, stderr: this.stderr }),
      (action: PlanItem) => this.updateCurrentAction(action), this.force)
    this.endCurrentAction()
    return CliExitCode.Success
  }
}

type ApplyArgs = {
   yes: boolean
}
type ApplyParsedCliInput = ParsedCliInput<ApplyArgs>

const applyBuilder = createCommandBuilder({
  options: {
    command: 'apply',
    aliases: ['a'],
    description: 'Applies changes to the target services',
    keyed: {
      yes: {
        describe: 'Do not ask for approval before applying',
        boolean: true,
      },
    },
  },

  async build(input: ApplyParsedCliInput, output: CliOutput): Promise<CliCommand> {
    return new ApplyCommand('.', input.args.yes, output)
  },
})

export default applyBuilder
