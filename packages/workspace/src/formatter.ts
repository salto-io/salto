/*
*                      Copyright 2023 Salto Labs Ltd.
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
import wu from 'wu'
import { EOL } from 'os'
import { SaltoError } from '@salto-io/adapter-api'
import { SourceLocation, Workspace, WorkspaceError } from './workspace/workspace'

type StringFormatter = (txt: string) => string

type WorkspaceErrorStringFormatters = {
  header?: StringFormatter
  filename?: StringFormatter
  lineNum?: StringFormatter
}

const noFormat: StringFormatter = txt => txt

export const formatWorkspaceError = (
  we: Readonly<WorkspaceError<SaltoError>>,
  formatters?: WorkspaceErrorStringFormatters
): string => {
  const {
    header = noFormat,
    filename = noFormat,
    lineNum = noFormat,
  } = formatters ?? {}

  const formatSourceLocation = (
    sl: Readonly<SourceLocation>,
  ): string =>
    `${filename(sl.sourceRange.filename)}(${lineNum(`line: ${sl.sourceRange.start.line}`)})`

  const formatSourceLocations = (sourceLocations: ReadonlyArray<SourceLocation>): string =>
    `${sourceLocations.map(formatSourceLocation).join(EOL)}`

  const possibleEOL = we.sourceLocations.length > 0 ? EOL : ''
  return `${header(we.message)}${possibleEOL}${formatSourceLocations(we.sourceLocations)}`
}

export const formatWorkspaceErrors = async (
  workspace: Workspace,
  errors: Iterable<SaltoError>,
  stringFormatters?: WorkspaceErrorStringFormatters,
  maxErrorsToLog?: number
): Promise<string> => {
  const errorsIterable = wu(errors)
  const errorsToLog = maxErrorsToLog !== undefined
    ? errorsIterable.slice(0, maxErrorsToLog)
    : errorsIterable

  return (await Promise.all(
    errorsToLog
      .map(err => workspace.transformError(err))
      .map(async err => formatWorkspaceError(await err, stringFormatters))
  )).join(EOL)
}
