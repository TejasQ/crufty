declare module "count-lines-in-file" {
  function countLinesInFile(
    filePath: string,
    callback: (error: Error | null, lineCount: number) => void
  ): void;
  export = countLinesInFile;
}
