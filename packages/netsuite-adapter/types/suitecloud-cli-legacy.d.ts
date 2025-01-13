/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

declare module '@salto-io/suitecloud-cli-legacy' {
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
