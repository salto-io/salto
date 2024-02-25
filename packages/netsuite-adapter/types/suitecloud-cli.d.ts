/*
 *                      Copyright 2024 Salto Labs Ltd.
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

declare module '@salto-io/suitecloud-cli' {
  import { AdapterInstallResult, Value, Values } from '@salto-io/adapter-api'

  interface SdkDownloadServiceI {
    download(): Promise<AdapterInstallResult>
  }

  interface SdkPropertiesI {
    setCommandTimeout(commandTimeout: number): void
  }

  export class CommandsMetadataService {
    constructor()
  }

  export class CLIConfigurationService {
    constructor()
  }

  export class NodeConsoleLogger {
    constructor()
  }

  export class ActionResult {
    data: Value
    isSuccess(): boolean
  }

  export class CommandActionExecutor {
    constructor(dependencies: {
      executionPath: string
      cliConfigurationService: CLIConfigurationService
      commandsMetadataService: CommandsMetadataService
      log: NodeConsoleLogger
    })

    executeAction(context: {
      commandName: string
      runInInteractiveMode: boolean
      arguments: Values
    }): Promise<ActionResult>
  }

  export class ActionResultUtils {
    static getErrorMessagesString(actionResult: ActionResult): string
  }

  export const SdkDownloadService: SdkDownloadServiceI

  export const SdkProperties: SdkPropertiesI

  export const SDK_VERSION: string
}
