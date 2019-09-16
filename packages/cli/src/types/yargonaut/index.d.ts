interface Yargonaut {
  asFont(text: string, font: string, throwErr?: boolean): string;
  chalk(): any;
  errors(font: string): Yargonaut;
  errorsStyle(style: string): Yargonaut;
  figlet(): any;
  font(font: string, key: string): Yargonaut;
  getAllKeys(): string[];
  getErrorKeys(): string[];
  getHelpKeys(): string[];
  help(font: string): Yargonaut;
  helpStyle(style: string): Yargonaut;
  listFonts(): Yargonaut;
  ocd(f: (key: string, origString: string, newString: string, figlet: any, font: string) => string): Yargonaut;
  printFont(font: string, text?: string, throwErr?: boolean): void;
  printFonts(text?: string, throwErr?: boolean): void;
  style(style: string, key?: string): Yargonaut;
  transformUpToFirstColon(key: string): Yargonaut;
  transformWholeString(key: string): Yargonaut;
}

declare var yargonaut: Yargonaut
export = yargonaut
