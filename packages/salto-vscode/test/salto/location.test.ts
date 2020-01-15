import * as path from 'path'
import { EditorWorkspace } from '../../src/salto/workspace'
import { getQueryLocations } from '../../src/salto/location'
import { mockWorkspace } from './workspace'

// eslint-disable-next-line jest/no-disabled-tests
describe.skip('workspace query locations', () => {
  let workspace: EditorWorkspace
  const bpFileName = path.resolve(`${__dirname}/../../../test/salto/test-bps/all.bp`)

  beforeAll(async () => {
    workspace = new EditorWorkspace(await mockWorkspace(bpFileName))
  })

  it('should find prefixes', async () => {
    const res = await getQueryLocations(workspace, 'vs.per')
    expect(res).toHaveLength(5)
    expect(res[0].fullname).toBe('vs.person')
  })
  it('should find suffixes', async () => {
    const res = await getQueryLocations(workspace, 's.person')
    expect(res).toHaveLength(2)
    expect(res[0].fullname).toBe('vs.person')
  })
  it('should find fragments in last name part', async () => {
    const res = await getQueryLocations(workspace, 'erso')
    expect(res).toHaveLength(2)
    expect(res[0].fullname).toBe('vs.person')
  })
  it('should  return empty results on not found', async () => {
    const res = await getQueryLocations(workspace, 'nope')
    expect(res).toHaveLength(0)
  })
})
