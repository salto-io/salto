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
import tmp from 'tmp-promise'
import fs from 'fs'
import path from 'path'
import { runInit, runAddDummhService, runFetch, runCreateEnv, runDeploy, runSetEnv, runMoveToCommon, runMoveToEnvs } from './helpers/workspace'

describe('cli performence with XXX elements', () => {
  jest.setTimeout(15 * 60 * 1000)

  const WS_NAME = 'e2ePerformanceWorkspace'
  const CACHE_DIR_NAME = 'cache'
  const ENV1_NAME = 'env1'
  const ENV2_NAME = 'env2'

  let baseDir: string
  let saltoHomeDir: string

  const getDirectories = (source: string): string[] =>
    fs.readdirSync(source, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)

  const cacheDir = (): string => {
    const workspaceDir = getDirectories(saltoHomeDir)[0]
    return path.join(saltoHomeDir, workspaceDir, CACHE_DIR_NAME)
  }
  beforeAll(async () => {
    baseDir = (await tmp.dir()).path
    saltoHomeDir = (await tmp.dir()).path
    process.env.SALTO_HOME = saltoHomeDir
  })

  const getRunTime = async (func: () => Promise<void>): Promise<number> => {
    const start = new Date()
    await func()
    return (new Date().getTime()) - start.getTime()
  }

  const initRunTime = 100
  const firstFetchRunTime = 6000
  const fetchRunTime = 7500
  const createEnvRunTime = 1000 // Rly? Why?
  const deployRunTime = 100
  const deployNoCacheRunTime = 8000
  const moveToCommonRunTime = 1
  const moveToEnvsRunTime = 1
  const diffRunTime = 1

  describe('init', () => {
    let initTime: number
    beforeAll(async () => {
      initTime = await getRunTime(async () => {
        await runInit(WS_NAME, ENV1_NAME, baseDir)
        await runAddDummhService(baseDir)
      })
    })
    it(`should run init and add a service in less than ${initRunTime} ms`, () => {
      expect(initTime).toBeLessThanOrEqual(initRunTime)
    })
  })

  describe('fetching', () => {
    let fetchTime: number
    beforeAll(async () => {
      fetchTime = await getRunTime(() => runFetch(baseDir, false, ENV1_NAME, ['dummy']))
    })
    it(`should run fetch on an empty workspace in less than ${firstFetchRunTime} ms`, () => {
      expect(fetchTime).toBeLessThanOrEqual(firstFetchRunTime)
    })
  })

  describe('second fetch', () => {
    let fetchTime: number
    beforeAll(async () => {
      fetchTime = await getRunTime(() => runFetch(baseDir, false, ENV1_NAME, ['dummy']))
    })
    it(`should run fetch on a full workspace in less than ${firstFetchRunTime} ms`, () => {
      expect(fetchTime).toBeLessThanOrEqual(fetchRunTime)
    })
  })

  describe('creating and isolating a second env', () => {
    let createEnvTime: number
    beforeAll(async () => {
      createEnvTime = await getRunTime(() => runCreateEnv(baseDir, ENV2_NAME, true, true))
    })
    it(`should create the second env, and isolate the first env in less than ${createEnvRunTime}`, () => {
      expect(createEnvTime).toBeLessThanOrEqual(createEnvRunTime)
    })
  })

  describe('moveToCommon', () => {
    let moveToCommon: number
    beforeAll(async () => {
      moveToCommon = await getRunTime(() => runMoveToCommon(baseDir, ['dummy.ControlledApricotKaralynn']))
    })
    it(`should create the second env, and isolate the first env in less than ${moveToCommonRunTime}`, () => {
      expect(moveToCommon).toBeLessThanOrEqual(moveToCommonRunTime)
    })
  })

  describe('moveToEnv', () => {
    let moveToEnvs: number
    beforeAll(async () => {
      moveToEnvs = await getRunTime(() => runMoveToEnvs(baseDir, ['dummy.ControlledApricotKaralynn']))
    })
    it(`should create the second env, and isolate the first env in less than ${moveToEnvsRunTime}`, () => {
      expect(moveToEnvs).toBeLessThanOrEqual(moveToEnvsRunTime)
    })
  })

  describe('diff', () => {
    let diff: number
    beforeAll(async () => {
      diff = await getRunTime(() => runMoveToEnvs(baseDir, ['dummy.ControlledApricotKaralynn']))
    })
    it(`should create the second env, and isolate the first env in less than ${diffRunTime}`, () => {
      expect(diff).toBeLessThanOrEqual(diffRunTime)
    })
  })

  describe('deploy --dry run', () => {
    let deployTime: number
    beforeAll(async () => {
      runSetEnv(baseDir, ENV1_NAME)
      deployTime = await getRunTime(() => runDeploy({
        fetchOutputDir: baseDir,
        force: true,
        dryRun: true,
      }))
    })

    it(`should run deploy in less then ${deployRunTime} ms`, () => {
      expect(deployTime).toBeLessThanOrEqual(deployRunTime)
    })
  })

  describe('parsing the entire workspace (aka - no cache)', () => {
    let deployTime: number
    beforeAll(async () => {
      fs.rmdirSync(cacheDir(), { recursive: true })
      deployTime = await getRunTime(() => runDeploy({
        fetchOutputDir: baseDir,
        force: true,
        dryRun: true,
      }))
    })

    it(`should create plan without cache in less then ${deployRunTime} ms`, () => {
      expect(deployTime).toBeLessThanOrEqual(deployNoCacheRunTime)
    })
  })
})
