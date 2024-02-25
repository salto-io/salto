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
import _ from 'lodash'
import os from 'os'
import osPath from 'path'
import { v4 as uuidv4 } from 'uuid'
import { mkdirp, rm, writeFile } from '@salto-io/file'
import Bottleneck from 'bottleneck'
import { SdfCredentials, toCredentialsAccountId } from '../src/client/credentials'
import SdfClient, { ALL_FEATURES, COMMANDS, safeQuoteArgument } from '../src/client/sdf_client'
import { DEFAULT_MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST } from '../src/config/constants'
import { FILE_CABINET_PATH_SEPARATOR } from '../src/constants'
import { FILE_CABINET_DIR, OBJECTS_DIR, SRC_DIR } from '../src/client/sdf_parser'

export type ProjectInfo = {
  projectPath: string
  authId: string
}
type SDFExecutor = {
  createProject: (credentials: SdfCredentials) => Promise<ProjectInfo>
  importObjects: (projectPath: string, objectIds: Array<{ type: string; scriptid: string }>) => Promise<void>
  importFiles: (projectPath: string, filePaths: string[]) => Promise<void>
  importFeatures: (projectPath: string) => Promise<void>
  deleteProject: (projectInfo: ProjectInfo) => Promise<void>
}
export const createSdfExecutor = (): SDFExecutor => {
  const baseExecutionPath = os.tmpdir()
  const baseCommandExecutor = SdfClient.initCommandActionExecutor(baseExecutionPath)
  const limiter = new Bottleneck({ maxConcurrent: 4 })

  return {
    createProject: async credentials => {
      const authId = uuidv4()
      const projectName = `sdf-${authId}`
      await baseCommandExecutor.executeAction({
        commandName: COMMANDS.CREATE_PROJECT,
        runInInteractiveMode: false,
        arguments: {
          projectname: projectName,
          type: 'ACCOUNTCUSTOMIZATION',
          parentdirectory: osPath.join(baseExecutionPath, projectName),
        },
      })
      const projectPath = osPath.resolve(baseExecutionPath, projectName)
      const executor = SdfClient.initCommandActionExecutor(projectPath)
      const setupCommandArguments = {
        authid: authId,
        account: toCredentialsAccountId(credentials.accountId),
        tokenid: credentials.tokenId,
        tokensecret: credentials.tokenSecret,
      }
      await executor.executeAction({
        commandName: COMMANDS.SAVE_TOKEN,
        runInInteractiveMode: false,
        arguments: _.mapValues(setupCommandArguments, safeQuoteArgument),
      })
      return { projectPath, authId }
    },
    importObjects: async (projectPath, objectIds) => {
      const executor = SdfClient.initCommandActionExecutor(projectPath)
      await Promise.all(
        objectIds.map(({ type, scriptid }) =>
          limiter.schedule(() =>
            executor.executeAction({
              commandName: COMMANDS.IMPORT_OBJECTS,
              runInInteractiveMode: false,
              arguments: {
                destinationfolder: `${FILE_CABINET_PATH_SEPARATOR}${OBJECTS_DIR}`,
                type,
                scriptid,
                maxItemsInImportObjectsRequest: DEFAULT_MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST,
                excludefiles: true,
                appid: undefined,
              },
            }),
          ),
        ),
      )
    },
    importFiles: async (projectPath, filePaths) => {
      const executor = SdfClient.initCommandActionExecutor(projectPath)
      await limiter.schedule(() =>
        executor.executeAction({
          commandName: COMMANDS.IMPORT_FILES,
          runInInteractiveMode: false,
          arguments: {
            paths: filePaths,
          },
        }),
      )
    },
    importFeatures: async projectPath => {
      const executor = SdfClient.initCommandActionExecutor(projectPath)
      await limiter.schedule(() =>
        executor.executeAction({
          commandName: COMMANDS.IMPORT_CONFIGURATION,
          runInInteractiveMode: false,
          arguments: {
            configurationid: ALL_FEATURES,
          },
        }),
      )
    },
    deleteProject: async ({ projectPath, authId }) => {
      await rm(projectPath)
      await baseCommandExecutor.executeAction({
        commandName: COMMANDS.MANAGE_AUTH,
        runInInteractiveMode: false,
        arguments: {
          remove: authId,
        },
      })
    },
  }
}

export const createAdditionalFiles = async (
  projectPath: string,
  files: Array<{ path: string[]; content: string }>,
): Promise<void> => {
  await Promise.all(
    files.map(async ({ path, content }) => {
      await mkdirp(osPath.join(projectPath, SRC_DIR, FILE_CABINET_DIR, ...path.slice(0, -1)))
      await writeFile(osPath.join(projectPath, SRC_DIR, FILE_CABINET_DIR, ...path), content)
    }),
  )
}
