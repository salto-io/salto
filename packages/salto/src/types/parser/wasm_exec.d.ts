declare class Go {
  constructor()

  run(instance: any, args: string[]): Promise<void>

  importObject: {
    go: any
  }
}