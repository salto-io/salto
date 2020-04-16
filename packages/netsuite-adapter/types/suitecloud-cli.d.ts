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

declare module '@oracle/suitecloud-sdk' {
  import { Values } from '@salto-io/adapter-api'

  namespace NodeCli {
    export class CommandsMetadataService {
      constructor(rootCLIPath: string)

      initializeCommandsMetadata(): void
    }

    export class CommandInstanceFactory {
      constructor()
    }

    export class CommandOptionsValidator {
      constructor()
    }

    export class CLIConfigurationService {
      constructor()
    }

    export class AuthenticationService {
      constructor(executionPath: string)
    }

    export class CommandOutputHandler {
      constructor()
    }

    export class CommandActionExecutor {
      constructor(dependencies: {
        executionPath: string
        commandOutputHandler: CommandOutputHandler
        commandOptionsValidator: CommandOptionsValidator
        cliConfigurationService: CLIConfigurationService
        commandInstanceFactory: CommandInstanceFactory
        authenticationService: AuthenticationService
        commandsMetadataService: CommandsMetadataService
      })

      executeAction(context: {
        commandName: string
        runInInteractiveMode: boolean
        arguments: Values
      }): Promise<OperationResult>
    }

    export class SDKOperationResultUtils {
      static hasErrors(operationResult: OperationResult): boolean
      static getErrorMessagesString(operationResult: OperationResult): string
    }

    export type OperationResultStatus = 'ERROR' | 'SUCCESS'

    export interface OperationResult {
      status: OperationResultStatus
      resultMessage?: string
      errorMessages?: string[]
    }

  }
}
