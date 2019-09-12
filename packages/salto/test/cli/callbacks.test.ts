
import { BuiltinTypes } from 'adapter-api'
import { getFieldInputType } from '../../src/cli/callbacks'

describe('callbacks', () => {
  it('should create proper inquirer field', async () => {
    const stRes = getFieldInputType(BuiltinTypes.STRING)
    const iRes = getFieldInputType(BuiltinTypes.NUMBER)
    const bRes = getFieldInputType(BuiltinTypes.BOOLEAN)
    expect(iRes).toBe('number')
    expect(bRes).toBe('confirm')
    expect(stRes).toBe('input')
  })
})
