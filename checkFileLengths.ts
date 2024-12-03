// src/index.ts
import ignore, { Ignore } from "ignore";
import path from "path";
import chalk from "chalk";

interface FileSystem {
  stat: typeof import("fs/promises").stat;
  readdir: typeof import("fs/promises").readdir;
  readFile: typeof import("fs/promises").readFile;
}

interface Options {
  threshold?: number;
  throwOnFound?: boolean;
  useGitignore?: boolean;
  silent?: boolean;
  ignore?: string;
}

interface FileResult {
  path: string;
  lineCount: number;
}

async function loadGitignore(fs: FileSystem): Promise<Ignore> {
  const ig = ignore();
  try {
    const gitignore = await fs.readFile(
      path.join(process.cwd(), ".gitignore"),
      "utf8"
    );
    ig.add(gitignore);
  } catch (err) {
    console.error("No .gitignore found, continuing with empty rules");
  }
  return ig;
}

export async function checkFileLengths(
  fs: FileSystem,
  filePaths: string[],
  {
    threshold = 100,
    throwOnFound = true,
    useGitignore = true,
    silent = false,
    ignore: ignorePattern = "",
  }: Options = {}
): Promise<FileResult[]> {
  const ig = useGitignore ? await loadGitignore(fs) : ignore();

  if (ignorePattern) {
    const patterns = ignorePattern.split(",").map((pattern) => {
      const converted = `**/*${pattern}*`;
      return converted;
    });
    ig.add(patterns);
  }

  const allFiles: string[] = [];

  for (const filePath of filePaths) {
    try {
      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) {
        const files = await fs.readdir(filePath, { recursive: true });
        const fullPaths = files.map((file) =>
          path.join(filePath, file.toString())
        );
        allFiles.push(...fullPaths);
      } else {
        allFiles.push(filePath);
      }
    } catch (err) {
      if (!silent) {
        process.stderr.write(`Error accessing path: ${filePath} ${err}\n`);
      }
      if (throwOnFound && !silent) {
        throw err;
      }
      continue;
    }
  }

  const files = allFiles
    .map((p) => path.relative(process.cwd(), p))
    .filter((file) => !ig.ignores(file));

  const longFiles: FileResult[] = [];

  for (const file of files) {
    try {
      const stats = await fs.stat(file);
      if (!stats.isFile()) {
        continue;
      }

      const content = await fs.readFile(file, "utf8");
      const lineCount = content.split("\n").length;

      if (lineCount > threshold) {
        longFiles.push({
          path: file,
          lineCount,
        });
      }
    } catch (err) {
      if (!silent) {
        process.stderr.write(`Error processing file: ${file} ${err}\n`);
      }
      if (throwOnFound && !silent) {
        throw err;
      }
    }
  }

  if (longFiles.length > 0) {
    const message = formatOutput(longFiles, threshold);
    if (!silent) {
      if (throwOnFound) {
        throw new Error(message);
      } else {
        console.log(message);
      }
    }
  }

  return longFiles;
}

function formatOutput(files: FileResult[], threshold: number): string {
  const header = chalk.bold.yellow(`Files exceeding ${threshold} lines:`);
  const fileList = files
    .map(
      (f) =>
        `  ${chalk.red("•")} ${chalk.cyanBright(f.path)} ${chalk.gray(
          `(${f.lineCount} lines)`
        )}`
    )
    .join("\n");
  return `${header}\n${fileList}`;
}
