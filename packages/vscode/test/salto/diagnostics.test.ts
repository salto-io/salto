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
import { Workspace } from '@salto-io/core'
import { EditorWorkspace } from '../../src/salto/workspace'
import { getDiagnostics } from '../../src/salto/diagnostics'
import { mockWorkspace, mockErrors, mockFunction } from './workspace'
import { ParseError } from '@salto-io/core/dist/src/parser/parse'
import _ from 'lodash'

describe('diagnostics', () => {
  it('should diagnostics on errors', async () => {
    const baseWs = await mockWorkspace()
    const parseRange = {
      start: { col: 2, line: 2, byte: 2 },
      end: { col: 3, line: 3, byte: 3 },
      filename: '/parse_error.nacl',
    }
    baseWs.errors = mockFunction<Workspace['errors']>().mockResolvedValue(mockErrors(
      [{ severity: 'Error', message: 'Blabla' }],
      [{ 
        message: 'parse',  
        detail: 'parse detail',
        context : {
          start: { col: 1, line: 1, byte: 1 },
          end: { col: 2, line: 1, byte: 2 },
          filename: '/parse_error.nacl',
        },
        subject : parseRange,
        severity: "Error",
        summary : "parse error"
      }],
    ))
    baseWs.transformError = mockFunction<Workspace['transformError']>().mockImplementation(async err => ({
      ...err,
      sourceFragments: [{
        fragment: '',
        sourceRange: {
          start: { col: 1, line: 1, byte: 1 },
          end: { col: 2, line: 1, byte: 2 },
          filename: '/parse_error.nacl',
        },
        subRange : (err as ParseError).subject
      }],
    }))
    const workspace = new EditorWorkspace('bla', baseWs)
    const diag = (await getDiagnostics(workspace))['/parse_error.nacl']
    const validationError = diag[0]
    expect(validationError).toBeDefined()
    expect(validationError.msg).toContain('Blabla')
    expect(validationError.severity).toBe('Error')
    const parseError = diag[1]
    expect(parseError).toBeDefined()
    expect(parseError.msg).toContain('parse')
    expect(parseError.severity).toBe('Error')
    expect(parseError.range).toEqual(_.omit(parseRange,'filename'))
  })
})
