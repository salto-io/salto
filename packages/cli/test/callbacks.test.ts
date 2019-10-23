
import { BuiltinTypes } from 'adapter-api'
import { getFieldInputType } from '../src/callbacks'

describe('callbacks', () => {
  it('should create proper inquirer field', async () => {
    const stRes = getFieldInputType(BuiltinTypes.STRING, 'st')
    const iRes = getFieldInputType(BuiltinTypes.NUMBER, 'i')
    const bRes = getFieldInputType(BuiltinTypes.BOOLEAN, 'b')
    const passRes = getFieldInputType(BuiltinTypes.STRING, 'password')
    expect(iRes).toBe('number')
    expect(bRes).toBe('confirm')
    expect(stRes).toBe('input')
    expect(passRes).toBe('password')
  })
})
