import chalk from 'chalk'

export default class Prompts {
  public static readonly SHOULDEXECUTREPLAN = 'Do you want to perform these actions?'

  public static readonly CANCELDEPLOYACTION = 'Cancelled: Due to an erroneous dependency -'
  public static readonly STARTDEPLOYEXEC = 'Starting the deployment plan'
  public static readonly FULL_DEPLOY_SUMMARY = (numChanges: number, numErrors: number): string => `Deployment partially succeeded with ${numChanges} applied change(s) and ${numErrors} error(s).`
  public static readonly CHANGES_DEPLOY_SUMMARY = (numChanges: number): string => `Deployment succeeded - ${numChanges} applied change(s).`
  public static readonly ERRORS_DEPLOY_SUMMARY = (numErrors: number): string => `Deployment failed with ${numErrors} error(s).`
  public static readonly CANCELDEPLOY = 'Canceling deploy'
  public static readonly PLANNEDFORPREVIEW = ''
  public static readonly MODIFIERS = {
    modify: chalk.yellow('M'),
    add: chalk.green('+'),
    remove: chalk.red('-'),
    eq: '|',
  }

  public static readonly STARTACTION = {
    modify: 'Changing',
    add: 'Creating',
    remove: 'Removing',
    eq: '',
  }

  public static readonly ENDACTION = {
    modify: 'Change',
    add: 'Creation',
    remove: 'Removal',
    eq: '',
  }

  public static readonly PREVIEW_STARTED = 'Calculating deployment plan'
  public static readonly PREVIEW_FINISHED = 'Calculated deployment plan!'
  public static readonly PREVIEW_FAILED = 'Deployment plan calculation failed'

  public static readonly EXPLAINPREVIEWRESULT = `Resources and actions are indicated with the following symbols:

  ${Prompts.MODIFIERS.add} create
  ${Prompts.MODIFIERS.modify} change
  ${Prompts.MODIFIERS.remove} remove`

  public static readonly PLANSTEPSHEADER = 'Salto will perform the following actions:'

  public static readonly PREVIEWDISCLAIMER = `Note: Salto cannot guarantee that exactly these actions will be performed if "salto deploy" is run.
Be sure to go over the preview output when invoking the deploy command.`

  public static readonly EMPTY_PLAN = 'Nothing to do.'

  public static readonly DESCRIBE_NEAR_MATCH =
    'Could not find what you were looking for.'

  public static readonly DID_YOU_MEAN = 'Did you mean'
  public static readonly DESCRIBE_NOT_FOUND = 'Unknown element type.'

  public static readonly COULD_NOT_FIND_FILE = 'Could not find the input file. Make sure the path you provided is correct.'
  public static readonly IMPORT_FINISHED_SUCCESSFULLY = 'Finished importing records from CSV file.'
  public static readonly DELETE_FINISHED_SUCCESSFULLY = 'Finished deleting records read from CSV file.'

  public static initFailed(msg: string): string {
    return `Could not initiate workspace: ${msg}\n`
  }

  public static initCompleted(name: string, baseDir: string): string {
    return `Initiated workspace ${name} at ${baseDir}\n`
  }

  public static readonly FETCH_BEGIN = 'Refreshing workspace from service(s)...'
  public static readonly FETCH_CHANGE_HEADER = (changeIdx: number, totalChanges: number): string => `Change ${changeIdx} of ${totalChanges}:`
  public static readonly FETCH_SHOULD_APPROVE_CHANGE = 'Would you like to update your workspace with this change?'
  public static readonly FETCH_CHANGE_REJECTED = 'The change will not be applied to your workspace'
  public static readonly FETCH_NO_CHANGES = 'No changes found, Workspace is up to date'
  public static readonly FETCH_NOTHING_TO_UPDATE = 'No changes chosen, Leaving workspace unchanged'
  public static readonly FETCH_CHANGES_TO_APPLY = (numChanges: number): string => `Updating workspace with ${numChanges} changes from the service`
  public static readonly FETCH_CONFLICTING_CHANGE = 'This change conflicts with the following pending change from your workspace:'
  public static readonly FETCH_MERGE_ERRORS = 'These errors occured as part of the fetch:'

  public static readonly WORKSPACE_LOAD_FAILED = 'Failed to load workspace'
}
