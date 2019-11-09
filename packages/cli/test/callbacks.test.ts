
import { BuiltinTypes } from 'adapter-api'
import { getFieldInputType, getApprovedChanges } from '../src/callbacks'
import { dummyChanges } from './mocks'

jest.mock('inquirer', () => ({
  prompt: jest.fn().mockImplementation(() => Promise.resolve({ 0: 'yes', 1: 'no' })),
}))
describe('callbacks', () => {
  it('should create proper inquirer field', () => {
    const stRes = getFieldInputType(BuiltinTypes.STRING, 'st')
    const iRes = getFieldInputType(BuiltinTypes.NUMBER, 'i')
    const bRes = getFieldInputType(BuiltinTypes.BOOLEAN, 'b')
    const passRes = getFieldInputType(BuiltinTypes.STRING, 'password')
    expect(iRes).toBe('number')
    expect(bRes).toBe('confirm')
    expect(stRes).toBe('input')
    expect(passRes).toBe('password')
  })

  describe('getApprovedChanges', () => {
    const fetchChanges = dummyChanges.map(c => ({ change: c, serviceChange: c }))
    it('should return all non conflict changes interactive=false', async () => {
      const approved = await getApprovedChanges(fetchChanges, false)
      expect(approved).toHaveLength(fetchChanges.length)
    })

    it('should return only approved changes interactive=true', async () => {
      const approved = await getApprovedChanges(fetchChanges, true)
      expect(approved).toHaveLength(1)
    })

    it('should ask for conflicts return only approved changes interactive=true', async () => {
      const approved = await getApprovedChanges(fetchChanges
        .map(c => ({ ...c, pendingChange: c.change })), false)
      expect(approved).toHaveLength(1)
    })
  })
})
