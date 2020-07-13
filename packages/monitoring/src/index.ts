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
import fs from 'fs'
import path from 'path'
import sourceMapSupport from 'source-map-support'
import { loadLocalWorkspace, fetch, preview, FetchChange } from '@salto-io/core'
import { Workspace } from '@salto-io/workspace'
import { ElemID, DetailedChange } from '@salto-io/adapter-api'
import yargs from 'yargs'
import simpleGit from 'simple-git'
import wu from 'wu'
import _ from 'lodash'
import { mapTriggerNameToChanges } from './trigger'
import { createPlanDiff, renderPDFDiffView } from './diff'
import { notify } from './notification'
import { readConfigFile, Config, validateConfig, Notification } from './config'
import { out, err } from './logger'

sourceMapSupport.install()

const stateFilePath = (envName: string): string => `salto.config/states/${envName}.jsonl`

const validateGitRepo = async (dirPath: string): Promise<void> => {
  if (!await simpleGit(dirPath).checkIsRepo()) {
    throw new Error(`${dirPath} is not a Git repository`)
  }
}

const validateEnvironmentName = (ws: Workspace, envName: string): void => {
  if (!ws.envs().includes(envName)) {
    throw new Error(`Invalid env name ${envName}. valid env names: ${ws.envs().join(',')}`)
  }
}

// copied from formatter.ts
const addMissingEmptyChanges = (changes: DetailedChange[]): DetailedChange[] => {
  const emptyChange = (id: ElemID): DetailedChange => ({
    action: 'modify',
    data: { before: undefined, after: undefined },
    id,
  })

  const formatMissingChanges = (id: ElemID, existingIds: Set<string>): DetailedChange[] => {
    const parentId = id.createParentID()
    if (id.isTopLevel() || existingIds.has(parentId.getFullName())) {
      return []
    }
    existingIds.add(parentId.getFullName())
    return [emptyChange(parentId), ...formatMissingChanges(parentId, existingIds)]
  }

  const existingIds = new Set(changes.map(c => c.id.getFullName()))
  const missingChanges = _(changes)
    .map(change => formatMissingChanges(change.id, existingIds))
    .flatten()
    .value()
  return [...changes, ...missingChanges]
}

const main = async (): Promise<number> => {
  const args = yargs
    .string('workspace')
    .demand('workspace')
    .describe('workspace', 'The workspace directory path')
    .string('env')
    .demand('env')
    .describe('env', 'The environment name to monitor')
    .string('config')
    .demand('config')
    .describe('config', 'The monitoring config file path')
    .help()
    .argv

  try {
    await validateGitRepo(args.workspace as string)
  } catch (e) {
    err(e.message)
    return 1
  }

  const git = simpleGit(args.workspace as string)
  try {
    const config: Config = await readConfigFile(args.config as string)
    validateConfig(config)

    out('Loading workspace')
    let ws = await loadLocalWorkspace(args.workspace as string)
    validateEnvironmentName(ws, args.env as string)

    out('Fetching state')
    const fetchChanges = await fetch(ws)
    await ws.updateNaclFiles([...fetchChanges.changes].map((c: FetchChange) => c.change))
    await ws.flush()

    out('Committing the updated state file')
    await git.add('.')
    await git.commit(`Update state - ${new Date().toLocaleString()}`)

    out('Overriding the state with previous state file')
    await git.checkout(['HEAD~1', stateFilePath(args.env as string)])

    ws = await loadLocalWorkspace(args.workspace as string)

    out('Find changes using salto preview')
    const plan = await preview(ws)

    out('Rendering diff file')
    const diff = await renderPDFDiffView(await createPlanDiff(plan.itemsByEvalOrder()))

    const changeGroups = wu(plan.itemsByEvalOrder()).map(item => item.detailedChanges())
    const sortedChanges = wu(changeGroups)
      .map(changes => [...changes])
      // Fill in all missing "levels" of each change group
      .map(addMissingEmptyChanges)
      // Sort changes so they show up nested correctly
      .map(changes => _.sortBy(changes, change => change.id.getFullName()))
      .toArray()

    const triggerNameToChanges = mapTriggerNameToChanges(config.triggers, _.flatten(sortedChanges))
    const notifyPromises = config.notifications.map((notification: Notification) => {
      const triggered = _.pickBy(triggerNameToChanges,
        (changes: DetailedChange[], triggerName: string) =>
          notification.triggers.includes(triggerName) && changes.length > 0)
      if (!_.isEmpty(triggered)) {
        return notify(notification, _.flatten(_.values(triggered)), config, diff)
      }
      return false
    })
    await Promise.all(_.flatten(notifyPromises).filter(n => n !== false))
  } catch (e) {
    err(e.message)
    return 1
  } finally {
    if (fs.existsSync(path.join(args.workspace as string, stateFilePath(args.env as string)))) {
      await git.checkout(['HEAD', stateFilePath(args.env as string)])
    }
  }
  out('Finished successfully')
  return 0
}

main().then(exitCode => process.exit(exitCode))
