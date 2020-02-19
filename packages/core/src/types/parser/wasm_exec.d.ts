declare class Go {
  constructor()

  run(instance: any, args: string[]): Promise<void>

  env: Record<string, string>
  importObject: {
    go: any
  }
}
