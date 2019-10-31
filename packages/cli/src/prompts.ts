import chalk from 'chalk'

export default class Prompts {
  public static readonly PLANNEDFORDEPLOY = ''
  public static readonly STARTDEPLOY = 'Salto-cli will start the deploy step'
  public static readonly EXPLAINDEPLOY =
    "You know what this is all about don't you?!"

  public static readonly SHOULDEXECUTREPLAN = 'Do you want to perform these actions?'

  public static readonly STARTDEPLOYEXEC = 'Starting the deploy phase'
  public static readonly CANCELDEPLOY = 'Canceling deploy'
<<<<<<< HEAD
  public static readonly PLANNEDFORPLAN = ''
=======
  public static readonly STARTPREVIEW =
    'Refreshing Salto state in-memory prior to preview...'

  public static readonly EXPLAINPREVIEW = `The refreshed state will be used to calculate this plan,
but will not be persisted to local or remote state storage`
  public static readonly PLANNEDFORPREVIEW = ''
>>>>>>> cr fixes
  public static readonly MODIFIERS = {
    modify: chalk.yellow('M'),
    add: chalk.green('+'),
    remove: chalk.red('-'),
    eq: '|',
  }

  public static readonly STARTACTION = {
    modify: 'changing',
    add: 'creating',
    remove: 'removing',
    eq: '',
  }

  public static readonly ENDACTION = {
    modify: 'Change',
    add: 'Creation',
    remove: 'Removal',
    eq: '',
  }

<<<<<<< HEAD
  public static readonly PLAN_STARTED = 'Calculating the execution plan - changes to be applied at the next *apply*'
  public static readonly PLAN_FINISHED = 'Calculated execution plan!'
  public static readonly PLAN_FAILED = 'Plan calculation failed'

  public static readonly EXPLAINPLANRESULT = `Resources and actions are indicated with the following symbols:
=======
  public static readonly EXPLAINPREVIEWRESULT = `An execution plan has been generated and is shown below.
Resources and actions are indicated with the following symbols:
>>>>>>> cr fixes

  ${Prompts.MODIFIERS.add} create
  ${Prompts.MODIFIERS.modify} change
  ${Prompts.MODIFIERS.remove} remove`

  public static readonly PLANSTEPSHEADER = 'Salto will perform the following actions:'

<<<<<<< HEAD
  public static readonly PLANDISCLAIMER = `Note: Salto cannot guarantee that exactly these actions will be performed if "salto apply" is run.
Be sure to go over the plan output when invoking the apply command.`
=======
  public static readonly PREVIEWDISCLAIMER = `Note: You did not choose the deploy option to execute the plan, so Salto cannot guarantee that 
exactly these actions will be performed if "Salto deploy" is run. Be sure to go over the plan 
output when invoking the deploy command.
`
>>>>>>> cr fixes
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

<<<<<<< HEAD
  public static readonly DISCOVER_BEGIN = 'Refreshing workspace from service(s)...'
  public static readonly DISCOVER_CHANGE_HEADER = (changeIdx: number, totalChanges: number): string => `Change ${changeIdx} of ${totalChanges}:`
  public static readonly DISCOVER_SHOULD_APPROVE_CHANGE = 'Would you like to update your workspace with this change?'
  public static readonly DISCOVER_CHANGE_REJECTED = 'The change will not be applied to your workspace'
  public static readonly DISCOVER_NO_CHANGES = 'No changes found, Workspace is up to date'
  public static readonly DISCOVER_NOTHING_TO_UPDATE = 'No changes chosen, Leaving workspace unchanged'
  public static readonly DISCOVER_CHANGES_TO_APPLY = (numChanges: number): string => `Updating workspace with ${numChanges} changes from the service`
  public static readonly DISCOVER_CONFLICTING_CHANGE = 'This change conflicts with the following pending change from your workspace:'
=======
  public static readonly FETCH_BEGIN = 'Refreshing workspace from service(s)...'
  public static readonly FETCH_CHANGE_HEADER = (changeIdx: number, totalChanges: number): string => `Change ${changeIdx} of ${totalChanges}:`
  public static readonly FETCH_SHOULD_APPROVE_CHANGE = 'Would you like to update your workspace with this change?'
  public static readonly FETCH_CHANGE_REJECTED = 'The change will not be applied to your workspace'
  public static readonly FETCH_NO_CHANGES = 'No changes found, Workspace is up to date'
  public static readonly FETCH_NOTHING_TO_UPDATE = 'No changes chosen, Leaving workspace unchanged'
  public static readonly FETCH_CHANGES_TO_APPLY = (numChanges: number): string => `Updating workspace with ${numChanges} changes from the service`
>>>>>>> cr fixes

  public static readonly WORKSPACE_LOAD_FAILED = 'Failed to load workspace'
}
