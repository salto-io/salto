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
import sourceMapSupport from 'source-map-support'
import { loadLocalWorkspace, fetch, preview, Workspace, DetailedChange, FetchChange } from '@salto-io/core'
import { ElemID } from '@salto-io/adapter-api'
import { logger, LogLevel } from '@salto-io/logging'
import yargs from 'yargs'
import simpleGit from 'simple-git'
import wu from 'wu'
import _ from 'lodash'
import { Trigger, triggered, checkTriggers } from './trigger'
import { createPlanDiff, renderDiffView } from './diff'
import { Notification, notify } from './notification'
import { readConfigFile, Config } from './config'

sourceMapSupport.install()

const INFO_LOG_LEVEL: LogLevel = 'info'

const log = logger(module)

logger.configure({ minLevel: INFO_LOG_LEVEL })

const stateFilePath = (envName: string): string => `salto.config/states/${envName}.jsonl`

const validateGitRepo = async (dirPath: string): Promise<void> => {
  if (!await simpleGit(dirPath).checkIsRepo()) {
    throw new Error(`${dirPath} is not a Git repository`)
  }
}

const validateEnvironmentName = (ws: Workspace, envName: string): void => {
  if (!ws.envs().includes(envName)) {
    throw new Error(`Invalid env name ${envName}. valid env names ${ws.envs().join(',')}`)
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
    log.error(e)
    return 1
  }

  const git = simpleGit(args.workspace as string)
  try {
    const config: Config = await readConfigFile(args.config as string)

    log.info('Loading workspace')
    let ws = await loadLocalWorkspace(args.workspace as string)
    validateEnvironmentName(ws, args.env as string)

    log.info('Fetching state')
    const fetchChanges = await fetch(ws)
    await ws.updateNaclFiles([...fetchChanges.changes].map((c: FetchChange) => c.change))
    await ws.flush()

    log.info('Committing the updated state file')
    await git.add('.')
    await git.commit(`Update state - ${new Date().toLocaleString()}`)

    log.info('Overriding the state with previous state file')
    await git.checkout(['HEAD~1', stateFilePath(args.env as string)])

    ws = await loadLocalWorkspace(args.workspace as string)

    log.info('Find changes using salto preview')
    const plan = await preview(ws)

    log.info('Rendering html diff')
    const htmlDiff = renderDiffView(await createPlanDiff(plan.itemsByEvalOrder()))

    const changeGroups = wu(plan.itemsByEvalOrder()).map(item => item.detailedChanges())
    const hierarchyChanges = wu(changeGroups)
      .map(changes => [...changes])
      // Fill in all missing "levels" of each change group
      .map(addMissingEmptyChanges)

    const triggerNameToTrigger = _.keyBy(config.triggers, (t: Trigger) => t.name)
    hierarchyChanges
      // Sort changes so they show up nested correctly
      .map(changes => _.sortBy(changes, change => change.id.getFullName()))
      .toArray()
      .forEach(changes => checkTriggers(config.triggers, changes))

    const notifyPromises = config.notifications.map((notification: Notification) => notification
      .triggers
      .map((name: string) => triggerNameToTrigger[name])
      .filter((trigger: Trigger) => !_.isUndefined(trigger) && triggered(trigger))
      .map((trigger: Trigger) => notify(notification, trigger, htmlDiff, config.smtp)))
    await Promise.all(_.flatten(notifyPromises))
  } catch (e) {
    log.error(e)
    return 1
  } finally {
    log.info('Overriding state with updated state file')
    await git.checkout(['HEAD', stateFilePath(args.env as string)])
  }

  log.info('Finished successfully')
  await logger.end()
  return 0
}

main().then(exitCode => process.exit(exitCode))
