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
import _ from 'lodash'
import path from 'path'
import { Workspace, Blueprint, DetailedChange, WorkspaceError, SourceMap, SourceRange, Errors } from '@salto-io/core'
import { Element, SaltoError, ElemID } from '@salto-io/adapter-api'
import wu from 'wu'

export class EditorWorkspace {
  private workspace: Workspace
  // Indicates that the workspace is not the active workspace
  // (which means that the active workspace contains errors)
  // attempting to modify a copy of a workspace will result in an error
  private isCopy: boolean
  private runningSetOperation?: Promise<void>
  private pendingSets: {[key: string]: Blueprint} = {}
  private pendingDeletes: Set<string> = new Set<string>()
  private lastValidCopy? : Promise<Workspace | undefined>

  constructor(public baseDir: string, workspace: Workspace, isCopy = false) {
    this.workspace = workspace
    this.isCopy = isCopy
    this.lastValidCopy = workspace.hasErrors().then(hasErrors => {
      if (!hasErrors) {
        return workspace.clone()
      }
      return undefined
    })
  }

  get elements(): Promise<readonly Element[]> {
    return this.workspace.elements()
  }

  errors(): Promise<Errors> {
    return this.workspace.errors()
  }

  private workspaceFilename(filename: string): string {
    return path.relative(this.baseDir, filename)
  }

  private editorFilename(filename: string): string {
    return path.resolve(this.baseDir, filename)
  }

  private editorBlueprint(blueprint: Blueprint): Blueprint {
    return {
      ...blueprint,
      filename: this.editorFilename(blueprint.filename),
    }
  }

  private workspaceBlueprint(blueprint: Blueprint): Blueprint {
    return {
      ...blueprint,
      filename: this.workspaceFilename(blueprint.filename),
    }
  }

  private editorSourceRange(range: SourceRange): SourceRange {
    return {
      ...range,
      filename: this.editorFilename(range.filename),
    }
  }

  private editorSourceMap(sourceMap: SourceMap): SourceMap {
    return new Map(
      wu(sourceMap.entries()).map(([filename, ranges]) => [
        filename,
        ranges.map(range => this.editorSourceRange(range)),
      ])
    )
  }

  private hasPendingUpdates(): boolean {
    return !(_.isEmpty(this.pendingSets) && _.isEmpty(this.pendingDeletes))
  }

  private addPendingBlueprints(blueprints: Blueprint[]): void {
    _.assignWith(this.pendingSets, _.keyBy(blueprints, 'filename'))
  }

  private addPendingDeletes(names: string[]): void {
    names.forEach(n => this.pendingDeletes.add(n))
  }

  private async runAggregatedSetOperation(): Promise<void> {
    // We throw an error if someone attempted to trigger this
    // on an inactive state
    if (this.isCopy) throw new Error('Attempted to change inactive workspace')
    // No async ops here so the switch is atomic. Thanks JS!
    if (this.hasPendingUpdates()) {
      const opDeletes = this.pendingDeletes
      const opBlueprints = this.pendingSets
      this.pendingDeletes = new Set<string>()
      this.pendingSets = {}
      // We start by running all deleted
      if (!_.isEmpty(opDeletes) && this.workspace) {
        await this.workspace.removeBlueprints(...opDeletes)
      }
      // Now add the waiting changes
      if (!_.isEmpty(opBlueprints) && this.workspace) {
        await this.workspace.setBlueprints(..._.values(opBlueprints))
      }
      // After we ran the update we check if the operation resulted with no
      // errors. If so - we update the last valid state.
      if (_.isEmpty((await this.workspace.errors()).parse)
        && !_.isEmpty(await this.workspace.elements)) {
        this.lastValidCopy = Promise.resolve(this.workspace.clone())
      }
      // We recall this method to make sure no pending were added since
      // we started. Returning the promise will make sure the caller
      // keeps on waiting until the queue is clear.
      return this.runAggregatedSetOperation()
    }
    this.runningSetOperation = undefined
    return undefined
  }

  private async triggerAggregatedSetOperation(): Promise<void> {
    if (this.runningSetOperation === undefined) {
      this.runningSetOperation = this.runAggregatedSetOperation()
    }
    return this.runningSetOperation
  }

  async updateBlueprints(changes: DetailedChange[]): Promise<void> {
    if (this.runningSetOperation === undefined) {
      this.runningSetOperation = this.workspace.updateBlueprints(changes)
      return this.runningSetOperation
    }
    throw new Error('Can not update blueprints during a running set operation')
  }

  async getBlueprint(filename: string): Promise<Blueprint | undefined> {
    const bp = await this.workspace.getBlueprint(this.workspaceFilename(filename))
    return bp && this.editorBlueprint(bp)
  }

  async listBlueprints(): Promise<string[]> {
    return (await this.workspace.listBlueprints()).map(filename => this.editorFilename(filename))
  }

  async getElements(filename: string): Promise<Element[]> {
    return this.workspace.getElements(this.workspaceFilename(filename))
  }

  async getSourceMap(filename: string): Promise<SourceMap> {
    return this.editorSourceMap(await this.workspace.getSourceMap(this.workspaceFilename(filename)))
  }

  async getSourceRanges(elemID: ElemID): Promise<SourceRange[]> {
    return (await this.workspace.getSourceRanges(elemID))
      .map(range => this.editorSourceRange(range))
  }

  async transformError(error: SaltoError): Promise<WorkspaceError<SaltoError>> {
    const wsError = await this.workspace.transformError(error)
    return {
      ...wsError,
      sourceFragments: wsError.sourceFragments.map(fragment => ({
        ...fragment,
        sourceRange: this.editorSourceRange(fragment.sourceRange),
      })),
    }
  }

  setBlueprints(...blueprints: Blueprint[]): Promise<void> {
    this.addPendingBlueprints(blueprints.map(bp => this.workspaceBlueprint(bp)))
    return this.triggerAggregatedSetOperation()
  }

  removeBlueprints(...names: string[]): Promise<void> {
    this.addPendingDeletes(names.map(name => this.workspaceFilename(name)))
    return this.triggerAggregatedSetOperation()
  }

  async getValidCopy(): Promise<EditorWorkspace | undefined> {
    const lastValidCopy = await this.lastValidCopy
    return lastValidCopy ? new EditorWorkspace(this.baseDir, lastValidCopy, true) : undefined
  }

  hasErrors(): Promise<boolean> {
    return this.workspace.hasErrors()
  }

  async awaitAllUpdates(): Promise<void> {
    if (this.runningSetOperation) await this.runningSetOperation
  }
}
