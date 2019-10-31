import { deploy, PlanItem } from 'salto'
import { createCommandBuilder } from '../command_builder'
import { CliCommand, CliOutput, ParsedCliInput, WriteStream, CliExitCode } from '../types'
import {
  createActionStartOutput, createActionInProgressOutput, createItemDoneOutput,
} from '../formatter'
import { shouldDeploy, getConfigFromUser } from '../callbacks'
import { loadWorkspace } from '../workspace'


const CURRENT_ACTION_POLL_INTERVAL = 5000

export class DeployCommand implements CliCommand {
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
    const { workspace, errored } = await loadWorkspace(this.workspaceDir, this.stderr)
    if (errored) {
      return CliExitCode.AppError
    }
    await deploy(workspace,
      getConfigFromUser,
      shouldDeploy({ stdout: this.stdout, stderr: this.stderr }),
      (action: PlanItem) => this.updateCurrentAction(action), this.force)
    this.endCurrentAction()
    return CliExitCode.Success
  }
}

type DeployArgs = {
   yes: boolean
}
type DeployParsedCliInput = ParsedCliInput<DeployArgs>

const deployBuilder = createCommandBuilder({
  options: {
    command: 'deploy',
    aliases: ['a'],
    description: 'Applies changes to the target services',
    keyed: {
      yes: {
        describe: 'Do not ask for approval before deploying',
        boolean: true,
      },
    },
  },

  async build(input: DeployParsedCliInput, output: CliOutput): Promise<CliCommand> {
    return new DeployCommand('.', input.args.yes, output)
  },
})

export default deployBuilder
