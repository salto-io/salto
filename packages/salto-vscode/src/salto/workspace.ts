import _ from 'lodash'
import path from 'path'

import {
  Workspace, WorkspaceBlueprint as Blueprint, SaltoError, ParsedBlueprintMap,
  ReadOnlySourceMap,
} from 'salto'
import { Element } from 'adapter-api'

export class EditorWorkspace {
  private workspace: Workspace
  private active: boolean
  private runningSetOperation?: Promise<void>
  private pendingSets: {[key: string]: Blueprint} = {}
  private pendingDeletes: Set<string> = new Set<string>()
  private lastValidCopy? : Workspace

  static async load(
    blueprintsDir: string,
    blueprintsFiles: string[],
    useCache = true
  ): Promise<EditorWorkspace> {
    const workspace = await Workspace.load(blueprintsDir, blueprintsFiles, useCache)
    return new EditorWorkspace(workspace)
  }


  constructor(workspace: Workspace, active = true) {
    this.workspace = workspace
    this.active = active
    if (_.isEmpty(workspace.errors)) {
      this.lastValidCopy = _.cloneDeep(workspace)
    }
  }

  // Accessors into workspace
  get elements(): ReadonlyArray<Element> { return this.workspace.elements }
  get errors(): ReadonlyArray<SaltoError> { return this.workspace.errors }
  get parsedBlueprints(): ParsedBlueprintMap { return this.workspace.parsedBlueprints }
  get sourceMap(): ReadOnlySourceMap { return this.workspace.sourceMap }

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
    if (!this.active) throw new Error('Attempted to change inactive workspace')

    // If there is an op running we'll just wait for it to exit
    // it will only exit after the nothing is pending.
    if (this.runningSetOperation) {
      return this.runningSetOperation
    }

    // No async ops here so the switch is atomic. Thanks JS!
    if (this.hasPendingUpdates()) {
      const opDeletes = this.pendingDeletes
      const opBlueprints = this.pendingSets
      this.pendingDeletes = new Set<string>()
      this.pendingSets = {}
      // We start by running all deleted
      if (!_.isEmpty(opDeletes) && this.workspace) {
        this.workspace.removeBlueprints(...opDeletes)
      }
      // Now add the waiting changes
      if (!_.isEmpty(opBlueprints) && this.workspace) {
        this.runningSetOperation = this.workspace.setBlueprints(..._.values(opBlueprints))
        await this.runningSetOperation
      }
      // After we ran the update we check if the operation resulted with no
      // errors. If so - we update the last valid state.
      if (_.isEmpty(this.errors)) {
        this.lastValidCopy = _.cloneDeep(this.workspace)
      }
      // We recall this method to make sure no pending were added since
      // we started. Returning the promise will make sure the caller
      // keeps on waiting until the queue is clear.
      return this.runAggregatedSetOperation()
    }
    // We had nothing to do - so we clear the running flag and exit
    this.runningSetOperation = undefined
    return undefined
  }

  getWorkspaceName(filename: string): string {
    return path.relative(this.workspace.baseDir, filename)
  }

  setBlueprints(...blueprints: Blueprint[]): void {
    this.addPendingBlueprints(
      blueprints.map(bp => ({
        ...bp,
        filename: this.getWorkspaceName(bp.filename),
      }))
    )
    this.runAggregatedSetOperation()
  }

  removeBlueprints(...names: string[]): void {
    this.addPendingDeletes(names.map(n => this.getWorkspaceName(n)))
    this.runAggregatedSetOperation()
  }

  getValidCopy(): EditorWorkspace | undefined {
    if (_.isEmpty(this.errors)) {
      return this
    }
    return this.lastValidCopy ? new EditorWorkspace(this.lastValidCopy, false) : undefined
  }

  async awaitAllUpdates(): Promise<void> {
    if (this.runningSetOperation) await this.runningSetOperation
  }
}
