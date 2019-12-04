import chalk from 'chalk'

export default class Prompts {
  public static readonly SHOULDEXECUTEPLAN = 'Do you want to perform these actions?'

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
  public static readonly IMPORT_FINISHED_SUMMARY = (numSuccess: number, numErrors: number): string => `Finished importing records from CSV file.\nNumber of rows imported successfully: ${numSuccess}
Number of rows with errors: ${numErrors}`

  public static readonly DELETE_FINISHED_SUMMARY = (numSuccess: number, numErrors: number): string => `Finished deleting records from CSV file.\nNumber of rows deleted successfully: ${numSuccess}
Number of rows with errors: ${numErrors}`

  public static readonly EXPORT_FINISHED_SUCCESSFULLY = 'Finished exporting records to CSV file.'
  public static readonly OPERATION_FAILED = 'Operation failed.'

  public static initFailed(msg: string): string {
    return `Could not initiate workspace: ${msg}\n`
  }

  public static initCompleted(name: string, baseDir: string): string {
    return `Initiated workspace ${name} at ${baseDir}\n`
  }

  public static readonly FETCH_HEADER = 'Fetching and applying changes from the service(s)'
  public static readonly FETCH_SUB_HEADER = `This might take a few minutes. You can go grab your favorite beverage.
The steps are: I. Fetching configs, II. Calculating difference and III. Applying the changes`
  public static readonly FETCH_GET_CHANGES_START = (adapters: string[]): string => `Fetching the latest configs from: ${adapters}`
  public static readonly FETCH_GET_CHANGES_FINISH = (adapters: string[]): string => `Finished fetching the latest configs from: ${adapters}`
  public static readonly FETCH_GET_CHANGES_FAIL = 'Fetching failed'
  public static readonly FETCH_CALC_DIFF_START = 'Calculating the difference between local and remote'
  public static readonly FETCH_CALC_DIFF_FINISH = 'Finished calculating the difference between local and remote'
  public static readonly FETCH_CALC_DIFF_FAIL = 'Calculating diff failed!'
  public static readonly FETCH_UPDATE_WORKSPACE_SUCCESS = 'Applied changes'
  public static readonly FETCH_SUCCESS_FINISHED = 'Done! Your workspace is now updated with the latest changes.'
  public static readonly FETCH_UPDATE_WORKSPACE_FAIL = 'Failed to apply changes to your local workspace'
  public static readonly FETCH_CHANGE_HEADER = (changeIdx: number, totalChanges: number): string => `Change ${changeIdx} of ${totalChanges}:`
  public static readonly FETCH_SHOULD_APPROVE_CHANGE = 'Would you like to update your workspace with this change?'
  public static readonly FETCH_CHANGE_REJECTED = 'The change will not be applied to your workspace'
  public static readonly FETCH_NO_CHANGES = 'No changes found, Workspace is up to date'
  public static readonly FETCH_NOTHING_TO_UPDATE = 'No changes chosen, Leaving workspace unchanged'
  public static readonly FETCH_CHANGES_TO_APPLY = (numChanges: number): string => `Applying ${numChanges} changes to the local workspace`
  public static readonly FETCH_CONFLICTING_CHANGE = 'This change conflicts with the following pending change from your workspace:'
  public static readonly FETCH_MERGE_ERRORS = 'These errors occurred as part of the fetch:'
  public static readonly FETCH_FATAL_MERGE_ERROR_PREFIX = 'Error occurred during fetch, cause:\n'

  public static readonly LOADING_WORKSPACE = 'Loading workspace...'
  public static readonly FINISHED_LOADING = 'Finished loading workspace'

  public static readonly WORKSPACE_LOAD_FAILED = (numErrors: number): string =>
    `Workspace has ${numErrors === 1 ? 'an error' : `${numErrors} errors`} - aborting!`

  public static readonly SHOULDCONTINUE = (numWarning: number): string =>
    `Workspace has ${numWarning === 1 ? 'a warning' : `${numWarning} warnings`
    } - do you want to continue?`

  public static readonly CANCELED = 'Canceling...'
  public static readonly CONFIG_HEADER = (adapterName: string): string => `Please enter your ${adapterName} credentials:`
}
