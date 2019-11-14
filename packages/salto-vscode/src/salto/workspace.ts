import _ from 'lodash'
import path from 'path'

import {
  Workspace, Blueprint,
  ParsedBlueprint, ParsedBlueprintMap,
  SourceMap, Errors, Config, DetailedChange,
} from 'salto'
import { Element } from 'adapter-api'

export class EditorWorkspace {
  workspace: Workspace
  // Indicates that the workspace is not the active workspace
  // (which means that the active workspace contains errors)
  // attempting to modify a copy of a workspace will result in an error
  private isCopy: boolean
  private runningSetOperation?: Promise<void>
  private pendingSets: {[key: string]: Blueprint} = {}
  private pendingDeletes: Set<string> = new Set<string>()
  private lastValidCopy? : Workspace

  static async load(
    config: Config,
    useCache = true
  ): Promise<EditorWorkspace> {
    const workspace = await Workspace.load(config, useCache)
    return new EditorWorkspace(workspace)
  }

  constructor(workspace: Workspace, isCopy = false) {
    this.workspace = workspace
    this.isCopy = isCopy
    if (!workspace.errors.hasErrors()) {
      this.lastValidCopy = _.clone(workspace)
    }
  }

  // Accessors into workspace
  get elements(): ReadonlyArray<Element> { return this.workspace.elements }
  get errors(): Errors { return this.workspace.errors }
  get parsedBlueprints(): ParsedBlueprintMap { return this.workspace.parsedBlueprints }
  get sourceMap(): SourceMap { return this.workspace.sourceMap }
  get baseDir(): string { return this.workspace.config.baseDir }
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
      if (_.isEmpty(this.errors.parse) && !_.isEmpty(this.elements)) {
        this.lastValidCopy = _.clone(this.workspace)
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

  private getWorkspaceName(filename: string): string {
    return path.isAbsolute(filename)
      ? path.relative(this.workspace.config.baseDir, filename)
      : filename
  }

  getParsedBlueprint(filename: string): ParsedBlueprint {
    return this.parsedBlueprints[this.getWorkspaceName(filename)]
  }

  async updateBlueprints(...changes: DetailedChange[]): Promise<void>{
    console.log(changes)
    if (this.runningSetOperation === undefined) {
        this.runningSetOperation = this.workspace.updateBlueprints(...changes) 
        return this.runningSetOperation
    }
    throw new Error('Can not update blueprints during a running set operation')
  }

  async flush(): Promise<void> {
    return this.workspace.flush()
  }

  setBlueprints(...blueprints: Blueprint[]): Promise<void> {
    this.addPendingBlueprints(
      blueprints.map(bp => ({
        ...bp,
        filename: this.getWorkspaceName(bp.filename),
      }))
    )
    return this.triggerAggregatedSetOperation()
  }

  removeBlueprints(...names: string[]): Promise<void> {
    this.addPendingDeletes(names.map(n => this.getWorkspaceName(n)))
    return this.triggerAggregatedSetOperation()
  }

  getValidCopy(): EditorWorkspace | undefined {
    return this.lastValidCopy ? new EditorWorkspace(this.lastValidCopy, true) : undefined
  }

  hasErrors(): boolean {
    return this.workspace.hasErrors()
  }

  async awaitAllUpdates(): Promise<void> {
    if (this.runningSetOperation) await this.runningSetOperation
  }
}
