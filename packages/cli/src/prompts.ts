/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
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
  public static readonly PLAN_CHANGE_ERRS_HEADER = 'Encountered the following validations and will ignore their execution:'
  public static readonly PREVIEWDISCLAIMER = `Note: Salto cannot guarantee that exactly these actions will be performed if "salto deploy" is run.
Be sure to go over the preview output when invoking the deploy command.`

  public static readonly EMPTY_PLAN = 'Nothing to do.'

  public static readonly DESCRIBE_NEAR_MATCH =
    'Could not find what you were looking for.'

  public static readonly DID_YOU_MEAN = 'Did you mean'
  public static readonly DESCRIBE_NOT_FOUND = 'Unknown element type.'

  public static readonly COULD_NOT_FIND_FILE = 'Could not find the input file. Make sure the path you provided is correct.'
  public static readonly IMPORT_ENDED_SUMMARY = (numSuccess: number, numErrors: number): string => `Importing records from CSV file ended.\nNumber of rows imported successfully: ${numSuccess}
Number of rows with errors: ${numErrors}\n`

  public static readonly IMPORT_FINISHED_SUCCESSFULLY = 'Import operation completed successfully.'
  public static readonly DELETE_FINISHED_SUCCESSFULLY = 'Delete operation completed successfully.'
  public static readonly EXPORT_FINISHED_SUCCESSFULLY = 'Export operation completed successfully.'

  public static readonly DELETE_ENDED_SUMMARY = (numSuccess: number, numErrors: number): string => `Deleting records from CSV file ended.\nNumber of rows deleted successfully: ${numSuccess}
Number of rows with errors: ${numErrors}\n`

  public static readonly ERROR_SUMMARY = (errors: string[]): string => `The following errors were encountered:\n${errors.join('\n')}`

  public static readonly EXPORT_ENDED_SUMMARY = (numRows: number, type: string, path: string): string => `Exporting records of type ${type} to CSV file ended.\n${numRows} records were exported.
The csv file path is: ${path}\n`

  public static readonly OPERATION_FAILED_WITH_ERROR = (error: Error): string => `Operation failed: ${error.message}`

  public static initFailed(msg: string): string {
    return `Could not initiate workspace: ${msg}\n`
  }

  public static initCompleted(name: string, baseDir: string): string {
    return `Initiated empty workspace ${name} at ${baseDir}
    
Use \`salto services add <service-name>\` to add services to the workspace
`
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
  public static readonly FINISHED_LOADING_FOR_ENV = `${Prompts.FINISHED_LOADING} for environment`


  public static readonly WORKSPACE_LOAD_FAILED = (numErrors: number): string =>
    `Workspace has ${numErrors === 1 ? 'an error' : `${numErrors} errors`} - aborting!`

  public static readonly SHOULDCONTINUE = (numWarning: number): string =>
    `Workspace has ${numWarning === 1 ? 'a warning' : `${numWarning} warnings`
    } - do you want to continue?`

  public static readonly SHOULDABORT = (numErrors: number): string =>
    `Workspace has ${numErrors === 1 ? 'an error' : `${numErrors} errors`
    } - do you want to abort?`

  public static readonly CANCELED = 'Canceling...'
  public static readonly CREDENTIALS_HEADER = (serviceName: string): string => `Please enter your ${serviceName} credentials:`
  public static readonly SERVICE_HOW_ADD = (serviceName: string): string => `Use \`salto services add ${serviceName}\` to add the service to the workspace`
  public static readonly SERVICE_ADDED = (serviceName: string): string => `${serviceName} was added to the workspace`
  public static readonly SERVICES_LOGIN_UPDATED = 'Login information successfully updated!'
  public static readonly SERVICES_LOGIN_OVERRIDE = '** This will override the current login information **'
  public static readonly SERVICE_LOGIN_FAILED = (serviceName: string, errorMessage: string): string => `Could not login to ${serviceName}: ${errorMessage}`
  public static readonly SERVICE_LOGIN_FAILED_TRY_AGAIN = (serviceName: string): string => `To try again run: \`salto services login ${serviceName}\``
  public static readonly SERVICE_CONFIGURED = (serviceName: string): string => `${serviceName} is configured in this workspace`
  public static readonly SERVICE_NOT_CONFIGURED = (serviceName: string): string => `${serviceName} is not configured in this workspace`
  public static readonly CONFIGURED_SERVICES_TITLE = 'The configured services are:'
  public static readonly NO_CONFIGURED_SERVICES = 'There are not configured services in this workspace'
  public static readonly SERVICE_ALREADY_ADDED = (serviceName: string): string => `${serviceName} was already added to this workspace`
  public static readonly WORKING_ON_ENV = 'The active environment is'
  public static readonly NO_CURRENT_ENV = 'No active environment is currently set'
  public static readonly SET_ENV = 'Active environment is set to'
  public static readonly CREATED_ENV = 'Created environment'
}
