/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import path from 'path'
import getStream from 'get-stream'
import { collections } from '@salto-io/lowerdash'
import { setupTmpDir } from '@salto-io/test-utils'
import { writeFile, readDir } from '@salto-io/file'
import { createFileStateContentProvider, StateContentProvider } from '../../../src/state/content_providers'

const { awu } = collections.asynciterable

describe('createFileStateContentProvider', () => {
  let provider: StateContentProvider
  beforeEach(() => {
    provider = createFileStateContentProvider('localStorage')
  })
  const testDir = setupTmpDir()
  const accountNames = ['salesforce', 'netsuite', 'dummy']
  const nonStateFiles = ['env.jsonl.zip', 'env.bar.jsonl.zip.not', 'env.json', 'not_env.dummy.jsonl.zip']
  const envPrefix = (): string => path.join(testDir.name(), 'env')
  beforeEach(async () => {
    await Promise.all(
      accountNames.map(name => writeFile(path.join(testDir.name(), `env.${name}.jsonl.zip`), 'stateData')),
    )
    await Promise.all(nonStateFiles.map(name => writeFile(path.join(testDir.name(), name), 'data')))
  })

  describe('findStateFiles', () => {
    it('should match only file names of the correct environment state files', async () => {
      expect(await provider.findStateFiles(envPrefix())).toIncludeSameMembers(
        accountNames.map(name => path.join(testDir.name(), `env.${name}.jsonl.zip`)),
      )
    })
  })
  describe('clear', () => {
    let files: string[]
    beforeEach(async () => {
      await provider.clear(envPrefix())
      files = await readDir(testDir.name())
    })
    it('should remove all state files', () => {
      expect(files).not.toIncludeAnyMembers(accountNames.map(name => `env.${name}.jsonl.zip`))
    })
    it('should not delete non state files', () => {
      expect(files).toIncludeSameMembers(nonStateFiles)
    })
  })
  describe('rename', () => {
    let files: string[]
    beforeEach(async () => {
      await provider.rename(envPrefix(), 'new_env_name')
      files = await readDir(testDir.name())
    })
    it('should rename state files', () => {
      expect(files).toIncludeAllMembers(accountNames.map(name => `new_env_name.${name}.jsonl.zip`))
    })
    it('should not rename non state files', () => {
      expect(files).toIncludeAllMembers(nonStateFiles)
    })
  })
  describe('getHash', () => {
    it('should return a stable hash of the files contents', async () => {
      // Note: this test basically forces a specific implementation of the hash function
      // this is good to make sure we don't accidentally cause cache invalidation
      // if this test breaks and you intentionally changed the hash algorithm or if you changed the setup in some way
      // change the test and update it with the new correct value.
      // be aware that this test failing when the setup did not change means all existing workspaces will have
      // their cache invalidated the next time they are loaded
      expect(await provider.getHash(await provider.findStateFiles(envPrefix()))).toEqual(
        '12dd3066f31529a0b3efc2196a3d896c',
      )
    })
  })
  describe('readContents', () => {
    it('should return a stream with the content of all state files', async () => {
      const streamToContent = await awu(provider.readContents(await provider.findStateFiles(envPrefix())))
        .map(async ({ name, stream }) => ({ name, content: await getStream.buffer(stream) }))
        .toArray()
      expect(streamToContent).toIncludeSameMembers(
        accountNames.map(name => ({
          name: path.join(testDir.name(), `env.${name}.jsonl.zip`),
          content: Buffer.from('stateData'),
        })),
      )
    })
  })
  describe('writeContents', () => {
    it('should overwrite the contents of the current files', async () => {
      await provider.writeContents(
        envPrefix(),
        accountNames.map(account => ({ account, content: Buffer.from('newStateData'), contentHash: 'newHash' })),
      )

      const streamToContent = await awu(provider.readContents(await provider.findStateFiles(envPrefix())))
        .map(async ({ name, stream }) => ({ name, content: await getStream.buffer(stream) }))
        .toArray()
      expect(streamToContent).toIncludeSameMembers(
        accountNames.map(name => ({
          name: path.join(testDir.name(), `env.${name}.jsonl.zip`),
          content: Buffer.from('newStateData'),
        })),
      )
    })
  })
})
