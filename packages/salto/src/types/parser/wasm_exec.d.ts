declare class Go {
  constructor()

  run(instance: any): Promise<void>

  importObject: {
    go: any
  }
}