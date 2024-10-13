/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { Workspace } from '@salto-io/workspace'
import { parser } from '@salto-io/parser'
import { mockFunction } from '@salto-io/test-utils'
import { EditorWorkspace } from '../src/workspace'
import { getDiagnostics } from '../src/diagnostics'
import { mockWorkspace, mockErrors } from './workspace'

describe('diagnostics', () => {
  let baseWs: Workspace
  const parseRange = {
    start: { col: 2, line: 2, byte: 2 },
    end: { col: 3, line: 3, byte: 3 },
    filename: '/parse_error.nacl',
  }
  beforeEach(async () => {
    baseWs = await mockWorkspace()
    baseWs.errors = mockFunction<Workspace['errors']>().mockResolvedValue(
      mockErrors(
        [{ severity: 'Error', message: 'Blabla', detailedMessage: 'Blabla' }],
        [
          {
            message: 'parse',
            context: {
              start: { col: 1, line: 1, byte: 1 },
              end: { col: 2, line: 1, byte: 2 },
              filename: '/parse_error.nacl',
            },
            subject: parseRange,
            severity: 'Error',
            summary: 'parse error',
            detailedMessage: 'parse error',
          },
        ],
      ),
    )
    baseWs.transformError = mockFunction<Workspace['transformError']>().mockImplementation(async err => ({
      ...err,
      sourceLocations: [
        {
          sourceRange: {
            start: { col: 1, line: 1, byte: 1 },
            end: { col: 2, line: 1, byte: 2 },
            filename: '/parse_error.nacl',
          },
          subRange: (err as parser.ParseError).subject,
        },
      ],
    }))
  })
  it('should diagnostics on errors', async () => {
    const workspace = new EditorWorkspace('bla', baseWs)
    const diag = await getDiagnostics(workspace)
    const diagErrors = diag.errors['/parse_error.nacl']
    const validationError = diagErrors[0]
    expect(diag.totalNumberOfErrors).toBe(2)
    expect(validationError).toBeDefined()
    expect(validationError.msg).toContain('Blabla')
    expect(validationError.severity).toBe('Error')
    const parseError = diagErrors[1]
    expect(parseError).toBeDefined()
    expect(parseError.msg).toContain('parse')
    expect(parseError.severity).toBe('Error')
    expect(parseError.range).toEqual(_.omit(parseRange, 'filename'))
  })
  it('should not return wanrnings when errors exist', async () => {
    baseWs.errors = mockFunction<Workspace['errors']>().mockResolvedValue(
      mockErrors([
        { severity: 'Error', message: 'Blabla', detailedMessage: 'Blabla' },
        { severity: 'Warning', message: 'test', detailedMessage: 'test' },
      ]),
    )
    const workspace = new EditorWorkspace('bla', baseWs)
    const diag = await getDiagnostics(workspace)
    const diagErrors = diag.errors['/parse_error.nacl']
    expect(diag.totalNumberOfErrors).toBe(1)
    expect(diagErrors).toHaveLength(1)
    const error = diagErrors[0]
    expect(error.severity).toEqual('Error')
    expect(error.msg).toEqual('Blabla')
  })
  it('should return wanrnings when there are no errors', async () => {
    baseWs.errors = mockFunction<Workspace['errors']>().mockResolvedValue(
      mockErrors([{ severity: 'Warning', message: 'Blabla', detailedMessage: 'Blabla' }]),
    )
    const workspace = new EditorWorkspace('bla', baseWs)
    const diag = (await getDiagnostics(workspace)).errors['/parse_error.nacl']
    expect(diag).toHaveLength(1)
    const error = diag[0]
    expect(error.severity).toEqual('Warning')
    expect(error.msg).toEqual('Blabla')
  })
})
