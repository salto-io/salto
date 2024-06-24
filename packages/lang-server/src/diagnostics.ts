/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import _ from 'lodash'
import { SeverityLevel } from '@salto-io/adapter-api'
import { EditorRange } from './context'
import { EditorWorkspace } from './workspace'

export interface SaltoDiagnostic {
  filename: string
  msg: string
  range: EditorRange
  severity: SeverityLevel
}

export type WorkspaceSaltoDiagnostics = {
  errors: Record<string, SaltoDiagnostic[]>
  totalNumberOfErrors: number
}

const MAX_WORKSPACE_ERRORS = 50

export const getDiagnostics = async (workspace: EditorWorkspace): Promise<WorkspaceSaltoDiagnostics> => {
  const emptyDiagFiles: Record<string, SaltoDiagnostic[]> = _.fromPairs(
    (await workspace.listNaclFiles()).map(filename => [filename, []]),
  )
  const errorsAndWarnings = Array.from((await workspace.errors()).all())
  const errors = errorsAndWarnings.filter(e => e.severity === 'Error')
  const errorsToDisplay = _.isEmpty(errors) ? errorsAndWarnings : errors
  const totalNumberOfErrors = _.isEmpty(errors) ? errorsAndWarnings.length : errors.length
  const workspaceErrors = await Promise.all(
    wu(errorsToDisplay)
      .slice(0, MAX_WORKSPACE_ERRORS)
      .map(err => workspace.transformError(err))
      .map(async errPromise => {
        const err = await errPromise
        return err.sourceLocations.map(location => {
          const range = location.subRange ?? location.sourceRange
          return {
            filename: range.filename,
            severity: err.severity,
            msg: err.message,
            range: {
              start: range.start,
              end: range.end,
            },
          }
        })
      }),
  )

  const diag = _(workspaceErrors).flatten().groupBy('filename').value()
  return { errors: { ...emptyDiagFiles, ...diag }, totalNumberOfErrors }
}
