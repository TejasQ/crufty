// src/index.ts
import ignore, { Ignore } from "ignore";
import path from "path";
import chalk from "chalk";
import fg from "fast-glob";

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
  try {
    const ig = useGitignore ? await loadGitignore(fs) : ignore();

    if (filePaths.length === 0) {
      filePaths = ["."];
    }

    if (ignorePattern) {
      const patterns = ignorePattern
        .split(",")
        .map((pattern) => `**/*${pattern}*`);
      ig.add(patterns);
    }

    const allFiles: string[] = [];

    for (const filePath of filePaths) {
      try {
        const globResults = await fg(filePath, { dot: true });
        if (globResults.length > 0) {
          allFiles.push(...globResults);
        } else {
          const stats = await fs.stat(filePath);
          if (stats.isDirectory()) {
            const files = await fs.readdir(filePath);
            const fullPaths = files.map((file) =>
              path.join(filePath, file.toString())
            );
            allFiles.push(...fullPaths);
          } else if (stats.isFile()) {
            allFiles.push(filePath);
          }
        }
      } catch (err) {
        if (!silent && throwOnFound) {
          throw err;
        }
        if (!silent) {
          console.error(`Error accessing path: ${filePath}`, err);
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
        if (!silent && throwOnFound) {
          throw err;
        }
        if (!silent) {
          console.error(`Error processing file: ${file}`, err);
        }
      }
    }

    if (longFiles.length > 0) {
      const message = formatOutput(longFiles, threshold);
      if (!silent && throwOnFound) {
        throw new Error(message);
      }
      if (!silent) {
        console.log(message);
      }
    }

    return longFiles;
  } catch (err) {
    if (!silent && throwOnFound) {
      throw err;
    }
    if (!silent) {
      console.error(err);
    }
    return [];
  }
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
