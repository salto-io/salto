import * as path from 'path'
import { Config } from 'salto'
import { EditorWorkspace } from '../../src/salto/workspace'
import { getQueryLocations } from '../../src/salto/location'

describe('workspace query', () => {
  const getConfig = (baseDir: string, additionalBlueprints: string[]): Config => ({
    baseDir,
    additionalBlueprints,
    stateLocation: path.join(baseDir, 'salto.config', 'state.bpc'),
    localStorage: '.',
    name: 'test',
    uid: '',
  })
  let workspace: EditorWorkspace
  const baseBPDir = path.resolve(`${__dirname}/../../../test/salto/completionsBP`)

  beforeAll(async () => {
    workspace = await EditorWorkspace.load(getConfig(baseBPDir, []), false)
  })

  it('should find prefixes', () => {
    const res = getQueryLocations(workspace, 'vs_per')
    expect(res).toHaveLength(2)
    expect(res[0].fullname).toBe('vs_person')
  })
  it('should find suffixes', () => {
    const res = getQueryLocations(workspace, 's_person')
    expect(res).toHaveLength(2)
    expect(res[0].fullname).toBe('vs_person')
  })
  it('should find fragments in last name part', () => {
    const res = getQueryLocations(workspace, 'erso')
    expect(res).toHaveLength(2)
    expect(res[0].fullname).toBe('vs_person')
  })
  it('should  return empty results on not found', () => {
    const res = getQueryLocations(workspace, 'nope')
    expect(res).toHaveLength(0)
  })
})
