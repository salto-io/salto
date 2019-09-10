
import { BuiltinTypes } from 'adapter-api'
import { getFieldInputType } from '../../src/cli/callbacks'

describe('Test commands.ts', () => {
  it('should create proper inquier field', async () => {
    const stRes = getFieldInputType(BuiltinTypes.STRING)
    const iRes = getFieldInputType(BuiltinTypes.NUMBER)
    const bRes = getFieldInputType(BuiltinTypes.BOOLEAN)
    expect(iRes).toBe('number')
    expect(bRes).toBe('confirm')
    expect(stRes).toBe('input')
  })
})
